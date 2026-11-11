import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { buildHandoff } from './review.js'

export const BLUEPRINT_VERSION = 2

// Hard limits for one blueprint. Exceeding a limit is a readable validation error;
// nothing is silently truncated.
export const BLUEPRINT_LIMITS = Object.freeze({
  requirements: 2000,
  diagrams: 256,
  modules: 500,
  layers: 64,
  depth: 4,
  // Workspace Map (v0.7): top-level mounts and per-module mount references.
  mounts: 100,
  moduleMounts: 16,
  // Execution ledger (v0.8): Host-owned run records. Evidence is capped per run.
  runs: 200,
  runEvidence: 50,
})

export class BlueprintValidationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'BlueprintValidationError'
    this.code = code
  }
}

function validationError(code, message) {
  return new BlueprintValidationError(code, `蓝图数据无效：${message}`)
}

function limitError(count, limit, what) {
  return new BlueprintValidationError('limit', `蓝图超过上限：${what} ${count} > ${limit}。请拆分蓝图，不会静默截断。`)
}

// Confirmation tokens live only in Host memory. They are keyed by session and never
// written into the blueprint JSON, version history or browser storage.
export const CONFIRM_TOKEN_TTL_MS = 10 * 60 * 1000

function canonicalContent(value) {
  if (Array.isArray(value)) return value.map(canonicalContent)
  if (value !== null && typeof value === 'object') {
    const result = {}
    for (const key of Object.keys(value).sort()) {
      if (key === 'updatedAt') continue
      result[key] = canonicalContent(value[key])
    }
    return result
  }
  return value
}

// Hash of the normalized blueprint content, excluding the volatile updatedAt field.
// Key order is canonicalized so the same content always produces the same hash even
// if a caller builds the object in a different order.
export function blueprintContentHash(blueprint) {
  const source = blueprint !== null && typeof blueprint === 'object' && !Array.isArray(blueprint) ? blueprint : {}
  return crypto.createHash('sha256').update(JSON.stringify(canonicalContent(source))).digest('hex')
}

// One active one-time token per session. issue() replaces an earlier token, verify()
// never mutates a valid token, and consume() removes it on first successful use.
export function createConfirmTokenStore(options = {}) {
  const ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : CONFIRM_TOKEN_TTL_MS
  const now = typeof options.now === 'function' ? options.now : Date.now
  const randomUUID = typeof options.randomUUID === 'function' ? options.randomUUID : crypto.randomUUID
  const entries = new Map()

  const verify = (sessionId, token) => {
    const record = entries.get(sessionId)
    if (record === undefined) {
      return { ok: false, code: 'missing', message: '确认令牌不存在或已被使用，请重新确认。' }
    }
    if (record.expiresAt <= now()) {
      entries.delete(sessionId)
      return { ok: false, code: 'expired', message: '确认令牌已过期，请重新确认。' }
    }
    if (typeof token !== 'string' || token === '' || token !== record.token) {
      return { ok: false, code: 'mismatch', message: '确认令牌与当前会话不匹配，请重新确认。' }
    }
    return { ok: true, record }
  }

  return {
    ttlMs,
    issue(sessionId, hash) {
      const token = randomUUID()
      const createdAt = now()
      const record = { sessionId, token, hash, createdAt, expiresAt: createdAt + ttlMs }
      entries.set(sessionId, record)
      return { token, hash, createdAt, expiresAt: record.expiresAt }
    },
    verify,
    consume(sessionId, token) {
      const result = verify(sessionId, token)
      if (result.ok) entries.delete(sessionId)
      return result
    },
    revoke(sessionId) {
      entries.delete(sessionId)
    },
    get size() {
      return entries.size
    },
  }
}

// Verify a token against the blueprint that is currently on disk. The caller must run
// this before writing dispatched; a stale hash or non-confirmed status never mutates.
export function verifyBlueprintToken(store, sessionId, token, blueprint) {
  if (store === undefined || store === null || typeof store.verify !== 'function') {
    return { ok: false, code: 'unavailable', message: '确认令牌服务不可用，请重启插件后重试。' }
  }
  const checked = store.verify(sessionId, token)
  if (!checked.ok) return checked
  if (blueprint === undefined || blueprint === null) {
    return { ok: false, code: 'missing-blueprint', message: '还没有工程蓝图，无法分派。' }
  }
  if (blueprintContentHash(blueprint) !== checked.record.hash) {
    return { ok: false, code: 'stale', message: '蓝图内容已变更，确认令牌已失效，请重新确认。' }
  }
  if (blueprint.status !== 'confirmed') {
    return { ok: false, code: 'status', message: '蓝图状态不是 confirmed，无法分派，请重新确认。' }
  }
  return checked
}

export const SECTION_DEFS = [
  { key: 'goals', title: '目标与价值' },
  { key: 'actors', title: '角色与场景' },
  { key: 'functional', title: '功能需求' },
  { key: 'nonfunctional', title: '非功能需求' },
  { key: 'constraints', title: '约束与依赖' },
  { key: 'acceptance', title: '验收标准' },
  { key: 'risks', title: '风险与开放问题' },
]

export const DIAGRAM_DEFS = [
  { key: 'usecase', title: '用例图', types: ['actor', 'usecase', 'system'], defaultType: 'usecase' },
  { key: 'dfd', title: '数据流图', types: ['entity', 'process', 'store'], defaultType: 'process' },
  { key: 'module', title: '模块图', types: ['module', 'external'], defaultType: 'module' },
  { key: 'sequence', title: '时序图', types: ['participant', 'actor', 'system'], defaultType: 'participant' },
  { key: 'er', title: 'ER 图', types: ['entity', 'relationship'], defaultType: 'entity' },
  { key: 'c4', title: 'C4 图', types: ['person', 'system', 'container', 'component', 'external', 'database'], defaultType: 'container' },
  { key: 'class', title: '类图', types: ['class', 'interface'], defaultType: 'class' },
  { key: 'state', title: '状态图', types: ['state', 'initial', 'final', 'choice'], defaultType: 'state' },
  { key: 'flowchart', title: '计划流程图', types: ['start', 'end', 'process', 'decision', 'group', 'note'], defaultType: 'process' },
]

// Plan Flowchart is opt-in: legacy/untyped blueprints keep the original eight root
// slots, and only an explicit flowchart entry creates the ninth diagram.
const AUTO_DIAGRAM_DEFS = DIAGRAM_DEFS.filter(def => def.key !== 'flowchart')

export const ALL_NODE_TYPES = [...new Set(DIAGRAM_DEFS.flatMap(def => def.types))]

const FLOWCHART_EDGE_KINDS = new Set(['flow', 'dashed'])
const FLOWCHART_DEFAULT_EDGE_KIND = 'flow'

const STATUSES = new Set(['draft', 'confirmed', 'dispatched'])

// Layered acceptance verification. Every role is independent and can be passed,
// failed or pending; module.status is derived from these three entries instead of
// being freely claimed by an agent.
export const VERIFICATION_ROLES = Object.freeze(['tests', 'reviewer', 'human'])
export const VERIFICATION_STATUSES = Object.freeze(['pending', 'passed', 'failed'])
export const MODULE_STATUS_NEEDS_REWORK = 'needs-rework'
const VERIFICATION_STATUS_SET = new Set(VERIFICATION_STATUSES)

// Workspace Map (v0.7). Mounts are pure syntax: root paths are stored as written
// and never touched on disk here. Validation of existence belongs to the UI/Host.
export const MOUNT_KINDS = Object.freeze(['working', 'snapshot', 'archive'])
export const MOUNT_ACCESS = Object.freeze(['rw', 'ro'])
export const MOUNT_VCS = Object.freeze(['git', 'none'])
export const EXECUTION_ADAPTERS = Object.freeze(['dsh-subagent', 'cli', 'http', 'manual'])
export const EXECUTION_STORAGE_KINDS = Object.freeze(['fs', 'git', 'object'])

// Execution ledger (v0.8). runs are Host-owned: the agent `update` tool can never
// write them (see mergeBlueprintForUpdate), only the Host commands and create-seed
// path produce records. A run claims the working rw mounts of its module for the
// duration of its lease so two parallel agents never write the same workspace.
export const RUN_ADAPTERS = EXECUTION_ADAPTERS
export const RUN_STATUSES = Object.freeze(['running', 'blocked', 'done', 'failed', 'cancelled'])
export const RUN_TERMINAL_STATUSES = Object.freeze(['done', 'failed', 'cancelled'])
export const RUN_LEASE_MS = 30 * 60 * 1000
export const RUN_EVIDENCE_LIMIT = 50
const RUN_STATUS_SET = new Set(RUN_STATUSES)
const RUN_TERMINAL_SET = new Set(RUN_TERMINAL_STATUSES)
const RUN_ADAPTER_SET = new Set(RUN_ADAPTERS)
const RUN_FIELD_NAMES = new Set([
  'id', 'moduleId', 'mountIds', 'adapter', 'status', 'claimedBy', 'leaseUntil',
  'startedAt', 'endedAt', 'baseSnapshot', 'evidence', 'decisions', 'nextAction',
  'error', 'rollback',
])
const RUN_TEXT_LIMIT = 2000
const RUN_ID_LIMIT = 120
const RUN_EVIDENCE_TEXT_LIMIT = 2000
const RUN_EVIDENCE_KIND_LIMIT = 120
const RUN_LIST_LIMIT = 50

// Handoff Job Protocol (v0.10). A run directory is derived from the session's
// blueprint file name and a strictly validated run id, so a caller can never use
// `../` or an absolute path to escape `.dsh/blueprints/<session>.runs/`.
export const RUN_ID_PATTERN = /^run-[a-z0-9-]+$/u
export const RUN_RESULT_STATUSES = Object.freeze(['done', 'failed', 'blocked'])
export const RUN_RESULT_LIMIT = 50
const RUN_RESULT_STATUS_SET = new Set(RUN_RESULT_STATUSES)

export function isSafeRunId(value) {
  const wanted = text(value).trim()
  return wanted !== '' && RUN_ID_PATTERN.test(wanted)
}

function safeRunId(value) {
  const wanted = text(value).trim()
  if (!isSafeRunId(wanted)) {
    throw new BlueprintValidationError(
      'run-id',
      `运行 id 无效：${wanted || '(空)'}（只允许 run-[a-z0-9-]+，不能包含路径分隔符）。`,
    )
  }
  return wanted
}

function clipped(value, max = RUN_TEXT_LIMIT) {
  const body = text(value).trim()
  return body.length > max ? body.slice(0, max) : body
}

const MOUNT_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/u
const MOUNT_FIELD_NAMES = new Set([
  'id', 'label', 'name', 'root', 'path', 'kind', 'access', 'vcs', 'ref', 'checksum', 'readOnly', 'notes',
])

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

function text(value, fallback = '') {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback
}

function slug(value, fallback = 'item') {
  const base = text(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return base || fallback
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

// Traceability references are plain strings: "<sectionKey>:<itemId>" for nodes and
// "<diagramKey>:<nodeId>" for modules. Keep normalization permissive so hand-written
// and agent-written blueprints never fail to load, but trim duplicates and blanks.
function stringList(value) {
  const list = Array.isArray(value) ? value : []
  const seen = new Set()
  const result = []
  for (const entry of list) {
    if (typeof entry !== 'string') continue
    const item = entry.trim()
    if (item === '' || seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  return result
}

function unique(base, used) {
  let candidate = base
  let index = 2
  while (used.has(candidate)) candidate = `${base}-${index++}`
  used.add(candidate)
  return candidate
}

const REQUIREMENT_CODE_PATTERN = /^R([1-9]\d*)$/u

function requirementCode(value) {
  const match = REQUIREMENT_CODE_PATTERN.exec(text(value).trim())
  return match === null ? '' : `R${match[1]}`
}

function itemUid(sectionKey, item) {
  return `${sectionKey}:${text(item?.id).trim()}`
}

function normalizeItems(raw, used, previousItems, sectionKey) {
  const list = Array.isArray(raw) ? raw : []
  const items = []
  for (const [index, entry] of list.entries()) {
    const value = typeof entry === 'string' ? { text: entry } : object(entry)
    if (value === undefined) continue
    const body = text(value.text ?? value.label ?? value.title ?? value.value).trim()
    if (body === '') continue
    const previousAtPosition = previousItems?.[index]
    let id = text(value.id).trim()
    if (id === '') {
      const previousId = text(previousAtPosition?.id).trim()
      id = previousId !== '' && !used.has(previousId) ? previousId : unique(`i${items.length + 1}`, used)
    } else {
      id = unique(id, used)
    }
    const uid = `${sectionKey}:${id}`
    const previous = previousItems?.find(item => itemUid(sectionKey, item) === uid) ?? previousAtPosition
    const item = { id, uid, text: body }
    if (typeof value.done === 'boolean') item.done = value.done
    else if (typeof previous?.done === 'boolean') item.done = previous.done
    const code = requirementCode(value.code)
    if (code !== '') item.code = code
    const moduleId = text(value.moduleId).trim() || text(previous?.moduleId).trim()
    if (moduleId !== '') item.moduleId = moduleId
    items.push(item)
  }
  return items
}

// Requirement codes are global and append-only: R1, R2, ... Existing codes are
// retained by uid, new items always receive a number above every code ever seen
// (including codes of previously deleted items), and duplicates are repaired by
// allocating the next free number instead of silently dropping either item.
function assignRequirementCodes(sections, previous) {
  const previousByUid = new Map()
  let maxIndex = 0
  for (const section of previous?.sections ?? []) {
    for (const item of section.items ?? []) {
      const uid = text(item.uid).trim() || itemUid(section.key, item)
      const code = requirementCode(item.code)
      if (uid !== ':' && uid !== '') previousByUid.set(uid, item)
      if (code !== '') maxIndex = Math.max(maxIndex, Number(code.slice(1)))
    }
  }

  for (const section of sections) {
    for (const item of section.items ?? []) {
      if (text(item.uid).trim() === '') item.uid = itemUid(section.key, item)
      const code = requirementCode(item.code)
      if (code !== '') maxIndex = Math.max(maxIndex, Number(code.slice(1)))
    }
  }

  const used = new Set()
  for (const section of sections) {
    for (const item of section.items ?? []) {
      const previousItem = previousByUid.get(item.uid)
      const explicit = requirementCode(item.code) || requirementCode(previousItem?.code)
      let code = explicit
      if (code === '' || used.has(code)) {
        do maxIndex += 1
        while (used.has(`R${maxIndex}`))
        code = `R${maxIndex}`
      }
      used.add(code)
      item.code = code
      if (item.moduleId === undefined && text(previousItem?.moduleId).trim() !== '') {
        item.moduleId = text(previousItem.moduleId).trim()
      }
    }
  }
  return sections
}

function normalizeSections(raw, previous) {
  const source = Array.isArray(raw)
    ? raw
    : object(raw)
      ? Object.entries(raw).map(([key, value]) =>
          Array.isArray(value) ? { key, items: value } : { key, ...(object(value) ?? {}) },
        )
      : undefined
  if (source === undefined) {
    const inherited = (previous?.sections ?? defaultSections()).map(section => ({
      ...section,
      items: (section.items ?? []).map(item => ({ ...item })),
    }))
    return assignRequirementCodes(inherited, previous)
  }

  const previousByKey = new Map((previous?.sections ?? []).map(section => [section.key, section]))
  const used = new Set()
  const sections = []

  for (const entry of source) {
    const value = object(entry)
    if (value === undefined) continue
    const title = text(value.title ?? value.name, '').trim()
    const rawKey = text(value.key) || slug(title || `section-${sections.length + 1}`)
    if (sections.some(section => section.key === rawKey)) continue
    const key = unique(rawKey, used)
    const itemUsed = new Set()
    const kept = previousByKey.get(rawKey)
    // Only an omitted item field inherits the previous list. An explicit empty
    // list must stay empty so users can clear a section and have it persist.
    const explicitItems = value.items !== undefined || value.requirements !== undefined
    const items = explicitItems
      ? normalizeItems(value.items ?? value.requirements, itemUsed, kept?.items, key)
      : (kept?.items ?? []).map(item => ({ ...item }))
    sections.push({
      key,
      title: title || kept?.title || key,
      items,
    })
  }

  for (const def of SECTION_DEFS) {
    if (sections.some(section => section.key === def.key)) continue
    const kept = previousByKey.get(def.key)
    sections.push({
      key: def.key,
      title: def.title,
      items: (kept?.items ?? []).map(item => ({ ...item })),
    })
  }
  return assignRequirementCodes(sections, previous)
}

function defaultSections() {
  return SECTION_DEFS.map(def => ({ key: def.key, title: def.title, items: [] }))
}

function normalizeFields(raw) {
  const list = Array.isArray(raw) ? raw : []
  const fields = []
  for (const entry of list) {
    const value = typeof entry === 'string' ? { name: entry } : object(entry)
    if (value === undefined) continue
    const name = text(value.name ?? value.field ?? value.label).trim()
    if (name === '') continue
    const field = { name }
    const type = text(value.type ?? value.dataType).trim()
    if (type !== '') field.type = type
    if (value.key === true || value.primary === true) field.key = true
    if (value.nullable === true) field.nullable = true
    const note = text(value.note ?? value.description).trim()
    if (note !== '') field.note = note
    const kind = text(value.kind).trim().toLowerCase()
    if (kind === 'field' || kind === 'method') field.kind = kind
    fields.push(field)
  }
  return fields
}

function normalizeNodes(raw, typeSet, defaultType, options = {}) {
  const list = Array.isArray(raw) ? raw : []
  const used = new Set()
  const nodes = []
  const labelToId = new Map()
  const flowchart = options.flowchart === true
  for (const entry of list) {
    const value = object(entry)
    if (value === undefined) continue
    const label = text(value.label ?? value.name ?? value.title).trim()
    if (label === '') continue
    const wanted = text(value.id) || `n${nodes.length + 1}`
    const id = unique(wanted, used)
    const type = typeSet.has(text(value.type)) ? text(value.type) : defaultType
    const node = { id, type, label }
    if (text(value.description ?? value.note).trim() !== '') {
      node.description = text(value.description ?? value.note).trim()
    }
    if (text(value.technology).trim() !== '') node.technology = text(value.technology).trim()
    if (text(value.stereotype).trim() !== '') node.stereotype = text(value.stereotype).trim()
    for (const key of ['x', 'y', 'w', 'h']) {
      const number = finite(value[key])
      if (number !== undefined) node[key] = number
    }
    if (text(value.group).trim() !== '') node.group = text(value.group).trim()
    if (text(value.moduleId).trim() !== '') node.moduleId = text(value.moduleId).trim()
    if (flowchart) {
      // Plan Flowchart keeps planning metadata on the node. parentGroup is kept
      // verbatim even when it points at a missing group: normalization never
      // silently drops a dangling reference, the self-check reports it later.
      if (text(value.parentGroup).trim() !== '') node.parentGroup = text(value.parentGroup).trim()
      if (text(value.condition).trim() !== '') node.condition = text(value.condition).trim()
      if (text(value.owner).trim() !== '') node.owner = text(value.owner).trim()
      if (text(value.verification).trim() !== '') node.verification = text(value.verification).trim()
      if (type === 'group') {
        if (typeof value.collapsed === 'boolean') node.collapsed = value.collapsed
        else if (value.collapsed === 'true' || value.collapsed === 'false') node.collapsed = value.collapsed === 'true'
      }
    }
    node.requirementIds = stringList(value.requirementIds)
    const fields = normalizeFields(value.fields ?? value.attributes ?? value.columns)
    if (fields.length > 0) node.fields = fields
    nodes.push(node)
    labelToId.set(label.toLowerCase(), id)
    labelToId.set(id.toLowerCase(), id)
  }
  return { nodes, labelToId }
}

function normalizeEdges(raw, nodes, labelToId, options = {}) {
  const list = Array.isArray(raw) ? raw : []
  const used = new Set()
  const ids = new Set(nodes.map(node => node.id))
  const edges = []
  const resolve = value => {
    const key = text(value).trim()
    if (key === '') return undefined
    if (ids.has(key)) return key
    return labelToId.get(key.toLowerCase())
  }
  const allowedKinds = options.edgeKinds
  for (const entry of list) {
    const value = object(entry)
    if (value === undefined) continue
    const from = resolve(value.from ?? value.source ?? value.fromId ?? value.start)
    const to = resolve(value.to ?? value.target ?? value.toId ?? value.end)
    if (from === undefined || to === undefined || from === to) continue
    const edge = {
      id: unique(text(value.id) || `e${edges.length + 1}`, used),
      from,
      to,
    }
    const label = text(value.label ?? value.name ?? value.message).trim()
    if (label !== '') edge.label = label
    const rawKind = text(value.kind ?? value.type).trim()
    if (allowedKinds instanceof Set) {
      const wanted = rawKind.toLowerCase()
      edge.kind = allowedKinds.has(wanted) ? wanted : options.defaultKind
    } else if (rawKind !== '') {
      edge.kind = rawKind
    }
    const order = finite(value.order ?? value.seq ?? value.index)
    if (order !== undefined) edge.order = order
    const cardinality = text(value.cardinality ?? value.card).trim()
    if (cardinality !== '') edge.cardinality = cardinality
    const technology = text(value.technology).trim()
    if (technology !== '') edge.technology = technology
    const description = text(value.description).trim()
    if (description !== '') edge.description = description
    edges.push(edge)
  }
  return edges
}

function letterFor(index) {
  let value = index
  let result = ''
  while (value > 0) {
    value -= 1
    result = String.fromCharCode(65 + (value % 26)) + result
    value = Math.floor(value / 26)
  }
  return result
}

function layerEntries(raw) {
  if (Array.isArray(raw)) return raw
  if (object(raw) !== undefined) {
    return Object.entries(raw).map(([key, value]) => {
      if (typeof value === 'string') return { letter: key, title: value }
      return { letter: key, ...(object(value) ?? {}) }
    })
  }
  return undefined
}

// Layers are a tree rooted at A. Every child layer is anchored to a module in its
// parent layer through parentModuleId. Letters are A..Z then AA, AB, ...; id always
// equals letter. Explicit invalid input is rejected with a readable error instead of
// being dropped silently.
function normalizeLayers(raw, previous) {
  let entries = layerEntries(raw)
  if (entries === undefined && previous?.layers !== undefined) entries = layerEntries(previous.layers)
  if (entries === undefined) entries = []

  const previousByLetter = new Map((previous?.layers ?? []).map(layer => [layer.letter, layer]))
  const explicit = []
  for (const entry of entries) {
    const value = typeof entry === 'string' ? { letter: entry } : object(entry)
    if (value === undefined) throw validationError('layer-entry', '层条目必须是对象。')
    const rawLetter = text(value.letter ?? value.id).trim().toUpperCase()
    if (rawLetter !== '' && !/^[A-Z]+$/u.test(rawLetter)) {
      throw validationError('layer-letter', `层 letter 无效：${rawLetter}（只允许 A-Z）。`)
    }
    explicit.push({ value, letter: rawLetter })
  }

  const seen = new Set()
  for (const entry of explicit) {
    if (entry.letter === '') continue
    if (seen.has(entry.letter)) throw validationError('layer-letter-duplicate', `层 letter 重复：${entry.letter}。`)
    seen.add(entry.letter)
  }

  const rootEntry = explicit.find(entry => entry.letter === 'A')
  if (rootEntry !== undefined && text(rootEntry.value.parentModuleId).trim() !== '') {
    throw validationError('layer-root-parent', '根层 A 的 parentModuleId 必须为 null。')
  }
  const rootTitle = text(rootEntry?.value.title ?? rootEntry?.value.name).trim()
    || text(previousByLetter.get('A')?.title).trim()
    || '总览'
  const layers = [{ id: 'A', letter: 'A', title: rootTitle, parentModuleId: null }]
  const used = new Set(['A'])
  const reserved = new Set(explicit.map(entry => entry.letter).filter(letter => letter !== ''))
  let cursor = 1
  const generateLetter = () => {
    do cursor += 1
    while (used.has(letterFor(cursor)) || reserved.has(letterFor(cursor)))
    const letter = letterFor(cursor)
    used.add(letter)
    return letter
  }

  for (const { value, letter } of explicit) {
    if (letter === 'A') continue
    const finalLetter = letter === '' ? generateLetter() : letter
    used.add(finalLetter)
    const kept = previousByLetter.get(finalLetter)
    const title = text(value.title ?? value.name).trim() || text(kept?.title).trim() || `层 ${finalLetter}`
    const parentRaw = value.parentModuleId === undefined ? kept?.parentModuleId : value.parentModuleId
    const parent = text(parentRaw).trim()
    layers.push({ id: finalLetter, letter: finalLetter, title, parentModuleId: parent === '' ? null : parent })
  }

  if (layers.length > BLUEPRINT_LIMITS.layers) {
    throw limitError(layers.length, BLUEPRINT_LIMITS.layers, '层')
  }
  return layers
}

// Resolve parentModuleId against the normalized modules, turn it into the stable
// module id, then verify cycles and the maximum depth. Finally every module gets its
// canonical parentId (null in root, the layer anchor in a child layer).
function validateLayers(layers, modules) {
  const layerById = new Map(layers.map(layer => [layer.letter, layer]))
  const moduleById = new Map(modules.map(module => [module.id, module]))
  const moduleByCode = new Map(modules.map(module => [module.code, module]))
  const parentLayerOf = new Map()

  for (const layer of layers) {
    if (layer.letter === 'A') {
      layer.parentModuleId = null
      continue
    }
    const rawParent = text(layer.parentModuleId).trim()
    if (rawParent === '') {
      throw validationError('layer-parent-missing', `层 ${layer.letter} 缺少 parentModuleId。`)
    }
    const parent = moduleById.get(rawParent) ?? moduleByCode.get(rawParent.toUpperCase())
    if (parent === undefined) {
      throw validationError('layer-parent-unknown', `层 ${layer.letter} 的 parentModuleId 不存在：${rawParent}。`)
    }
    if (!layerById.has(parent.layerId)) {
      throw validationError('layer-parent-unknown', `层 ${layer.letter} 的父模块 ${parent.id} 不在任何有效层中。`)
    }
    layer.parentModuleId = parent.id
    parentLayerOf.set(layer.letter, parent.layerId)
  }

  const depth = new Map([['A', 1]])
  const visiting = new Set()
  const resolveDepth = id => {
    if (depth.has(id)) return depth.get(id)
    if (visiting.has(id)) {
      throw validationError('layer-cycle', `层级存在环：${[...visiting, id].join(' → ')}。`)
    }
    visiting.add(id)
    const parent = parentLayerOf.get(id)
    if (parent === undefined) {
      throw validationError('layer-parent-missing', `层 ${id} 无法确定父层。`)
    }
    const value = resolveDepth(parent) + 1
    visiting.delete(id)
    if (value > BLUEPRINT_LIMITS.depth) {
      throw validationError('layer-depth', `层级深度超过 ${BLUEPRINT_LIMITS.depth} 层：${id}（深度 ${value}）。`)
    }
    depth.set(id, value)
    return value
  }

  for (const layer of layers) if (layer.letter !== 'A') resolveDepth(layer.letter)
  for (const module of modules) {
    module.parentId = layerById.get(module.layerId)?.parentModuleId ?? null
  }
}

function parseDiagramIdentity(value) {
  const rawKey = text(value?.key).trim()
  let layerId = text(value?.layerId ?? value?.layer).trim().toUpperCase()
  let type = text(value?.type).trim().toLowerCase()
  if (rawKey.includes(':')) {
    const index = rawKey.indexOf(':')
    if (layerId === '') layerId = rawKey.slice(0, index).trim().toUpperCase()
    if (type === '') type = rawKey.slice(index + 1).trim().toLowerCase()
  } else if (rawKey !== '' && type === '') {
    type = rawKey.toLowerCase()
  }
  if (layerId === '') layerId = 'A'
  return { layerId, type }
}

function diagramKeyOf(layerId, type) {
  return layerId === 'A' ? type : `${layerId}:${type}`
}

function normalizeDiagrams(raw, previous, layers) {
  const source = Array.isArray(raw)
    ? raw
    : object(raw)
      ? Object.entries(raw).map(([key, value]) => ({ key, ...(object(value) ?? {}) }))
      : undefined
  const layerIds = new Set(layers.map(layer => layer.letter))
  const entries = source ?? previous?.diagrams ?? []

  const identityOf = diagram => {
    const parsed = parseDiagramIdentity(diagram)
    return { ...parsed, key: diagramKeyOf(parsed.layerId, parsed.type) }
  }
  const previousByKey = new Map()
  for (const diagram of previous?.diagrams ?? []) {
    const identity = identityOf(diagram)
    if (DIAGRAM_DEFS.some(def => def.key === identity.type) && !previousByKey.has(identity.key)) {
      previousByKey.set(identity.key, diagram)
    }
  }

  const present = new Set()
  const diagrams = []

  const push = (identity, value) => {
    const def = DIAGRAM_DEFS.find(item => item.key === identity.type)
    if (def === undefined) {
      throw validationError('diagram-type', `图解 type 无效：${identity.type || '(空)'}（必须是 ${DIAGRAM_DEFS.map(item => item.key).join('/')}）。`)
    }
    if (!layerIds.has(identity.layerId)) {
      throw validationError('diagram-layer', `图解 ${identity.key} 的 layerId 不存在：${identity.layerId}。`)
    }
    const key = identity.key
    if (present.has(key)) return
    present.add(key)
    const typeSet = new Set(def.types)
    const rawNodes = value?.nodes
    const flowchart = def.key === 'flowchart'
    const { nodes, labelToId } = normalizeNodes(rawNodes, typeSet, def.defaultType, { flowchart })
    const edges = normalizeEdges(
      value?.edges ?? value?.links,
      nodes,
      labelToId,
      flowchart ? { edgeKinds: FLOWCHART_EDGE_KINDS, defaultKind: FLOWCHART_DEFAULT_EDGE_KIND } : {},
    )
    const kept = previousByKey.get(key)
    const diagram = {
      key,
      layerId: identity.layerId,
      type: identity.type,
      title: text(value?.title, '').trim() || text(kept?.title).trim() || def.title,
      nodes: rawNodes === undefined && kept !== undefined ? kept.nodes : nodes,
      edges: (value?.edges === undefined && value?.links === undefined && kept !== undefined) ? kept.edges : edges,
    }
    const description = text(value?.description).trim() || text(kept?.description).trim()
    if (description !== '') diagram.description = description
    const height = finite(value?.height) ?? finite(kept?.height)
    if (height !== undefined) diagram.height = height
    diagrams.push(diagram)
  }

  for (const entry of entries) {
    const value = object(entry)
    if (value === undefined) continue
    const identity = identityOf(value)
    push(identity, value)
  }

  // Only legacy/untyped inputs keep the fixed eight root slots. An explicit
  // layer/type model may intentionally keep fewer root diagrams (for example a
  // root that only shows the module overview after details move to child layers).
  const explicitLayerModel = entries.some(entry => {
    const value = object(entry)
    if (value === undefined) return false
    return value.layerId !== undefined || value.layer !== undefined || value.type !== undefined || text(value.key) === 'flowchart' || text(value.key).includes(':')
  }) || (Array.isArray(source) && source.length === 0 && (previous?.diagrams ?? []).some(diagram =>
    diagram?.type !== undefined || diagram?.layerId !== undefined || text(diagram?.key).includes(':')))
  if (!explicitLayerModel) {
    for (const def of AUTO_DIAGRAM_DEFS) {
      const key = diagramKeyOf('A', def.key)
      if (present.has(key)) continue
      push({ layerId: 'A', type: def.key, key }, previousByKey.get(key))
    }
  }

  const layerOrder = new Map(layers.map((layer, index) => [layer.letter, index]))
  const typeOrder = new Map(DIAGRAM_DEFS.map((def, index) => [def.key, index]))
  diagrams.sort((left, right) =>
    (layerOrder.get(left.layerId) ?? 99) - (layerOrder.get(right.layerId) ?? 99)
    || (typeOrder.get(left.type) ?? 99) - (typeOrder.get(right.type) ?? 99),
  )
  if (diagrams.length > BLUEPRINT_LIMITS.diagrams) {
    throw limitError(diagrams.length, BLUEPRINT_LIMITS.diagrams, '图实例')
  }
  return diagrams
}

function defaultDiagrams() {
  return AUTO_DIAGRAM_DEFS.map(def => ({ key: def.key, layerId: 'A', type: def.key, title: def.title, nodes: [], edges: [] }))
}

const MODULE_CODE_PATTERN = /^([A-Z]+)([1-9]\d*)$/u

function moduleCode(value, layerId) {
  const match = MODULE_CODE_PATTERN.exec(text(value).trim().toUpperCase())
  if (match === null || match[1] !== layerId) return ''
  return `${match[1]}${match[2]}`
}

function evidenceList(value) {
  if (Array.isArray(value)) return stringList(value)
  const single = text(value).trim()
  return single === '' ? [] : [single]
}

function normalizeVerificationEntry(raw, previous) {
  const value = object(raw)
  const kept = object(previous)
  const wanted = text(value?.status ?? kept?.status).trim().toLowerCase()
  const status = VERIFICATION_STATUS_SET.has(wanted) ? wanted : 'pending'
  const evidence = evidenceList(value?.evidence ?? kept?.evidence)
  const entry = { status, evidence }
  const at = finite(value?.at) ?? finite(kept?.at)
  if (at !== undefined) entry.at = at
  return entry
}

// Missing or malformed verification degrades to three pending roles. Explicit role
// objects inherit omitted fields from the previous verification so a single
// `/blueprint verify` update never erases the other layers' evidence.
export function normalizeVerification(raw, previous) {
  const value = object(raw)
  const kept = object(previous)
  const verification = {}
  for (const role of VERIFICATION_ROLES) {
    verification[role] = normalizeVerificationEntry(value?.[role] ?? kept?.[role], kept?.[role])
  }
  return verification
}

export function verificationComplete(verification) {
  return VERIFICATION_ROLES.every(role => {
    const status = text(object(verification)?.[role]?.status).toLowerCase()
    return status === 'passed'
  })
}

export function verificationFailed(verification) {
  return VERIFICATION_ROLES.some(role => text(object(verification)?.[role]?.status).toLowerCase() === 'failed')
}

// Aggregation never promotes a module to done unless all three layers passed; a
// single failed layer wins over everything else and forces rework.
export function moduleStatusAfterVerification(status, verification) {
  if (verificationFailed(verification)) return MODULE_STATUS_NEEDS_REWORK
  if (verificationComplete(verification)) return 'done'
  return text(status, '').trim() || 'pending'
}

// Apply one `/blueprint verify` result to a normalized blueprint in memory. The
// caller is responsible for archiving and writing the file. Evidence is append-only
// so retries and review notes keep their audit trail.
export function recordModuleVerification(blueprint, input = {}) {
  const moduleId = text(input.moduleId).trim()
  const role = text(input.role).trim().toLowerCase()
  const status = text(input.status).trim().toLowerCase()
  const evidence = text(input.evidence).trim()
  if (moduleId === '') {
    return { ok: false, code: 'module-required', message: '缺少模块 id。用法：/blueprint verify <moduleId> <tests|reviewer|human> <passed|failed|pending> [evidence]' }
  }
  const modules = Array.isArray(blueprint?.modules) ? blueprint.modules : []
  const module = modules.find(item => text(item?.id) === moduleId)
  if (module === undefined) {
    return { ok: false, code: 'module-unknown', message: `模块不存在：${moduleId}。` }
  }
  if (!VERIFICATION_ROLES.includes(role)) {
    return { ok: false, code: 'role', message: `验证角色无效：${role || '(空)'}（必须是 ${VERIFICATION_ROLES.join('/')}）。` }
  }
  if (!VERIFICATION_STATUS_SET.has(status)) {
    return { ok: false, code: 'status', message: `验证状态无效：${status || '(空)'}（必须是 ${VERIFICATION_STATUSES.join('/')}）。` }
  }

  const verification = normalizeVerification(module.verification)
  const entry = verification[role]
  entry.status = status
  if (evidence !== '' && !entry.evidence.includes(evidence)) entry.evidence.push(evidence)
  entry.at = Number.isFinite(input.at) ? input.at : Date.now()
  module.verification = verification
  module.status = moduleStatusAfterVerification(module.status, verification)
  return {
    ok: true,
    moduleId: module.id,
    role,
    status,
    moduleStatus: module.status,
    evidence: [...entry.evidence],
    at: entry.at,
    verification,
  }
}

// Mounts are stored in document order. Ids are the stable merge key, so malformed
// or duplicate ids are dropped instead of silently renamed (a rename would break
// module.mountIds). Unknown extra fields are preserved for forward compatibility.
function normalizeMounts(raw, previous) {
  const source = Array.isArray(raw)
    ? raw
    : object(raw)
      ? Object.entries(raw).map(([id, value]) => ({ id, ...(object(value) ?? {}) }))
      : undefined
  let entries = source
  if (entries === undefined && Array.isArray(previous?.mounts)) entries = previous.mounts
  if (entries === undefined) entries = []

  const mounts = []
  const used = new Set()
  for (const entry of entries) {
    const value = object(entry)
    if (value === undefined) continue
    const id = text(value.id).trim()
    if (!MOUNT_ID_PATTERN.test(id) || used.has(id)) continue
    used.add(id)
    const rawKind = text(value.kind).toLowerCase()
    const kind = MOUNT_KINDS.includes(rawKind) ? rawKind : 'working'
    const rawAccess = text(value.access).toLowerCase()
    const access = MOUNT_ACCESS.includes(rawAccess) ? rawAccess : 'rw'
    const mount = {
      id,
      label: text(value.label).trim(),
      root: text(value.root).trim(),
      kind,
      access,
      // An explicit ro, an explicit readOnly:true, and non-working mounts all
      // derive a read-only mount. access keeps the declared value for display.
      readOnly: access === 'ro' || value.readOnly === true || kind !== 'working',
    }
    const vcs = text(value.vcs).toLowerCase()
    if (MOUNT_VCS.includes(vcs)) mount.vcs = vcs
    const ref = text(value.ref).trim()
    if (ref !== '') mount.ref = ref
    const checksum = text(value.checksum).trim()
    if (checksum !== '') mount.checksum = checksum
    const notes = text(value.notes).trim()
    if (notes !== '') mount.notes = notes
    for (const [key, extra] of Object.entries(value)) {
      if (!MOUNT_FIELD_NAMES.has(key)) mount[key] = extra
    }
    mounts.push(mount)
  }
  if (mounts.length > BLUEPRINT_LIMITS.mounts) {
    throw limitError(mounts.length, BLUEPRINT_LIMITS.mounts, '挂载')
  }
  return mounts
}

// workspaceSnapshot maps a mount id to a ref/checksum/commit captured when the
// blueprint was written. Only string values are kept; an explicit empty object
// clears the map while an omitted field inherits the previous snapshot.
function normalizeWorkspaceSnapshot(raw, previous) {
  const source = object(raw) ?? object(previous?.workspaceSnapshot)
  if (source === undefined) return undefined
  const snapshot = {}
  for (const [key, value] of Object.entries(source)) {
    const mountId = text(key).trim()
    const captured = text(value).trim()
    if (mountId === '' || captured === '') continue
    snapshot[mountId] = captured
  }
  return Object.keys(snapshot).length === 0 ? undefined : snapshot
}

// The execution ledger is normalized permissive-but-stable: a valid id is kept
// verbatim (it is the diff/merge identity), dangling module and mount references
// are preserved for the self-check to report, and malformed records degrade to
// safe defaults instead of disappearing. Unknown fields survive for forward
// compatibility. Evidence is capped at the most recent RUN_EVIDENCE_LIMIT items.
function normalizeRunEvidence(raw, now) {
  const list = Array.isArray(raw) ? raw : []
  const evidence = []
  for (const entry of list) {
    const value = object(entry)
    if (value === undefined) continue
    const body = clipped(value.text, RUN_EVIDENCE_TEXT_LIMIT)
    if (body === '') continue
    const item = { at: finite(value.at) ?? now, text: body }
    const kind = clipped(value.kind, RUN_EVIDENCE_KIND_LIMIT)
    if (kind !== '') item.kind = kind
    evidence.push(item)
  }
  return evidence.length > BLUEPRINT_LIMITS.runEvidence
    ? evidence.slice(-BLUEPRINT_LIMITS.runEvidence)
    : evidence
}

function normalizeRunSnapshot(raw) {
  const source = object(raw)
  if (source === undefined) return undefined
  const snapshot = {}
  for (const [key, value] of Object.entries(source)) {
    const mountId = clipped(key, RUN_ID_LIMIT)
    const captured = clipped(value)
    if (mountId === '' || captured === '') continue
    snapshot[mountId] = captured
  }
  return Object.keys(snapshot).length === 0 ? undefined : snapshot
}

function normalizeRunRollback(raw) {
  const value = object(raw)
  if (value === undefined) return undefined
  return {
    // A rollback plan is always advisory; the Host never executes it automatically.
    instructions: stringList(value.instructions).slice(0, RUN_LIST_LIMIT),
    auto: false,
  }
}

function normalizeRun(entry, used, now) {
  const value = object(entry)
  if (value === undefined) return undefined
  const wanted = clipped(value.id, RUN_ID_LIMIT)
  const id = unique(wanted || `run-${now.toString(36)}`, used)
  const statusRaw = text(value.status).trim().toLowerCase()
  const adapterRaw = text(value.adapter).trim().toLowerCase()
  const run = {
    id,
    moduleId: clipped(value.moduleId, RUN_ID_LIMIT),
    mountIds: stringList(value.mountIds),
    adapter: RUN_ADAPTER_SET.has(adapterRaw) ? adapterRaw : 'manual',
    status: RUN_STATUS_SET.has(statusRaw) ? statusRaw : 'running',
    startedAt: finite(value.startedAt) ?? now,
    evidence: normalizeRunEvidence(value.evidence, now),
  }
  const claimedBy = clipped(value.claimedBy, RUN_ID_LIMIT)
  if (claimedBy !== '') run.claimedBy = claimedBy
  const leaseUntil = finite(value.leaseUntil)
  if (leaseUntil !== undefined) run.leaseUntil = leaseUntil
  const endedAt = finite(value.endedAt)
  if (endedAt !== undefined) run.endedAt = endedAt
  const baseSnapshot = normalizeRunSnapshot(value.baseSnapshot)
  if (baseSnapshot !== undefined) run.baseSnapshot = baseSnapshot
  const decisions = stringList(value.decisions).slice(0, RUN_LIST_LIMIT)
  if (decisions.length > 0) run.decisions = decisions
  const nextAction = clipped(value.nextAction)
  if (nextAction !== '') run.nextAction = nextAction
  const error = clipped(value.error)
  if (error !== '') run.error = error
  const rollback = normalizeRunRollback(value.rollback)
  if (rollback !== undefined) run.rollback = rollback
  for (const [key, extra] of Object.entries(value)) {
    if (RUN_FIELD_NAMES.has(key) || key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    run[key] = extra
  }
  return run
}

function normalizeRuns(raw, previous, now = Date.now()) {
  let entries
  if (Array.isArray(raw)) entries = raw
  else if (raw === undefined && Array.isArray(previous?.runs)) entries = previous.runs
  else entries = []

  const used = new Set()
  const runs = []
  for (const entry of entries) {
    const run = normalizeRun(entry, used, now)
    if (run !== undefined) runs.push(run)
  }
  if (runs.length > BLUEPRINT_LIMITS.runs) {
    throw limitError(runs.length, BLUEPRINT_LIMITS.runs, '执行记录')
  }
  return runs
}

// execution describes how a module is dispatched. The adapter defaults to the
// in-harness subagent only when an execution object actually exists; omitted
// execution stays undefined so old blueprints keep their shape.
function normalizeExecution(raw) {
  const value = object(raw)
  if (value === undefined) return undefined
  const rawAdapter = text(value.adapter).toLowerCase()
  const execution = {
    adapter: EXECUTION_ADAPTERS.includes(rawAdapter) ? rawAdapter : 'dsh-subagent',
    allow: stringList(value.allow ?? value.allows),
    commands: stringList(value.commands ?? value.cmd),
  }
  const cwd = text(value.cwd).trim()
  if (cwd !== '') execution.cwd = cwd
  const agentProfile = text(value.agentProfile).trim()
  if (agentProfile !== '') execution.agentProfile = agentProfile
  const endpointRef = text(value.endpointRef).trim()
  if (endpointRef !== '') execution.endpointRef = endpointRef
  const storage = object(value.storage)
  if (storage !== undefined) {
    const rawKind = text(storage.kind).toLowerCase()
    const normalized = { kind: EXECUTION_STORAGE_KINDS.includes(rawKind) ? rawKind : 'fs' }
    const ref = text(storage.ref).trim()
    if (ref !== '') normalized.ref = ref
    execution.storage = normalized
  }
  return execution
}

function normalizeModules(raw, previous, sections, layers) {
  const source = Array.isArray(raw)
    ? raw
    : object(raw)
      ? Object.entries(raw).map(([key, value]) => ({ id: key, ...(object(value) ?? {}) }))
      : undefined

  let entries = source
  if (entries === undefined) {
    const section = sections.find(item => item.key === 'modules')
    if (section !== undefined) entries = section.items.map(item => ({ name: item.text }))
  }
  if (entries === undefined && previous?.modules !== undefined) entries = previous.modules

  const previousById = new Map((previous?.modules ?? []).map(module => [module.id, module]))
  const layerIds = new Set(layers.map(layer => layer.letter))
  const used = new Set()
  const byName = new Map()
  const modules = []
  const pendingDeps = []
  const pendingCodes = []
  const usedCodes = new Set()
  const maxByLayer = new Map()

  for (const existing of previous?.modules ?? []) {
    const match = MODULE_CODE_PATTERN.exec(text(existing.code).trim().toUpperCase())
    if (match === null) continue
    maxByLayer.set(match[1], Math.max(maxByLayer.get(match[1]) ?? 0, Number(match[2])))
  }

  for (const entry of entries ?? []) {
    const value = object(entry)
    if (value === undefined) continue
    const name = text(value.name ?? value.title ?? value.label).trim()
    if (name === '') continue
    const id = unique(text(value.id) || slug(name, 'module'), used)
    const kept = previousById.get(id)
    const explicitLayer = text(value.layerId ?? value.layer).trim().toUpperCase()
    let layerId
    if (explicitLayer !== '') {
      if (!layerIds.has(explicitLayer)) {
        throw validationError('module-layer', `模块 ${name} 的 layerId 不存在：${explicitLayer}。`)
      }
      layerId = explicitLayer
    } else if (kept?.layerId !== undefined && layerIds.has(kept.layerId)) {
      layerId = kept.layerId
    } else {
      layerId = 'A'
    }
    const mountIds = stringList(value.mountIds === undefined ? kept?.mountIds : value.mountIds)
    if (mountIds.length > BLUEPRINT_LIMITS.moduleMounts) {
      throw limitError(mountIds.length, BLUEPRINT_LIMITS.moduleMounts, `模块 ${name} 的挂载引用`)
    }
    const execution = normalizeExecution(value.execution === undefined ? kept?.execution : value.execution)
    const module = {
      id,
      name,
      summary: text(value.summary ?? value.description ?? value.scope).trim() || kept?.summary || '',
      layerId,
      code: '',
      parentId: null,
      dependsOn: [],
      nodeIds: stringList(value.nodeIds === undefined ? kept?.nodeIds : value.nodeIds),
      files: stringList(value.files === undefined ? kept?.files : value.files),
      acceptance: stringList(value.acceptance === undefined ? kept?.acceptance : value.acceptance),
      mountIds,
      ...(execution === undefined ? {} : { execution }),
      status: text(value.status, '') || kept?.status || 'pending',
    }
    module.verification = normalizeVerification(
      value.verification === undefined ? kept?.verification : value.verification,
      kept?.verification,
    )
    module.status = moduleStatusAfterVerification(module.status, module.verification)
    if (kept?.subagentSessionId !== undefined) module.subagentSessionId = kept.subagentSessionId
    const assigned = text(value.subagentSessionId).trim()
    if (assigned !== '') module.subagentSessionId = assigned
    modules.push(module)

    const explicitCode = moduleCode(text(value.code), layerId)
    const keptCode = moduleCode(text(kept?.code), layerId)
    const candidate = explicitCode || keptCode
    pendingCodes.push({ module, candidate })
    if (candidate !== '') {
      const match = MODULE_CODE_PATTERN.exec(candidate)
      maxByLayer.set(match[1], Math.max(maxByLayer.get(match[1]) ?? 0, Number(match[2])))
    }

    byName.set(name.toLowerCase(), id)
    byName.set(id.toLowerCase(), id)
    const deps = Array.isArray(value.dependsOn) ? value.dependsOn : Array.isArray(value.deps) ? value.deps : []
    pendingDeps.push({ module, deps })
  }

  // Preserve every still-valid explicit or previous code first, then allocate new
  // codes above the highest number ever used in the layer. A conflict never creates a
  // duplicate: the later module is simply assigned the next free number.
  for (const entry of pendingCodes) {
    if (entry.candidate !== '' && !usedCodes.has(entry.candidate)) {
      entry.module.code = entry.candidate
      usedCodes.add(entry.candidate)
    }
  }
  for (const entry of pendingCodes) {
    if (entry.module.code !== '') continue
    const layerId = entry.module.layerId
    let sequence = maxByLayer.get(layerId) ?? 0
    do sequence += 1
    while (usedCodes.has(`${layerId}${sequence}`))
    entry.module.code = `${layerId}${sequence}`
    usedCodes.add(entry.module.code)
    maxByLayer.set(layerId, sequence)
  }
  for (const module of modules) byName.set(module.code.toLowerCase(), module.id)

  for (const { module, deps } of pendingDeps) {
    const resolved = []
    for (const dep of deps) {
      const id = byName.get(text(dep).trim().toLowerCase())
      if (id !== undefined && id !== module.id && !resolved.includes(id)) resolved.push(id)
    }
    module.dependsOn = resolved
  }
  if (modules.length > BLUEPRINT_LIMITS.modules) {
    throw limitError(modules.length, BLUEPRINT_LIMITS.modules, '模块')
  }
  return modules
}

// A source is already written in the v2 layered shape when it names layers or carries
// at least one layerId/code/uid/type marker. This keeps brand-new blueprints from being
// stamped with migratedFrom while still flagging genuinely old documents.
function hasLayeredFields(source) {
  const layers = layerEntries(source.layers)
  if (layers !== undefined && layers.length > 0) return true
  if (Array.isArray(source.modules)) {
    if (source.modules.some(module => object(module) !== undefined
      && (text(module.layerId).trim() !== '' || text(module.code).trim() !== ''))) return true
  }
  if (Array.isArray(source.diagrams)) {
    if (source.diagrams.some(diagram => object(diagram) !== undefined
      && (text(diagram.layerId).trim() !== ''
        || text(diagram.type).trim() !== ''
        || text(diagram.key).includes(':')))) return true
  }
  if (Array.isArray(source.sections)) {
    for (const section of source.sections) {
      const value = object(section)
      if (value === undefined || !Array.isArray(value.items)) continue
      if (value.items.some(item => object(item) !== undefined
        && (text(item.uid).trim() !== '' || text(item.code).trim() !== ''))) return true
    }
  }
  return false
}

export function normalizeBlueprint(input, previous, context = {}) {
  const source = object(input) ?? {}
  const base = object(previous) ?? {}
  const now = Date.now()
  const sections = normalizeSections(source.sections ?? source.requirements, base)
  const layers = normalizeLayers(source.layers, base)
  const modules = normalizeModules(source.modules, base, sections, layers)
  const mounts = normalizeMounts(source.mounts, base)
  const workspaceSnapshot = normalizeWorkspaceSnapshot(source.workspaceSnapshot, base)
  // The ledger always exists on a normalized blueprint; old blueprints gain an
  // empty array without any new self-check warning.
  const runs = normalizeRuns(source.runs, base, now)
  validateLayers(layers, modules)
  const diagrams = normalizeDiagrams(source.diagrams ?? source.charts, base, layers)
  // Guarantee the traceability fields exist on every normalized node/module, including
  // those reused from a previous raw blueprint on partial updates.
  for (const diagram of diagrams) {
    for (const node of diagram.nodes ?? []) node.requirementIds = stringList(node.requirementIds)
  }
  for (const module of modules) {
    module.nodeIds = stringList(module.nodeIds)
    module.files = stringList(module.files)
    module.acceptance = stringList(module.acceptance)
  }
  const requirementCount = sections.reduce((sum, section) => sum + section.items.length, 0)
  if (requirementCount > BLUEPRINT_LIMITS.requirements) {
    throw limitError(requirementCount, BLUEPRINT_LIMITS.requirements, '需求条目')
  }
  const status = STATUSES.has(text(source.status)) ? text(source.status) : base.status ?? 'draft'

  const sourceVersion = finite(source.version)
  const baseVersion = finite(base.version)
  const hasNewModelFields = hasLayeredFields(source)
  const hasSourceData = source.modules !== undefined
    || source.diagrams !== undefined
    || source.charts !== undefined
    || source.sections !== undefined
    || source.requirements !== undefined
  const legacy = sourceVersion !== undefined
    ? sourceVersion < BLUEPRINT_VERSION
    : baseVersion !== undefined
      ? baseVersion < BLUEPRINT_VERSION
      : hasSourceData && !hasNewModelFields
  const migratedFrom = finite(source.migratedFrom) ?? finite(base.migratedFrom) ?? (legacy ? 1 : undefined)

  const blueprint = {
    version: BLUEPRINT_VERSION,
    ...(migratedFrom !== undefined ? { migratedFrom } : {}),
    id: text(base.id) || text(source.id) || `bp-${now.toString(36)}`,
    sessionId: context.sessionId ?? base.sessionId ?? (text(source.sessionId) || undefined),
    title: text(source.title, '').trim() || base.title || '工程蓝图',
    summary: text(source.summary, '').trim() || base.summary || '',
    prompt: text(source.prompt ?? source.request, '').trim() || base.prompt || '',
    status,
    layers,
    sections,
    diagrams,
    modules,
    mounts,
    runs,
    ...(workspaceSnapshot === undefined ? {} : { workspaceSnapshot }),
    createdAt: base.createdAt ?? finite(source.createdAt) ?? now,
    updatedAt: now,
  }
  return blueprint
}

function diagramEntries(raw) {
  if (Array.isArray(raw)) return raw
  if (object(raw) !== undefined) {
    return Object.entries(raw).map(([key, value]) => ({ key, ...(object(value) ?? {}) }))
  }
  return undefined
}

function removalRefs(value) {
  return stringList(value)
}

// A removal ref is either a bare id (applies to every diagram) or
// "<diagramKey>:<id>", where a child diagram key itself contains a colon
// ("B:dfd:n1"). Ids stay case-sensitive to match stable node/edge ids.
function isRemoved(diagramKey, id, refs) {
  if (id === undefined || refs.length === 0) return false
  const key = text(diagramKey)
  for (const ref of refs) {
    if (ref === id) return true
    if (ref.startsWith(`${key}:`) && ref.slice(key.length + 1) === id) return true
  }
  return false
}

function edgeResolver(nodes) {
  const ids = new Set(nodes.map(node => node.id))
  const labelToId = new Map()
  for (const node of nodes) {
    if (typeof node.label === 'string' && node.label !== '') labelToId.set(node.label.toLowerCase(), node.id)
  }
  return value => {
    const key = text(value).trim()
    if (key === '') return undefined
    if (ids.has(key)) return key
    return labelToId.get(key.toLowerCase())
  }
}

function mergeNodeList(baseNodes, patchNodes, diagramKey, removedNodes) {
  const merged = baseNodes.map(node => ({ ...node }))
  const byId = new Map(merged.map((node, index) => [node.id, index]))
  const appended = []
  for (const entry of Array.isArray(patchNodes) ? patchNodes : []) {
    const value = object(entry)
    if (value === undefined) continue
    const id = text(value.id).trim()
    if (id !== '' && byId.has(id)) {
      const index = byId.get(id)
      // Shallow merge: patch fields win, omitted fields (notably x/y/w/h and
      // requirementIds) keep their previous values.
      merged[index] = { ...merged[index], ...value, id: merged[index].id }
      continue
    }
    appended.push({ ...value })
  }
  return [...merged, ...appended].filter(node => !isRemoved(diagramKey, node.id, removedNodes))
}

function mergeEdgeList(baseEdges, patchEdges, nodes, diagramKey, removedEdges) {
  const merged = baseEdges.map(edge => ({ ...edge }))
  const resolve = edgeResolver(nodes)
  const byId = new Map(merged.map((edge, index) => [edge.id, index]))
  const matched = new Set()
  const appended = []
  for (const entry of Array.isArray(patchEdges) ? patchEdges : []) {
    const value = object(entry)
    if (value === undefined) continue
    const from = resolve(value.from ?? value.source ?? value.fromId ?? value.start)
    const to = resolve(value.to ?? value.target ?? value.toId ?? value.end)
    const label = text(value.label ?? value.name ?? value.message).trim()
    const kind = text(value.kind ?? value.type).trim()
    const id = text(value.id).trim()
    let index = -1
    if (id !== '' && byId.has(id) && !matched.has(byId.get(id))) {
      index = byId.get(id)
    }
    if (index < 0 && from !== undefined && to !== undefined) {
      const wanted = edgeKey({ from, to, label, kind })
      index = merged.findIndex((edge, position) => !matched.has(position) && edgeKey(edge) === wanted)
    }
    if (index >= 0) {
      matched.add(index)
      const edge = merged[index]
      merged[index] = { ...edge, ...value, id: edge.id, from: from ?? edge.from, to: to ?? edge.to }
      continue
    }
    appended.push({ ...value })
  }
  return [...merged, ...appended].filter(edge => !isRemoved(diagramKey, edge.id, removedEdges))
}

function mergeDiagramIdentity(value) {
  const parsed = parseDiagramIdentity(value)
  return { ...parsed, key: diagramKeyOf(parsed.layerId, parsed.type) }
}

function mergeDiagram(base, patchValue, rootRemovals, identity) {
  const value = object(patchValue) ?? {}
  const key = identity.key
  const removedNodes = [...rootRemovals.nodes, ...removalRefs(value.removedNodeIds)]
  const removedEdges = [...rootRemovals.edges, ...removalRefs(value.removedEdgeIds)]
  const baseNodes = Array.isArray(base?.nodes) ? base.nodes : []
  const baseEdges = Array.isArray(base?.edges) ? base.edges : []

  const nodes = value.nodes === undefined
    ? baseNodes.map(node => ({ ...node })).filter(node => !isRemoved(key, node.id, removedNodes))
    : mergeNodeList(baseNodes, value.nodes, key, removedNodes)
  const edges = value.edges === undefined && value.links === undefined
    ? baseEdges.map(edge => ({ ...edge })).filter(edge => !isRemoved(key, edge.id, removedEdges))
    : mergeEdgeList(baseEdges, value.edges ?? value.links, nodes, key, removedEdges)

  return {
    ...(base ?? {}),
    ...value,
    key,
    layerId: identity.layerId,
    type: identity.type,
    nodes,
    edges,
  }
}

// Align diagrams by layerId:type rather than by the display key so root diagrams keep
// their legacy keys while child-layer diagrams ("B:dfd") merge into their own slot.
// Diagrams omitted from the patch are retained, which means an update never drops a
// child layer's diagrams.
function mergeModuleList(baseModules, patchRaw, removedModuleIds) {
  const base = Array.isArray(baseModules) ? baseModules : []
  const patchList = Array.isArray(patchRaw)
    ? patchRaw
    : object(patchRaw)
      ? Object.entries(patchRaw).map(([id, value]) => ({ id, ...(object(value) ?? {}) }))
      : []
  const baseById = new Map()
  for (const module of base) {
    const id = text(module?.id)
    if (id !== '') baseById.set(id, module)
  }
  const removed = new Set(removedModuleIds.map(value => text(value).trim()).filter(Boolean))
  const present = new Set()
  const merged = []
  for (const entry of patchList) {
    const value = object(entry)
    if (value === undefined) continue
    const id = text(value.id)
    if (id === '' || present.has(id) || removed.has(id)) continue
    present.add(id)
    const previous = baseById.get(id)
    merged.push(previous === undefined ? value : { ...previous, ...value })
  }
  for (const module of base) {
    const id = text(module?.id)
    if (id === '' || present.has(id) || removed.has(id)) continue
    present.add(id)
    merged.push(module)
  }
  return merged
}

// Mounts merge by stable id like modules: an omitted mounts field retains the
// previous list, listed ids are patched in place, new ids are appended, and
// removedMountIds performs an explicit deletion.
function mergeMountList(baseMounts, patchRaw, removedMountIds = [], patchProvided = false) {
  const base = Array.isArray(baseMounts) ? baseMounts : []
  const patchList = Array.isArray(patchRaw)
    ? patchRaw
    : object(patchRaw)
      ? Object.entries(patchRaw).map(([id, value]) => ({ id, ...(object(value) ?? {}) }))
      : []
  // An explicitly submitted empty mounts list clears the workspace map, while an
  // omitted field retains it; removedMountIds keeps supporting partial deletion.
  const clearBase = patchProvided && patchList.length === 0
  const baseById = new Map()
  for (const mount of base) {
    const id = text(mount?.id).trim()
    if (id !== '') baseById.set(id, mount)
  }
  const removed = new Set(removedMountIds.map(value => text(value).trim()).filter(Boolean))
  const present = new Set()
  const merged = []
  for (const entry of patchList) {
    const value = object(entry)
    if (value === undefined) continue
    const id = text(value.id).trim()
    if (id === '' || present.has(id) || removed.has(id)) continue
    present.add(id)
    const previous = baseById.get(id)
    merged.push(previous === undefined ? value : { ...previous, ...value })
  }
  if (clearBase) return merged
  for (const mount of base) {
    const id = text(mount?.id).trim()
    if (id === '' || present.has(id) || removed.has(id)) continue
    present.add(id)
    merged.push(mount)
  }
  return merged
}

function mergeLayerList(baseLayers, patchRaw, removedLayerIds) {
  const base = Array.isArray(baseLayers) ? baseLayers : []
  const patchList = layerEntries(patchRaw) ?? []
  const baseByLetter = new Map()
  for (const layer of base) {
    const letter = text(layer?.letter ?? layer?.id).trim().toUpperCase()
    if (letter !== '') baseByLetter.set(letter, layer)
  }
  const removed = new Set(removedLayerIds.map(value => text(value).trim().toUpperCase()).filter(Boolean))
  const present = new Set()
  const merged = []
  for (const entry of patchList) {
    const value = typeof entry === 'string' ? { letter: entry } : object(entry)
    if (value === undefined) continue
    const letter = text(value.letter ?? value.id).trim().toUpperCase()
    if (letter === '' || present.has(letter) || removed.has(letter)) continue
    present.add(letter)
    const previous = baseByLetter.get(letter)
    merged.push(previous === undefined ? value : { ...previous, ...value })
  }
  for (const layer of base) {
    const letter = text(layer?.letter ?? layer?.id).trim().toUpperCase()
    if (letter === '' || present.has(letter) || removed.has(letter)) continue
    present.add(letter)
    merged.push(layer)
  }
  return merged
}

function mergeDiagrams(baseDiagrams, patchRaw, rootRemovals, removedDiagramKeys = []) {
  const base = Array.isArray(baseDiagrams) ? baseDiagrams : []
  const removed = new Set(removedDiagramKeys.map(value => text(value).trim()).filter(Boolean))
  const patchList = diagramEntries(patchRaw) ?? []
  const baseByKey = new Map()
  for (const diagram of base) {
    const identity = mergeDiagramIdentity(diagram)
    if (!baseByKey.has(identity.key)) baseByKey.set(identity.key, diagram)
  }
  const present = new Set()
  const merged = []
  for (const entry of patchList) {
    const value = object(entry)
    if (value === undefined) continue
    const identity = mergeDiagramIdentity(value)
    if (present.has(identity.key) || removed.has(identity.key)) continue
    present.add(identity.key)
    merged.push(mergeDiagram(baseByKey.get(identity.key), value, rootRemovals, identity))
  }
  for (const diagram of base) {
    const identity = mergeDiagramIdentity(diagram)
    if (present.has(identity.key) || removed.has(identity.key)) continue
    present.add(identity.key)
    merged.push(rootRemovals.nodes.length === 0 && rootRemovals.edges.length === 0
      ? diagram
      : mergeDiagram(diagram, {}, rootRemovals, identity))
  }
  return merged
}

// Trust boundary: an agent `update` patch must not fabricate verification results.
// Verification state is carried from the previous module by id; any verification
// supplied in the patch is discarded (a brand-new module starts at three pending).
// `create` intentionally bypasses this guard because it replaces the whole blueprint.
function guardModuleVerification(patch, base) {
  const modules = patch.modules
  const previousById = new Map(
    (Array.isArray(base?.modules) ? base.modules : []).map(module => [text(module?.id), module]),
  )
  const keep = (id, value) => ({ ...value, verification: previousById.get(text(id))?.verification })
  if (Array.isArray(modules)) {
    return {
      ...patch,
      modules: modules.map(entry => {
        const value = object(entry)
        return value === undefined ? entry : keep(value.id, value)
      }),
    }
  }
  if (object(modules) !== undefined) {
    const guarded = {}
    for (const [key, value] of Object.entries(modules)) {
      const record = object(value)
      guarded[key] = record === undefined ? value : keep(record.id ?? key, record)
    }
    return { ...patch, modules: guarded }
  }
  return patch
}

// Merge an agent `update` patch into the current blueprint without discarding
// hand edits: sections follow normalizeSections semantics (omitted item fields
// inherit, explicit empty lists clear), diagrams are aligned by key, and nodes
// and edges are merged by stable id (or the from/to/label/kind edge key).
// `removedNodeIds` / `removedEdgeIds` on a diagram or at the patch root perform
// explicit deletions. `create` and the UI `save` command stay full replacements.
export function mergeBlueprintForUpdate(previous, patch, context = {}) {
  const base = object(previous)
  const update = object(patch) ?? {}
  const guarded = guardModuleVerification(update, base)
  const merged = { ...(base ?? {}), ...guarded }
  // Trust boundary: the execution ledger is Host-owned. An agent `update` patch can
  // never seed, alter, delete or forge a run; only the previous ledger survives.
  if (base !== undefined) merged.runs = Array.isArray(base.runs) ? base.runs : []
  else delete merged.runs
  const rootRemovals = {
    nodes: removalRefs(update.removedNodeIds),
    edges: removalRefs(update.removedEdgeIds),
  }
  const removedDiagramKeys = removalRefs(update.removedDiagramKeys)
  if (update.layers !== undefined || removalRefs(update.removedLayerIds).length > 0) {
    merged.layers = mergeLayerList(base?.layers, guarded.layers ?? update.layers ?? [], removalRefs(update.removedLayerIds))
  }
  if (update.modules !== undefined || removalRefs(update.removedModuleIds).length > 0) {
    merged.modules = mergeModuleList(base?.modules, guarded.modules ?? update.modules ?? [], removalRefs(update.removedModuleIds))
  }
  const removedMountIds = removalRefs(update.removedMountIds)
  if (update.mounts !== undefined || removedMountIds.length > 0) {
    merged.mounts = mergeMountList(
      base?.mounts,
      update.mounts ?? [],
      removedMountIds,
      update.mounts !== undefined,
    )
  }
  const patchDiagrams = update.diagrams ?? update.charts
  if (patchDiagrams !== undefined) {
    merged.diagrams = mergeDiagrams(base?.diagrams, patchDiagrams, rootRemovals, removedDiagramKeys)
  } else if (base?.diagrams !== undefined) {
    merged.diagrams = rootRemovals.nodes.length > 0 || rootRemovals.edges.length > 0 || removedDiagramKeys.length > 0
      ? mergeDiagrams(base.diagrams, [], rootRemovals, removedDiagramKeys)
      : base.diagrams
  }
  return normalizeBlueprint(merged, base ?? undefined, context)
}

// Pure dispatch projection for one module. The caller (Host/UI) can hand this
// packet to a subagent launcher without re-deriving mounts, requirements or
// snapshot refs. A dangling mount id is kept in mountIds for traceability but is
// omitted from the resolved mounts list.
export function buildDispatchPacket(blueprint, moduleOrId) {
  const source = object(blueprint) ?? {}
  const modules = Array.isArray(source.modules) ? source.modules : []
  const wanted = typeof moduleOrId === 'string'
    ? moduleOrId.trim()
    : text(object(moduleOrId)?.id).trim()
  if (wanted === '') return undefined
  const module = modules.find(item => text(item?.id) === wanted)
  if (object(module) === undefined) return undefined

  const mountIds = stringList(module.mountIds)
  const mountsById = new Map()
  for (const mount of Array.isArray(source.mounts) ? source.mounts : []) {
    const id = text(object(mount)?.id).trim()
    if (id !== '' && !mountsById.has(id)) mountsById.set(id, mount)
  }
  const mounts = []
  for (const id of mountIds) {
    const mount = mountsById.get(id)
    if (mount !== undefined) mounts.push(mount)
  }

  const layerId = text(module.layerId) || 'A'
  const layer = (Array.isArray(source.layers) ? source.layers : [])
    .find(entry => text(entry?.letter ?? entry?.id).trim().toUpperCase() === layerId.toUpperCase()) ?? null
  const execution = object(module.execution)

  const requirements = []
  for (const section of Array.isArray(source.sections) ? source.sections : []) {
    const value = object(section)
    if (value === undefined) continue
    const sectionKey = text(value.key)
    for (const item of Array.isArray(value.items) ? value.items : []) {
      const entry = object(item)
      if (entry === undefined || text(entry.moduleId).trim() !== wanted) continue
      const body = text(entry.text ?? entry.label ?? entry.title ?? entry.value).trim()
      if (body === '') continue
      const id = text(entry.id).trim()
      const uid = text(entry.uid).trim() || (sectionKey !== '' && id !== '' ? `${sectionKey}:${id}` : '')
      requirements.push({ uid, text: body })
    }
  }

  const captured = object(source.workspaceSnapshot) ?? {}
  const snapshot = {}
  for (const id of mountIds) {
    const value = text(captured[id]).trim()
    if (value !== '') snapshot[id] = value
  }

  return {
    module: { ...module },
    code: text(module.code),
    layer,
    mounts,
    mountIds,
    cwd: text(execution?.cwd).trim() || text(mounts[0]?.root).trim() || '',
    allow: stringList(execution?.allow),
    commands: stringList(execution?.commands),
    agentProfile: text(execution?.agentProfile).trim(),
    adapter: text(execution?.adapter).trim() || null,
    storage: object(execution?.storage) ?? null,
    requirements,
    acceptance: stringList(module.acceptance),
    dependsOn: stringList(module.dependsOn),
    snapshot,
  }
}

// ---------------------------------------------------------------------------
// Execution ledger helpers (v0.8). All helpers are pure: they never touch the
// filesystem and never mutate the input blueprint; they return a shallow copy of
// the blueprint whose `runs` array is rebuilt. Only the Host command layer writes
// the result (archive previous + atomic write).
// ---------------------------------------------------------------------------

function runList(blueprint) {
  const source = object(blueprint)
  return Array.isArray(source?.runs) ? source.runs : []
}

function runsById(blueprint) {
  const map = new Map()
  for (const run of runList(blueprint)) {
    const id = text(run?.id).trim()
    if (id !== '' && !map.has(id)) map.set(id, run)
  }
  return map
}

function withRuns(blueprint, runs) {
  return { ...(object(blueprint) ?? {}), runs }
}

function mountMapOf(blueprint) {
  const map = new Map()
  for (const mount of Array.isArray(object(blueprint)?.mounts) ? blueprint.mounts : []) {
    const id = text(mount?.id).trim()
    if (id !== '' && !map.has(id)) map.set(id, mount)
  }
  return map
}

function workingRwMountIds(blueprint) {
  const ids = new Set()
  for (const mount of mountMapOf(blueprint).values()) {
    if (mount.kind === 'working' && mount.access === 'rw' && mount.readOnly !== true) ids.add(mount.id)
  }
  return ids
}

// A running run holds its mounts until its finite lease expires. A running record
// without a lease is treated as still active (cannot be proven expired); the
// self-check separately flags expired leases so the Host can clean them up.
function runLeaseActive(run, now) {
  if (text(run?.status).trim().toLowerCase() !== 'running') return false
  const leaseUntil = finite(run.leaseUntil)
  return leaseUntil === undefined ? true : leaseUntil > now
}

// Group every active running claim by working rw mount. Only mounts that resolve
// to a working/rw/read-write entry count: read-only snapshots and archives are
// shared freely between parallel runs.
function collectClaims(blueprint, now, wantedMounts) {
  const writable = workingRwMountIds(blueprint)
  const groups = new Map()
  for (const run of runList(blueprint)) {
    if (!runLeaseActive(run, now)) continue
    const runId = text(run.id).trim()
    const seen = new Set()
    for (const mountId of stringList(run.mountIds)) {
      if (!writable.has(mountId) || seen.has(mountId)) continue
      if (wantedMounts !== undefined && !wantedMounts.has(mountId)) continue
      seen.add(mountId)
      const group = groups.get(mountId)
      const entry = { runId, moduleId: text(run.moduleId).trim() }
      if (group === undefined) groups.set(mountId, [entry])
      else group.push(entry)
    }
  }
  return groups
}

export function claimConflicts(blueprint, options = {}) {
  const now = finite(options.now) ?? Date.now()
  const conflicts = []
  for (const [mountId, entries] of collectClaims(blueprint, now)) {
    if (entries.length < 2) continue
    conflicts.push({
      mountId,
      runIds: entries.map(entry => entry.runId),
      moduleIds: entries.map(entry => entry.moduleId),
    })
  }
  return conflicts.sort((left, right) => left.mountId.localeCompare(right.mountId))
}

function newRunId(blueprint, now) {
  const used = new Set(runList(blueprint).map(run => text(run?.id).trim()).filter(Boolean))
  let id
  do id = `run-${now.toString(36)}-${crypto.randomBytes(3).toString('hex')}`
  while (used.has(id))
  return id
}

function runBaseSnapshot(blueprint, mountIds) {
  const mounts = mountMapOf(blueprint)
  const captured = object(blueprint?.workspaceSnapshot) ?? {}
  const snapshot = {}
  for (const mountId of mountIds) {
    const mount = mounts.get(mountId)
    const value = text(captured[mountId]).trim()
      || text(mount?.ref).trim()
      || text(mount?.checksum).trim()
    if (value !== '') snapshot[mountId] = value
  }
  return snapshot
}

// Start a run for one module. The caller must persist `result.blueprint`; nothing
// is written here. A conflict returns {ok:false} and the original blueprint stays
// untouched, so the command layer can reject without writing a file.
export function startRun(blueprint, input = {}) {
  const source = object(blueprint)
  if (source === undefined) return { ok: false, error: '还没有工程蓝图，无法启动运行。' }
  const moduleId = text(input.moduleId).trim()
  if (moduleId === '') return { ok: false, error: '缺少模块 id，无法启动运行。' }
  const module = (Array.isArray(source.modules) ? source.modules : [])
    .find(entry => text(entry?.id).trim() === moduleId)
  if (module === undefined) return { ok: false, error: `模块不存在：${moduleId}。` }

  const requestedAdapter = text(input.adapter).trim().toLowerCase()
  if (requestedAdapter !== '' && !RUN_ADAPTER_SET.has(requestedAdapter)) {
    return { ok: false, error: `适配器无效：${requestedAdapter}（必须是 ${RUN_ADAPTERS.join('/')}）。` }
  }
  if (runList(source).length >= BLUEPRINT_LIMITS.runs) {
    return { ok: false, error: `执行记录已达上限 ${BLUEPRINT_LIMITS.runs}，请先归档或清理旧记录。` }
  }
  const now = finite(input.now) ?? Date.now()
  const ttlMs = finite(input.ttlMs) !== undefined && input.ttlMs > 0 ? input.ttlMs : RUN_LEASE_MS
  const mountIds = stringList(module.mountIds)
  const conflicts = []
  for (const [mountId, entries] of collectClaims(source, now, new Set(mountIds))) {
    if (entries.length === 0) continue
    conflicts.push({
      mountId,
      runIds: entries.map(entry => entry.runId),
      moduleIds: entries.map(entry => entry.moduleId),
    })
  }
  if (conflicts.length > 0) {
    const described = conflicts
      .sort((left, right) => left.mountId.localeCompare(right.mountId))
      .map(conflict => `挂载 ${conflict.mountId} 已被运行 ${conflict.runIds.join('、')} 占用`)
      .join('；')
    return {
      ok: false,
      error: `同一可写工作挂载上已有未过期的运行：${described}。请等待租约过期或先结束旧运行。`,
      conflicts,
    }
  }

  const adapter = RUN_ADAPTER_SET.has(requestedAdapter)
    ? requestedAdapter
    : RUN_ADAPTER_SET.has(text(module.execution?.adapter).trim().toLowerCase())
      ? text(module.execution.adapter).trim().toLowerCase()
      : 'dsh-subagent'
  const run = {
    id: newRunId(source, now),
    moduleId,
    mountIds,
    adapter,
    status: 'running',
    startedAt: now,
    leaseUntil: now + ttlMs,
    evidence: [],
  }
  const claimedBy = clipped(input.claimedBy, RUN_ID_LIMIT)
  if (claimedBy !== '') run.claimedBy = claimedBy
  const baseSnapshot = runBaseSnapshot(source, mountIds)
  if (Object.keys(baseSnapshot).length > 0) run.baseSnapshot = baseSnapshot
  const runs = [...runList(source), run]
  return { ok: true, blueprint: withRuns(source, runs), run }
}

// Append one evidence entry. Terminal runs are immutable audit records and reject
// new evidence; `blocked` can still collect recovery notes.
export function runEvidence(blueprint, runId, evidenceText, options = {}) {
  const wanted = text(runId).trim()
  const body = clipped(evidenceText, RUN_EVIDENCE_TEXT_LIMIT)
  if (wanted === '') return { ok: false, error: '缺少运行 id，无法追加证据。' }
  if (body === '') return { ok: false, error: '证据文本不能为空。' }
  const existing = runsById(blueprint).get(wanted)
  if (existing === undefined) return { ok: false, error: `执行记录不存在：${wanted}。` }
  if (RUN_TERMINAL_SET.has(text(existing.status).trim().toLowerCase())) {
    return { ok: false, error: `执行记录 ${wanted} 已结束（${existing.status}），不能再追加证据。` }
  }
  const now = finite(options.now) ?? Date.now()
  const item = { at: now, text: body }
  const kind = clipped(options.kind, RUN_EVIDENCE_KIND_LIMIT)
  if (kind !== '') item.kind = kind
  const evidence = [...(Array.isArray(existing.evidence) ? existing.evidence : []), item]
  const run = {
    ...existing,
    evidence: evidence.length > BLUEPRINT_LIMITS.runEvidence
      ? evidence.slice(-BLUEPRINT_LIMITS.runEvidence)
      : evidence,
  }
  const runs = runList(blueprint).map(entry => (text(entry?.id).trim() === wanted ? run : entry))
  return { ok: true, blueprint: withRuns(blueprint, runs), run }
}

// Finish a running/blocked run without ever touching module.verification or
// module.status: a successful run is not a passed verification layer.
export function finishRun(blueprint, runId, options = {}) {
  const wanted = text(runId).trim()
  if (wanted === '') return { ok: false, error: '缺少运行 id，无法结束运行。' }
  const status = text(options.status).trim().toLowerCase()
  if (!RUN_TERMINAL_SET.has(status)) {
    return { ok: false, error: `运行状态无效：${status || '(空)'}（必须是 ${RUN_TERMINAL_STATUSES.join('/')}）。` }
  }
  const existing = runsById(blueprint).get(wanted)
  if (existing === undefined) return { ok: false, error: `执行记录不存在：${wanted}。` }
  if (RUN_TERMINAL_SET.has(text(existing.status).trim().toLowerCase())) {
    return { ok: false, error: `执行记录 ${wanted} 已结束（${existing.status}），不能重复结束。` }
  }
  const now = finite(options.now) ?? Date.now()
  const evidence = Array.isArray(existing.evidence) ? [...existing.evidence] : []
  const summary = clipped(options.summary, RUN_EVIDENCE_TEXT_LIMIT)
  if (summary !== '') evidence.push({ at: now, kind: 'summary', text: summary })
  const run = {
    ...existing,
    status,
    endedAt: now,
    evidence: evidence.length > BLUEPRINT_LIMITS.runEvidence
      ? evidence.slice(-BLUEPRINT_LIMITS.runEvidence)
      : evidence,
  }
  delete run.leaseUntil
  const nextAction = clipped(options.nextAction)
  if (nextAction !== '') run.nextAction = nextAction
  const error = clipped(options.error)
  if (error !== '') run.error = error
  if (run.rollback === undefined) delete run.rollback
  const runs = runList(blueprint).map(entry => (text(entry?.id).trim() === wanted ? run : entry))
  const result = { ok: true, blueprint: withRuns(blueprint, runs), run }
  if (status === 'done' && run.evidence.length === 0) {
    result.warning = 'done 运行没有任何 evidence；建议补充验证证据。'
  }
  return result
}

// Transition running records whose lease has passed to blocked. The Host can then
// decide whether to re-start, cancel or mark them failed; claims are released
// because only `running` runs hold mounts.
export function expireRunLeases(blueprint, options = {}) {
  const source = object(blueprint)
  if (source === undefined) return { ok: false, error: '还没有工程蓝图。' }
  const now = finite(options.now) ?? Date.now()
  const expired = []
  const runs = runList(source).map(run => {
    if (text(run?.status).trim().toLowerCase() !== 'running') return run
    const leaseUntil = finite(run.leaseUntil)
    if (leaseUntil === undefined || leaseUntil >= now) return run
    expired.push(text(run.id).trim())
    return {
      ...run,
      status: 'blocked',
      nextAction: text(run.nextAction).trim() || '租约已过期：确认运行状态后重新 start 或标记失败。',
    }
  })
  return {
    ok: true,
    blueprint: expired.length > 0 ? withRuns(source, runs) : source,
    expired,
    changed: expired.length,
  }
}

// Build an advisory rollback plan. An explicit run.rollback.instructions wins;
// otherwise the plan derives restore targets from the run's baseSnapshot (with a
// mount.ref/checksum fallback). Nothing is executed automatically.
export function rollbackPlanForRun(blueprint, runId) {
  const wanted = text(runId).trim()
  if (wanted === '') return { ok: false, error: '缺少运行 id，无法生成回滚计划。' }
  const run = runsById(blueprint).get(wanted)
  if (run === undefined) return { ok: false, error: `执行记录不存在：${wanted}。` }
  const mounts = mountMapOf(blueprint)
  const baseSnapshot = object(run.baseSnapshot) ?? {}
  const explicit = stringList(run.rollback?.instructions)
  const instructions = explicit.length > 0 ? [...explicit] : []
  if (instructions.length === 0) {
    for (const mountId of stringList(run.mountIds)) {
      const mount = mounts.get(mountId)
      const root = text(mount?.root).trim()
      const where = root === '' ? `挂载 ${mountId}` : `挂载 ${mountId}（${root}）`
      const target = text(baseSnapshot[mountId]).trim()
        || text(mount?.ref).trim()
        || text(mount?.checksum).trim()
      instructions.push(target === ''
        ? `${where} 没有记录 baseSnapshot：检查改动并手动回滚。`
        : `将${where}恢复到 ${target}。`)
    }
    if (instructions.length === 0) {
      const moduleId = text(run.moduleId).trim() || '(未知模块)'
      instructions.push(`检查运行 ${wanted}（模块 ${moduleId}）的 evidence，手动回滚该模块的改动。`)
    }
  }
  return {
    ok: true,
    plan: {
      runId: wanted,
      moduleId: text(run.moduleId).trim(),
      status: text(run.status).trim(),
      auto: false,
      instructions,
      baseSnapshot,
      mountIds: stringList(run.mountIds),
      evidenceCount: Array.isArray(run.evidence) ? run.evidence.length : 0,
    },
  }
}

export function blueprintFileName(sessionId) {
  const safe = text(sessionId, 'session').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
  return `${safe || 'session'}.json`
}

export function blueprintRelativePath(sessionId) {
  return path.posix.join('.dsh', 'blueprints', blueprintFileName(sessionId))
}

export function blueprintAbsolutePath(cwd, sessionId) {
  return path.join(cwd, '.dsh', 'blueprints', blueprintFileName(sessionId))
}

// ---------------------------------------------------------------------------
// Handoff Job Protocol (v0.10). A handoff job is a file-based unit of work for an
// external agent: `prepare` writes handoff.json, the agent writes result.json, and
// `collect` feeds that result back into the Host-owned run ledger. The protocol is
// deliberately advisory (`auto: false`) and never includes secrets.
// ---------------------------------------------------------------------------

function runDirName(sessionId) {
  return `${blueprintFileName(sessionId).replace(/\.json$/u, '')}.runs`
}

export function blueprintRunDirRelative(sessionId, runId) {
  return path.posix.join('.dsh', 'blueprints', runDirName(sessionId), safeRunId(runId))
}

export function blueprintRunDirAbsolute(cwd, sessionId, runId) {
  return path.join(cwd, '.dsh', 'blueprints', runDirName(sessionId), safeRunId(runId))
}

export function blueprintRunHandoffRelative(sessionId, runId) {
  return path.posix.join(blueprintRunDirRelative(sessionId, runId), 'handoff.json')
}

export function blueprintRunHandoffAbsolute(cwd, sessionId, runId) {
  return path.join(blueprintRunDirAbsolute(cwd, sessionId, runId), 'handoff.json')
}

export function blueprintRunResultRelative(sessionId, runId) {
  return path.posix.join(blueprintRunDirRelative(sessionId, runId), 'result.json')
}

export function blueprintRunResultAbsolute(cwd, sessionId, runId) {
  return path.join(blueprintRunDirAbsolute(cwd, sessionId, runId), 'result.json')
}

function handoffResultSchema(runId) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['runId', 'status'],
    properties: {
      runId: { type: 'string', const: runId },
      status: { type: 'string', enum: [...RUN_RESULT_STATUSES] },
      summary: { type: 'string', maxLength: RUN_EVIDENCE_TEXT_LIMIT },
      evidence: {
        type: 'array',
        maxItems: RUN_RESULT_LIMIT,
        items: {
          type: 'object',
          required: ['text'],
          properties: {
            kind: { type: 'string', maxLength: RUN_EVIDENCE_KIND_LIMIT },
            text: { type: 'string', maxLength: RUN_EVIDENCE_TEXT_LIMIT },
          },
        },
      },
      nextAction: { type: 'string', maxLength: RUN_TEXT_LIMIT },
      error: { type: 'string', maxLength: RUN_TEXT_LIMIT },
      changedPaths: { type: 'array', maxItems: 200, items: { type: 'string' } },
      at: { type: 'number' },
    },
  }
}

function mountLine(mount) {
  const root = text(mount?.root).trim() || '（未设置 root）'
  return `${text(mount?.id).trim() || '(mount)'}（${root}，${text(mount?.kind) || 'working'}/${text(mount?.access) || 'rw'}${mount?.readOnly === true ? '，只读' : ''}）`
}

function handoffPromptOf(context) {
  const { runId, moduleId, moduleCode, module, base, requirements, acceptance, resultPath } = context
  const lines = [
    `你是 Blueprint Studio 交接任务的外部 Agent。请完成运行 ${runId} 对应的模块 ${moduleCode}（${moduleId}）。`,
    '',
    `模块：${text(module.name).trim() || moduleCode}`,
    `范围：${text(module.summary).trim() || text(module.description).trim() || '（未填写）'}`,
    `工作目录：${base.cwd || '（未设置；先确认或绑定 working 挂载）'}`,
    `可访问挂载：${base.mounts.length === 0 ? '（没有绑定挂载）' : base.mounts.map(mountLine).join('、')}`,
  ]
  if (stringList(module.dependsOn).length > 0) lines.push(`依赖模块：${stringList(module.dependsOn).join('、')}`)
  if (requirements.length > 0) {
    lines.push('关联需求：', ...requirements.map(item => `- ${item.uid ? `${item.uid} ` : ''}${item.text}`))
  }
  if (acceptance.length > 0) {
    lines.push('验收标准：', ...acceptance.map(item => `- ${item}`))
  }
  if (base.commands.length > 0) {
    lines.push('建议命令（不会自动执行）：', ...base.commands.map(item => `- ${item}`))
  }
  lines.push(
    '',
    `运行 id：${runId}`,
    `结果文件：${resultPath}（相对工作区根目录；只写这一个文件）`,
    '完成后写入 result.json：{ runId, status: "done"|"failed"|"blocked", summary?, evidence?: [{kind?,text}], nextAction?, error?, changedPaths?: [], at? }。',
    `evidence 要求：至少一条可复核的证据（命令、测试结果或文件路径），最多 ${RUN_RESULT_LIMIT} 条；不要只写“已完成”。`,
    '如果被阻塞，写 status:"blocked" 并在 nextAction 说明下一步；不要自行把模块标记为 done。',
    '不要修改蓝图文件，不要伪造 runs，也不要自行填写 tests/reviewer/human 验收结论。',
    '本任务为自动执行关闭的手动交接（auto=false），不包含任何密钥。',
  )
  return lines.join('\n')
}

// Pure handoff projection for one running/blocked run. Returns undefined when no
// valid job can be produced (missing run, terminal run, missing module or unsafe
// run id); writeHandoffJob turns that into a readable error for the command layer.
export function buildHandoffJob(blueprint, runId, options = {}) {
  const source = object(blueprint)
  const wanted = text(runId).trim()
  if (source === undefined || !isSafeRunId(wanted)) return undefined

  const run = runList(source).find(entry => text(entry?.id).trim() === wanted)
  if (run === undefined) return undefined
  const status = text(run.status).trim().toLowerCase()
  if (status !== 'running' && status !== 'blocked') return undefined

  const moduleId = text(run.moduleId).trim()
  if (moduleId === '') return undefined
  const module = (Array.isArray(source.modules) ? source.modules : [])
    .find(entry => text(entry?.id).trim() === moduleId)
  if (module === undefined) return undefined

  const base = buildHandoff(source, wanted)
  if (base === undefined) return undefined
  const packet = buildDispatchPacket(source, moduleId)
  if (packet === undefined) return undefined

  const sessionId = text(options.sessionId).trim() || text(source.sessionId).trim()
  const resultPath = sessionId === '' ? 'result.json' : blueprintRunResultRelative(sessionId, wanted)
  const handoffPath = sessionId === '' ? 'handoff.json' : blueprintRunHandoffRelative(sessionId, wanted)
  const requirements = packet.requirements.map(item => ({ uid: item.uid, text: item.text }))
  const acceptance = packet.acceptance
  const moduleCode = base.moduleCode || text(module.code).trim() || moduleId
  const resultSchema = handoffResultSchema(wanted)
  const prompt = handoffPromptOf({ runId: wanted, moduleId, moduleCode, module, base, requirements, acceptance, resultPath })
  const instructions = [
    `在 ${base.cwd || '模块工作目录'} 中完成模块 ${moduleCode}（${moduleId}）。`,
    `把结果写入 ${resultPath}；runId 必须是 ${wanted}。`,
    'status 只允许 done、failed、blocked；evidence 每条包含非空 text，最多 50 条。',
    'blocked 时提供 nextAction，保留当前租约，等待再次 prepare 或 collect。',
    '不要修改 handoff.json、蓝图或版本文件；不要自行宣称模块 done。',
  ]

  return {
    kind: 'blueprint-handoff',
    version: 1,
    runId: wanted,
    moduleId,
    moduleCode,
    adapter: base.adapter,
    cwd: base.cwd,
    mounts: base.mounts,
    allow: base.allow,
    commands: base.commands,
    agentProfile: base.agentProfile,
    endpointRef: base.endpointRef,
    storage: base.storage,
    prompt,
    requirements,
    acceptance,
    dependsOn: packet.dependsOn,
    createdAt: finite(run.startedAt) ?? null,
    expiresAt: finite(run.leaseUntil) ?? null,
    resultSchema,
    resultPath,
    handoffPath,
    instructions,
    auto: false,
    warnings: base.warnings,
  }
}

export async function writeHandoffJob(cwd, sessionId, blueprint, runId) {
  const source = object(blueprint)
  const wanted = safeRunId(runId)
  const handoff = buildHandoffJob(source, wanted, { sessionId })
  if (handoff === undefined) {
    const run = runList(source).find(entry => text(entry?.id).trim() === wanted)
    if (run === undefined) {
      throw new BlueprintValidationError('handoff', `执行记录不存在：${wanted}，无法准备交接。`)
    }
    const status = text(run.status).trim().toLowerCase()
    if (RUN_TERMINAL_SET.has(status)) {
      throw new BlueprintValidationError('handoff', `执行记录 ${wanted} 已结束（${status}），不能 prepare。`)
    }
    const moduleId = text(run.moduleId).trim()
    const exists = (Array.isArray(source?.modules) ? source.modules : [])
      .some(entry => text(entry?.id).trim() === moduleId)
    if (!exists) {
      throw new BlueprintValidationError('handoff', `运行 ${wanted} 指向的模块不存在：${moduleId || '(空)'}。`)
    }
    throw new BlueprintValidationError(
      'handoff',
      `运行 ${wanted} 当前状态为 ${status || '(未知)'}，只有 running/blocked 可以准备交接。`,
    )
  }

  const relativePath = blueprintRunHandoffRelative(sessionId, wanted)
  const absolutePath = blueprintRunHandoffAbsolute(cwd, sessionId, wanted)
  await writeJsonAtomic(absolutePath, handoff)
  return { handoff, relativePath, absolutePath }
}

function runResultError(code, error, extra = {}) {
  return { ok: false, code, error, ...extra }
}

function normalizeRunResult(raw, wanted) {
  const value = object(raw)
  if (value === undefined) return { ok: false, error: '顶层必须是 JSON 对象。' }
  const runId = text(value.runId).trim()
  if (runId !== wanted) {
    return { ok: false, error: `runId 必须是 ${wanted}，收到 ${runId || '(空)'}。` }
  }
  const status = text(value.status).trim().toLowerCase()
  if (!RUN_RESULT_STATUS_SET.has(status)) {
    return { ok: false, error: `status 必须是 ${RUN_RESULT_STATUSES.join('/')}，收到 ${status || '(空)'}。` }
  }

  const result = { runId: wanted, status }
  for (const key of ['summary', 'nextAction', 'error']) {
    if (value[key] === undefined) continue
    if (typeof value[key] !== 'string') return { ok: false, error: `${key} 必须是字符串。` }
    const body = value[key].trim().slice(0, key === 'summary' ? RUN_EVIDENCE_TEXT_LIMIT : RUN_TEXT_LIMIT)
    if (body !== '') result[key] = body
  }

  if (value.evidence !== undefined) {
    if (!Array.isArray(value.evidence)) return { ok: false, error: 'evidence 必须是数组。' }
    if (value.evidence.length > RUN_RESULT_LIMIT) {
      return { ok: false, error: `evidence 最多 ${RUN_RESULT_LIMIT} 条，收到 ${value.evidence.length} 条。` }
    }
    const evidence = []
    for (const entry of value.evidence) {
      if (typeof entry === 'string') {
        const body = entry.trim()
        if (body === '') return { ok: false, error: 'evidence 的文本不能为空。' }
        evidence.push({ text: body.slice(0, RUN_EVIDENCE_TEXT_LIMIT) })
        continue
      }
      const item = object(entry)
      if (item === undefined) return { ok: false, error: 'evidence 条目必须是字符串或 {kind?,text} 对象。' }
      if (typeof item.text !== 'string' || item.text.trim() === '') {
        return { ok: false, error: 'evidence 条目的 text 必须是非空字符串。' }
      }
      const normalized = { text: item.text.trim().slice(0, RUN_EVIDENCE_TEXT_LIMIT) }
      if (item.kind !== undefined) {
        if (typeof item.kind !== 'string') return { ok: false, error: 'evidence 条目的 kind 必须是字符串。' }
        const kind = item.kind.trim().slice(0, RUN_EVIDENCE_KIND_LIMIT)
        if (kind !== '') normalized.kind = kind
      }
      evidence.push(normalized)
    }
    result.evidence = evidence
  }

  if (value.changedPaths !== undefined) {
    if (!Array.isArray(value.changedPaths)) return { ok: false, error: 'changedPaths 必须是字符串数组。' }
    const paths = []
    for (const entry of value.changedPaths) {
      if (typeof entry !== 'string') return { ok: false, error: 'changedPaths 必须是字符串数组。' }
      const body = entry.trim()
      if (body !== '' && !paths.includes(body)) paths.push(body)
    }
    if (paths.length > 200) return { ok: false, error: 'changedPaths 最多 200 条。' }
    result.changedPaths = paths
  }

  if (value.at !== undefined) {
    const at = finite(value.at)
    if (at === undefined) return { ok: false, error: 'at 必须是有限数字时间戳。' }
    result.at = at
  }
  return { ok: true, result }
}

export async function readRunResult(cwd, sessionId, runId) {
  let wanted
  try {
    wanted = safeRunId(runId)
  } catch (error) {
    return runResultError('invalid-run-id', messageOf(error))
  }
  const relativePath = blueprintRunResultRelative(sessionId, wanted)
  const absolutePath = blueprintRunResultAbsolute(cwd, sessionId, wanted)
  let raw
  try {
    raw = await fs.readFile(absolutePath, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return runResultError('missing', `结果文件不存在：${relativePath}。`, { relativePath, absolutePath })
    }
    return runResultError('read-failed', `读取结果文件失败：${messageOf(error)}。`, { relativePath, absolutePath })
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return runResultError('invalid-json', `结果文件不是合法 JSON：${relativePath}。`, { relativePath, absolutePath })
  }
  const checked = normalizeRunResult(parsed, wanted)
  if (!checked.ok) {
    return runResultError('invalid-result', `结果文件格式无效：${checked.error}`, { relativePath, absolutePath })
  }
  return { ok: true, result: checked.result, relativePath, absolutePath }
}

function capRunEvidence(evidence) {
  return evidence.length > BLUEPRINT_LIMITS.runEvidence
    ? evidence.slice(-BLUEPRINT_LIMITS.runEvidence)
    : evidence
}

// Pure application of one validated result.json. done/failed delegate to finishRun
// (terminal, endedAt set, lease removed); blocked keeps the run open, preserves its
// lease and stores nextAction so it can be prepared or collected again later.
export function applyRunResult(blueprint, result) {
  const source = object(blueprint)
  if (source === undefined) return { ok: false, error: '还没有工程蓝图，无法应用运行结果。' }
  const raw = object(result)
  if (raw === undefined) return { ok: false, error: '运行结果无效：顶层必须是 JSON 对象。' }
  const wanted = text(raw.runId).trim()
  if (wanted === '') return { ok: false, error: '运行结果缺少 runId。' }
  const checked = normalizeRunResult(raw, wanted)
  if (!checked.ok) return { ok: false, error: `运行结果格式无效：${checked.error}` }
  const normalized = checked.result

  const existing = runsById(source).get(wanted)
  if (existing === undefined) return { ok: false, error: `执行记录不存在：${wanted}。` }
  const status = text(existing.status).trim().toLowerCase()
  if (RUN_TERMINAL_SET.has(status)) {
    return { ok: false, error: `执行记录 ${wanted} 已结束（${status}），不能再应用结果。` }
  }

  const now = finite(normalized.at) ?? Date.now()
  const warnings = []
  const incoming = (normalized.evidence ?? []).map(item => ({ at: now, text: item.text, ...(item.kind === undefined ? {} : { kind: item.kind }) }))
  if (incoming.length === 0) warnings.push(`结果文件 ${wanted} 没有 evidence；建议补充可复核证据。`)
  let evidence = capRunEvidence([...(Array.isArray(existing.evidence) ? existing.evidence : []), ...incoming])
  let run = { ...existing, evidence }
  if (normalized.changedPaths !== undefined) run.changedPaths = normalized.changedPaths

  if (normalized.status === 'blocked') {
    if (normalized.summary !== undefined) {
      evidence = capRunEvidence([...evidence, { at: now, kind: 'summary', text: normalized.summary }])
    }
    run = {
      ...run,
      status: 'blocked',
      evidence,
      nextAction: normalized.nextAction
        || text(existing.nextAction).trim()
        || '等待外部 Agent 继续：可再次 prepare 或 collect。',
    }
    if (normalized.error !== undefined) run.error = normalized.error
    const runs = runList(source).map(entry => (text(entry?.id).trim() === wanted ? run : entry))
    return { ok: true, blueprint: withRuns(source, runs), run, warnings }
  }

  const withEvidence = withRuns(
    source,
    runList(source).map(entry => (text(entry?.id).trim() === wanted ? run : entry)),
  )
  const finished = finishRun(withEvidence, wanted, {
    status: normalized.status,
    summary: normalized.summary,
    nextAction: normalized.nextAction,
    error: normalized.error,
    now,
  })
  if (!finished.ok) return finished
  if (finished.warning !== undefined) warnings.push(finished.warning)
  return { ok: true, blueprint: finished.blueprint, run: finished.run, warnings }
}

export function parseBlueprintSaveInput(rawInput) {
  const tokens = String(rawInput ?? '').trim().split(/\s+/u).filter(token => token !== '')
  let draft = false
  let force = false
  let base
  const payload = []
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token === '--draft') {
      draft = true
      continue
    }
    if (token === '--force') {
      force = true
      continue
    }
    if (token === '--base') {
      const value = Number(tokens[index + 1])
      if (Number.isFinite(value)) {
        base = value
        index += 1
      }
      continue
    }
    if (token.startsWith('--base=')) {
      const value = Number(token.slice('--base='.length))
      if (Number.isFinite(value)) base = value
      continue
    }
    payload.push(token)
  }
  return {
    encoded: payload.join(''),
    draft,
    force,
    base,
    mode: draft ? 'draft' : 'archived',
  }
}

function messageOf(error) {
  return String(error?.message ?? error ?? 'unknown error')
}

// Save a blueprint from the /blueprint command. Draft mode writes the current JSON only;
// archived mode also snapshots the previous version. An archive failure never blocks the write.
export async function saveBlueprintFromCommand(options = {}) {
  const { cwd, sessionId, input, previous, draft = false, source = 'ui', label = '' } = options
  const blueprint = normalizeBlueprint(input, previous, { sessionId })
  blueprint.updatedAt = Date.now()
  const archiveErrors = []
  let archived = false
  let skipped = false

  if (!draft) {
    try {
      const result = await archiveBlueprintVersion(cwd, sessionId, previous, { source, label })
      archived = true
      skipped = result?.skipped === true
    } catch (error) {
      archiveErrors.push(messageOf(error))
    }
  }

  await writeBlueprintFile(blueprintAbsolutePath(cwd, sessionId), blueprint)

  if (!draft && previous === undefined) {
    try {
      const result = await archiveBlueprintVersion(cwd, sessionId, blueprint, { source, label: label || 'initial' })
      archived = true
      skipped = result?.skipped === true
    } catch (error) {
      archiveErrors.push(messageOf(error))
    }
  }

  return {
    blueprint,
    relativePath: blueprintRelativePath(sessionId),
    mode: draft ? 'draft' : 'archived',
    archived: !draft && archiveErrors.length === 0,
    skipped,
    archiveErrors,
  }
}

export async function readBlueprintFile(file) {
  try {
    const raw = await fs.readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    return object(parsed) === undefined ? undefined : parsed
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
}

const fileWriteChains = new Map()
function enqueueByKey(key, task) {
  const previous = fileWriteChains.get(key) ?? Promise.resolve()
  const run = previous.then(task, task)
  const tail = run.then(() => undefined, () => undefined)
  fileWriteChains.set(key, tail)
  tail.finally(() => {
    if (fileWriteChains.get(key) === tail) fileWriteChains.delete(key)
  })
  return run
}

export async function writeBlueprintFile(file, blueprint) {
  return enqueueByKey(`file:${file}`, async () => {
    await fs.mkdir(path.dirname(file), { recursive: true })
    const body = `${JSON.stringify(blueprint, null, 2)}\n`
    const temp = `${file}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`
    await fs.writeFile(temp, body, 'utf8')
    await fs.rename(temp, file)
    return body
  })
}

export async function deleteBlueprintFile(file) {
  try {
    await fs.unlink(file)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function versionDirName(sessionId) {
  return `${blueprintFileName(sessionId).replace(/\.json$/u, '')}.versions`
}

export function blueprintVersionsRelativeDir(sessionId) {
  return path.posix.join('.dsh', 'blueprints', versionDirName(sessionId))
}

export function blueprintVersionsIndexRelativePath(sessionId) {
  return path.posix.join(blueprintVersionsRelativeDir(sessionId), 'index.json')
}

export function blueprintVersionsAbsoluteDir(cwd, sessionId) {
  return path.join(cwd, '.dsh', 'blueprints', versionDirName(sessionId))
}

export async function readVersionsIndex(cwd, sessionId) {
  const dir = blueprintVersionsAbsoluteDir(cwd, sessionId)
  try {
    const raw = await fs.readFile(path.join(dir, 'index.json'), 'utf8')
    const parsed = JSON.parse(raw)
    if (object(parsed) === undefined || !Array.isArray(parsed.versions)) return { versions: [] }
    return { versions: parsed.versions.filter(entry => object(entry) !== undefined) }
  } catch (error) {
    if (error?.code === 'ENOENT') return { versions: [] }
    throw error
  }
}

export async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await fs.rename(temp, file)
}

function fingerprint(blueprint) {
  return JSON.stringify({ ...blueprint, updatedAt: 0 })
}

export async function archiveBlueprintVersion(cwd, sessionId, blueprint, options = {}) {
  if (blueprint === undefined || blueprint === null) return undefined
  const dir = blueprintVersionsAbsoluteDir(cwd, sessionId)
  return enqueueByKey(`versions:${dir}`, async () => {
    const index = await readVersionsIndex(cwd, sessionId)
    const normalized = normalizeBlueprint(blueprint, undefined, { sessionId })
    const mark = fingerprint(normalized)
    if (index.versions[0]?.fingerprint === mark) return { skipped: true, index }
  const id = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  await writeJsonAtomic(path.join(dir, `${id}.json`), normalized)
  const entry = {
    id,
    at: Date.now(),
    source: text(options.source, 'agent') || 'agent',
    label: text(options.label).trim(),
    title: normalized.title,
    status: normalized.status,
    counts: {
      sections: normalized.sections.length,
      items: normalized.sections.reduce((sum, section) => sum + section.items.length, 0),
      diagrams: normalized.diagrams.length,
      nodes: normalized.diagrams.reduce((sum, diagram) => sum + diagram.nodes.length, 0),
      edges: normalized.diagrams.reduce((sum, diagram) => sum + diagram.edges.length, 0),
      modules: normalized.modules.length,
    },
    fingerprint: mark,
  }
  index.versions.unshift(entry)
  const removed = index.versions.splice(40)
  await writeJsonAtomic(path.join(dir, 'index.json'), { versions: index.versions })
  for (const old of removed) {
    if (text(old.id) === '') continue
    await fs.unlink(path.join(dir, `${old.id}.json`)).catch(() => {})
  }
  return { entry, index }
  })
}

export async function readBlueprintVersion(cwd, sessionId, id) {
  if (!/^v-[a-z0-9-]+$/u.test(text(id))) return undefined
  try {
    const raw = await fs.readFile(path.join(blueprintVersionsAbsoluteDir(cwd, sessionId), `${id}.json`), 'utf8')
    const parsed = JSON.parse(raw)
    return object(parsed) === undefined ? undefined : parsed
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
}

// Requirement identity is the stable uid. Legacy/raw items without a uid fall back
// to "<sectionKey>:<id>" so a text edit no longer turns into one added plus one
// removed row. Items with neither uid nor id can only be aligned by position.
function requirementIdentity(sectionKey, item, index) {
  const value = object(item)
  const uid = text(value?.uid).trim()
  if (uid !== '') return uid
  const id = text(value?.id).trim()
  if (id !== '') return `${sectionKey}:${id}`
  return `${sectionKey}:#${index}`
}

function requirementText(item) {
  const value = object(item)
  if (value === undefined) return text(item).trim()
  return text(value.text ?? value.label ?? value.title ?? value.value).trim()
}

function requirementEntry(sectionKey, item) {
  const value = object(item)
  const id = text(value?.id).trim()
  const uid = text(value?.uid).trim() || `${sectionKey}:${id}`
  const code = requirementCode(value?.code)
  const entry = { id, uid, code, text: requirementText(item) }
  if (typeof value?.done === 'boolean') entry.done = value.done
  const moduleId = text(value?.moduleId).trim()
  if (moduleId !== '') entry.moduleId = moduleId
  return entry
}

function keyedRequirementItems(sectionKey, items) {
  const used = new Set()
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const base = requirementIdentity(sectionKey, item, index)
    let key = base
    let suffix = 2
    while (used.has(key)) {
      key = `${base}#${suffix}`
      suffix += 1
    }
    used.add(key)
    return { key, item }
  })
}

// English is split into words (apostrophes stay inside a word), CJK into single
// characters, and every other rune/punctuation mark stands alone. Whitespace is
// kept as one token so the rendered segments preserve spacing.
const WORD_DIFF_PATTERN = /\s+|[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*|[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]|./gsu
const WORD_DIFF_MAX_CELLS = 4000000

function tokenizeRequirementText(value) {
  const tokens = []
  const source = text(value)
  WORD_DIFF_PATTERN.lastIndex = 0
  let match = WORD_DIFF_PATTERN.exec(source)
  while (match !== null) {
    tokens.push(match[0])
    match = WORD_DIFF_PATTERN.exec(source)
  }
  return tokens
}

function pushWordSegment(segments, type, value) {
  if (value === '') return
  const last = segments[segments.length - 1]
  if (last !== undefined && last.type === type) last.text += value
  else segments.push({ type, text: value })
}

function lcsWordOperations(left, right) {
  const rows = left.length + 1
  const columns = right.length + 1
  if (rows * columns > WORD_DIFF_MAX_CELLS) {
    return [
      ...(left.length === 0 ? [] : [['remove', left.join('')]]),
      ...(right.length === 0 ? [] : [['add', right.join('')]]),
    ]
  }
  const table = new Uint32Array(rows * columns)
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i * columns + j] = left[i] === right[j]
        ? table[(i + 1) * columns + j + 1] + 1
        : Math.max(table[(i + 1) * columns + j], table[i * columns + j + 1])
    }
  }
  const operations = []
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      operations.push(['same', left[i]])
      i += 1
      j += 1
    } else if (table[(i + 1) * columns + j] >= table[i * columns + j + 1]) {
      operations.push(['remove', left[i]])
      i += 1
    } else {
      operations.push(['add', right[j]])
      j += 1
    }
  }
  while (i < left.length) operations.push(['remove', left[i++]])
  while (j < right.length) operations.push(['add', right[j++]])
  return operations
}

// Word-level diff used by requirement "modified" rows. It trims the common prefix
// and suffix first, then runs an LCS over the middle. Pathologically large changes
// fall back to one remove + one add block instead of allocating a huge table.
export function wordDiff(before, after) {
  const left = tokenizeRequirementText(before)
  const right = tokenizeRequirementText(after)
  let start = 0
  while (start < left.length && start < right.length && left[start] === right[start]) start += 1
  let endLeft = left.length
  let endRight = right.length
  while (endLeft > start && endRight > start && left[endLeft - 1] === right[endRight - 1]) {
    endLeft -= 1
    endRight -= 1
  }
  const segments = []
  pushWordSegment(segments, 'same', left.slice(0, start).join(''))
  for (const [type, value] of lcsWordOperations(left.slice(start, endLeft), right.slice(start, endRight))) {
    pushWordSegment(segments, type, value)
  }
  pushWordSegment(segments, 'same', left.slice(endLeft).join(''))
  return segments
}

function edgeSignature(edge) {
  return JSON.stringify({
    from: edge.from,
    to: edge.to,
    label: edge.label ?? '',
    kind: edge.kind ?? '',
    cardinality: edge.cardinality ?? '',
    order: edge.order ?? null,
  })
}

const NODE_COMPARE_FIELDS = ['label', 'type', 'requirementIds', 'description', 'technology', 'stereotype', 'fields']

function diffValue(value) {
  if (value === undefined) return null
  return JSON.parse(JSON.stringify(value))
}

function sameValue(left, right) {
  return JSON.stringify(left === undefined ? null : left) === JSON.stringify(right === undefined ? null : right)
}

function nodeChanges(before, after) {
  const changes = []
  for (const field of NODE_COMPARE_FIELDS) {
    if (!sameValue(before[field], after[field])) {
      changes.push({ field, before: diffValue(before[field]), after: diffValue(after[field]) })
    }
  }
  return changes
}

function edgeKey(edge) {
  return [edge.from, edge.to, edge.label ?? '', edge.kind ?? ''].join('\u0001')
}

function edgePayload(edge) {
  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    label: edge.label ?? '',
    kind: edge.kind ?? '',
  }
}

export function semanticDiff(before, after) {
  const left = before ?? { sections: [], diagrams: [], modules: [] }
  const right = after ?? { sections: [], diagrams: [], modules: [] }
  const totals = {
    added: 0,
    removed: 0,
    modified: 0,
    changed: 0,
    addedNodes: 0,
    removedNodes: 0,
    changedNodes: 0,
    addedEdges: 0,
    removedEdges: 0,
    changedEdges: 0,
  }
  const bump = kind => { totals[kind] += 1 }

  const leftSections = new Map((left.sections ?? []).map(section => [section.key, section]))
  const rightSections = new Map((right.sections ?? []).map(section => [section.key, section]))
  const sectionKeys = [...new Set([...leftSections.keys(), ...rightSections.keys()])]
  const sections = []
  for (const key of sectionKeys) {
    const from = leftSections.get(key)
    const to = rightSections.get(key)
    const beforeItems = keyedRequirementItems(key, from?.items)
    const afterItems = keyedRequirementItems(key, to?.items)
    const beforeByKey = new Map(beforeItems.map(entry => [entry.key, entry]))
    const afterByKey = new Map(afterItems.map(entry => [entry.key, entry]))
    const added = afterItems
      .filter(entry => !beforeByKey.has(entry.key))
      .map(entry => requirementEntry(key, entry.item))
    const removed = beforeItems
      .filter(entry => !afterByKey.has(entry.key))
      .map(entry => requirementEntry(key, entry.item))
    const modified = []
    for (const entry of afterItems) {
      const old = beforeByKey.get(entry.key)
      if (old === undefined) continue
      const beforeText = requirementText(old.item)
      const afterText = requirementText(entry.item)
      if (beforeText === afterText) continue
      const beforeEntry = requirementEntry(key, old.item)
      const afterEntry = requirementEntry(key, entry.item)
      modified.push({
        uid: afterEntry.uid || beforeEntry.uid,
        id: afterEntry.id || beforeEntry.id,
        code: afterEntry.code || beforeEntry.code,
        before: beforeText,
        after: afterText,
        wordDiff: wordDiff(beforeText, afterText),
      })
    }
    const titleChanged = from !== undefined && to !== undefined && from.title !== to.title
    if (added.length === 0 && removed.length === 0 && modified.length === 0
      && !titleChanged && from !== undefined && to !== undefined) continue
    sections.push({
      key,
      title: to?.title ?? from?.title ?? key,
      before: beforeItems.length,
      after: afterItems.length,
      added,
      removed,
      modified,
      titleChanged: titleChanged ? { from: from.title, to: to.title } : undefined,
      sectionAdded: from === undefined,
      sectionRemoved: to === undefined,
    })
    totals.added += added.length
    totals.removed += removed.length
    totals.modified += modified.length
    if (titleChanged) totals.changed += 1
  }

  const diffIdentityOf = diagram => {
    const parsed = parseDiagramIdentity(diagram)
    return { key: diagramKeyOf(parsed.layerId, parsed.type), layerId: parsed.layerId, type: parsed.type }
  }
  const diagramMap = list => {
    const map = new Map()
    for (const diagram of list ?? []) {
      const identity = diffIdentityOf(diagram)
      if (!map.has(identity.key)) map.set(identity.key, diagram)
    }
    return map
  }
  // Diagram identity is layerId:type. Root keeps its legacy display key (usecase,
  // dfd, ...), child layers use "<letter>:<type>". A raw pre-v2 "key" still maps to
  // A:<key>, so old versions remain diff-compatible.
  const leftDiagrams = diagramMap(left.diagrams)
  const rightDiagrams = diagramMap(right.diagrams)
  const diagramKeys = [...new Set([...leftDiagrams.keys(), ...rightDiagrams.keys()])]
  const diagrams = []
  for (const key of diagramKeys) {
    const from = leftDiagrams.get(key)
    const to = rightDiagrams.get(key)
    const beforeNodes = new Map((from?.nodes ?? []).map(node => [node.id, node]))
    const afterNodes = new Map((to?.nodes ?? []).map(node => [node.id, node]))
    const addedNodes = []
    const removedNodes = []
    const changedNodes = []
    for (const [id, node] of afterNodes) {
      const old = beforeNodes.get(id)
      if (old === undefined) {
        addedNodes.push({ id, label: node.label, type: node.type })
        continue
      }
      const changes = nodeChanges(old, node)
      if (changes.length > 0) changedNodes.push({ id, label: node.label, changes })
    }
    for (const [id, node] of beforeNodes) if (!afterNodes.has(id)) removedNodes.push({ id, label: node.label, type: node.type })

    const beforeEdges = from?.edges ?? []
    const afterEdges = to?.edges ?? []
    const beforeByKey = new Map()
    for (const [index, edge] of beforeEdges.entries()) {
      const key = edgeKey(edge)
      if (!beforeByKey.has(key)) beforeByKey.set(key, [])
      beforeByKey.get(key).push(index)
    }
    const matched = new Set()
    const addedEdges = []
    const removedEdges = []
    const changedEdges = []
    for (const edge of afterEdges) {
      const candidates = beforeByKey.get(edgeKey(edge)) ?? []
      const index = candidates.find(candidate => !matched.has(candidate))
      if (index === undefined) {
        addedEdges.push(edgePayload(edge))
        continue
      }
      matched.add(index)
      const old = beforeEdges[index]
      if (edgeSignature(old) !== edgeSignature(edge)) {
        changedEdges.push({ id: edge.id, from: edge.from, to: edge.to, label: edge.label ?? '', kind: edge.kind ?? '' })
      }
    }
    for (const [index, edge] of beforeEdges.entries()) if (!matched.has(index)) removedEdges.push(edgePayload(edge))

    if (addedNodes.length + removedNodes.length + changedNodes.length + addedEdges.length + removedEdges.length + changedEdges.length === 0 && from !== undefined && to !== undefined) continue
    diagrams.push({
      key,
      title: to?.title ?? from?.title ?? key,
      addedNodes,
      removedNodes,
      changedNodes,
      addedEdges,
      removedEdges,
      changedEdges,
      diagramAdded: from === undefined,
      diagramRemoved: to === undefined,
    })
    totals.addedNodes += addedNodes.length
    totals.removedNodes += removedNodes.length
    totals.changedNodes += changedNodes.length
    totals.addedEdges += addedEdges.length
    totals.removedEdges += removedEdges.length
    totals.changedEdges += changedEdges.length
    totals.added += addedNodes.length + addedEdges.length
    totals.removed += removedNodes.length + removedEdges.length
    totals.changed += changedNodes.length + changedEdges.length
  }

  const leftModules = new Map((left.modules ?? []).map(module => [module.id, module]))
  const rightModules = new Map((right.modules ?? []).map(module => [module.id, module]))
  const moduleChanges = { added: [], removed: [], changed: [] }
  for (const [id, module] of rightModules) {
    const old = leftModules.get(id)
    if (old === undefined) { moduleChanges.added.push({ id, name: module.name }); continue }
    const changes = []
    for (const field of ['name', 'summary', 'status']) {
      if ((old[field] ?? '') !== (module[field] ?? '')) changes.push({ field, from: old[field] ?? '', to: module[field] ?? '' })
    }
    if (JSON.stringify(old.dependsOn ?? []) !== JSON.stringify(module.dependsOn ?? [])) {
      changes.push({ field: 'dependsOn', from: (old.dependsOn ?? []).join(', '), to: (module.dependsOn ?? []).join(', ') })
    }
    if (changes.length > 0) moduleChanges.changed.push({ id, name: module.name, changes })
  }
  for (const [id, module] of leftModules) if (!rightModules.has(id)) moduleChanges.removed.push({ id, name: module.name })
  totals.added += moduleChanges.added.length
  totals.removed += moduleChanges.removed.length
  totals.changed += moduleChanges.changed.length

  return {
    before: { title: left.title ?? '', status: left.status ?? '', updatedAt: left.updatedAt ?? 0 },
    after: { title: right.title ?? '', status: right.status ?? '', updatedAt: right.updatedAt ?? 0 },
    sections,
    diagrams,
    modules: moduleChanges,
    totals,
  }
}

export function blueprintDigest(blueprint) {
  return {
    id: blueprint.id,
    title: blueprint.title,
    status: blueprint.status,
    layers: (blueprint.layers ?? []).map(layer => ({
      id: layer.id,
      letter: layer.letter,
      title: layer.title,
      parentModuleId: layer.parentModuleId,
    })),
    sections: blueprint.sections.map(section => ({ key: section.key, title: section.title, items: section.items.length })),
    diagrams: blueprint.diagrams.map(diagram => ({
      key: diagram.key,
      layerId: diagram.layerId,
      type: diagram.type,
      title: diagram.title,
      nodes: diagram.nodes.length,
      edges: diagram.edges.length,
    })),
    mounts: (blueprint.mounts ?? []).map(mount => ({
      id: mount.id,
      label: mount.label,
      root: mount.root,
      kind: mount.kind,
      access: mount.access,
      ref: mount.ref ?? '',
      checksum: mount.checksum ?? '',
    })),
    modules: blueprint.modules.map(module => ({
      id: module.id,
      name: module.name,
      layerId: module.layerId,
      code: module.code,
      parentId: module.parentId,
      dependsOn: module.dependsOn,
      status: module.status,
      mountIds: module.mountIds ?? [],
      adapter: module.execution?.adapter ?? '',
    })),
  }
}

export function mermaidFor(blueprint, key) {
  const diagram = blueprint.diagrams.find(item => item.key === key)
  if (diagram === undefined) return ''
  const type = text(diagram.type) || key
  if (type === 'class') return mermaidClass(diagram)
  if (type === 'state') return mermaidState(diagram)
  if (type === 'flowchart') return mermaidFlowchart(diagram)
  const header = type === 'module' ? 'graph TD' : 'flowchart LR'
  const lines = [header]
  for (const node of diagram.nodes) {
    const label = node.label.replace(/["\n]/g, ' ')
    if (node.type === 'actor') lines.push(`  ${node.id}(["${label}"])`)
    else if (node.type === 'usecase') lines.push(`  ${node.id}(("${label}"))`)
    else if (node.type === 'process') lines.push(`  ${node.id}(("${label}"))`)
    else if (node.type === 'store') lines.push(`  ${node.id}[("${label}")]`)
    else if (node.type === 'system') lines.push(`  subgraph ${node.id}["${label}"]`)
    else lines.push(`  ${node.id}["${label}"]`)
  }
  if (diagram.nodes.some(node => node.type === 'system')) lines.push('  end')
  for (const edge of diagram.edges) {
    const label = edge.label === undefined ? '' : `|${edge.label.replace(/[|\n]/g, ' ')}|`
    lines.push(`  ${edge.from} -->${label} ${edge.to}`)
  }
  return lines.join('\n')
}

// Numeric entities keep quotes/brackets out of Mermaid syntax while still
// round-tripping to the exact label text on import.
function mermaidFlowText(value) {
  return String(value ?? '')
    .replace(/#/g, '#35;')
    .replace(/"/g, '#34;')
    .replace(/\[/g, '#91;')
    .replace(/\]/g, '#93;')
    .replace(/\{/g, '#123;')
    .replace(/\}/g, '#125;')
    .replace(/\(/g, '#40;')
    .replace(/\)/g, '#41;')
    .replace(/\|/g, '#124;')
    .replace(/\n/g, ' ')
    .trim()
}

function mermaidFlowId(value, used) {
  let base = String(value ?? '').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^[-.]+|[-.]+$/g, '')
  if (base === '') base = 'node'
  if (!/^[A-Za-z_]/.test(base)) base = `n_${base}`
  let candidate = base
  let index = 2
  while (used.has(candidate)) candidate = `${base}_${index++}`
  used.add(candidate)
  return candidate
}

function mermaidFlowchart(diagram) {
  const nodes = Array.isArray(diagram.nodes) ? diagram.nodes : []
  const groups = nodes.filter(node => node.type === 'group')
  const groupIds = new Set(groups.map(node => node.id))
  const used = new Set()
  const ids = new Map()
  const idOf = node => {
    if (!ids.has(node.id)) ids.set(node.id, mermaidFlowId(node.id, used))
    return ids.get(node.id)
  }
  const lines = ['flowchart TD']
  for (const node of nodes) {
    if (node.type === 'note') lines.push(`  %% note ${mermaidFlowText(node.label).replace(/\n/g, ' ')}`)
  }
  const children = new Map()
  const loose = []
  for (const node of nodes) {
    if (node.type === 'group' || node.type === 'note') continue
    if (node.parentGroup !== undefined && groupIds.has(node.parentGroup)) {
      if (!children.has(node.parentGroup)) children.set(node.parentGroup, [])
      children.get(node.parentGroup).push(node)
    } else {
      loose.push(node)
    }
  }
  const emit = node => {
    const rawLabel = node.type === 'decision'
      ? node.label ?? node.condition
      : node.label ?? node.condition ?? node.id
    const label = mermaidFlowText(rawLabel ?? node.id)
    if (node.type === 'start' || node.type === 'end') lines.push(`  ${idOf(node)}(["${label}"])`)
    else if (node.type === 'decision') lines.push(`  ${idOf(node)}{"${label}"}`)
    else lines.push(`  ${idOf(node)}["${label}"]`)
  }
  for (const node of loose) emit(node)
  for (const group of groups) {
    lines.push(`  subgraph ${idOf(group)}["${mermaidFlowText(group.label || group.id)}"]`)
    for (const node of children.get(group.id) ?? []) emit(node)
    lines.push('  end')
  }
  for (const edge of Array.isArray(diagram.edges) ? diagram.edges : []) {
    const from = ids.get(edge.from)
    const to = ids.get(edge.to)
    if (from === undefined || to === undefined) continue
    const label = mermaidFlowText(edge.label ?? '')
    const arrow = edge.kind === 'dashed' ? '-.->' : '-->'
    lines.push(`  ${from} ${arrow}${label === '' ? '' : `|${label}|`} ${to}`)
  }
  return lines.join('\n')
}

function mermaidClass(diagram) {
  const lines = ['classDiagram']
  for (const node of diagram.nodes) {
    lines.push(`  class ${node.id} {`)
    if (node.type === 'interface') lines.push('    <<interface>>')
    for (const field of node.fields ?? []) {
      const type = text(field.type).trim()
      if (field.kind === 'method') {
        lines.push(`    +${field.name}()${type === '' ? '' : ` ${type}`}`)
      } else {
        lines.push(`    +${type === '' ? '' : `${type} `}${field.name}`)
      }
    }
    lines.push('  }')
  }
  for (const edge of diagram.edges) {
    const label = text(edge.label).trim()
    const suffix = label === '' ? '' : ` : ${label.replace(/\n/g, ' ')}`
    if (edge.kind === 'extends' || edge.kind === 'implements') {
      lines.push(`  ${edge.to} ${edge.kind === 'implements' ? '<|..' : '<|--'} ${edge.from}${suffix}`)
    } else {
      lines.push(`  ${edge.from} ${edge.kind === 'dependency' ? '..>' : '-->'} ${edge.to}${suffix}`)
    }
  }
  return lines.join('\n')
}

function mermaidState(diagram) {
  const nodes = new Map(diagram.nodes.map(node => [node.id, node]))
  const lines = ['stateDiagram-v2']
  for (const node of diagram.nodes) {
    if (node.type === 'initial' || node.type === 'final') continue
    const label = node.label.replace(/["\n]/g, ' ')
    lines.push(label !== node.id ? `  state "${label}" as ${node.id}` : `  state ${node.id}`)
  }
  for (const edge of diagram.edges) {
    const from = nodes.get(edge.from)
    const to = nodes.get(edge.to)
    if (from === undefined || to === undefined) continue
    const fromToken = from.type === 'initial' ? '[*]' : edge.from
    const toToken = to.type === 'final' ? '[*]' : edge.to
    const label = text(edge.label).trim()
    lines.push(`  ${fromToken} --> ${toToken}${label === '' ? '' : ` : ${label.replace(/\n/g, ' ')}`}`)
  }
  return lines.join('\n')
}
