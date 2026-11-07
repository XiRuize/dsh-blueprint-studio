import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

export const BLUEPRINT_VERSION = 1

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
]

export const ALL_NODE_TYPES = [...new Set(DIAGRAM_DEFS.flatMap(def => def.types))]

const STATUSES = new Set(['draft', 'confirmed', 'dispatched'])

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

function normalizeItems(raw, used) {
  const list = Array.isArray(raw) ? raw : []
  const items = []
  for (const entry of list) {
    const value = typeof entry === 'string' ? { text: entry } : object(entry)
    if (value === undefined) continue
    const body = text(value.text ?? value.label ?? value.title ?? value.value).trim()
    if (body === '') continue
    const item = { id: text(value.id) || unique(`i${items.length + 1}`, used), text: body }
    if (typeof value.done === 'boolean') item.done = value.done
    items.push(item)
  }
  return items
}

function normalizeSections(raw, previous) {
  const source = Array.isArray(raw)
    ? raw
    : object(raw)
      ? Object.entries(raw).map(([key, value]) =>
          Array.isArray(value) ? { key, items: value } : { key, ...(object(value) ?? {}) },
        )
      : undefined
  if (source === undefined) return previous?.sections ?? defaultSections()

  const previousByKey = new Map((previous?.sections ?? []).map(section => [section.key, section]))
  const used = new Set()
  const sections = []

  for (const entry of source) {
    const value = object(entry)
    if (value === undefined) continue
    const title = text(value.title ?? value.name, '').trim()
    const key = text(value.key) || slug(title || `section-${sections.length + 1}`)
    if (sections.some(section => section.key === key)) continue
    const itemUsed = new Set()
    const items = normalizeItems(value.items ?? value.requirements, itemUsed)
    const kept = previousByKey.get(key)
    // Only an omitted item field inherits the previous list. An explicit empty
    // list must stay empty so users can clear a section and have it persist.
    const explicitItems = value.items !== undefined || value.requirements !== undefined
    sections.push({
      key: unique(key, used),
      title: title || kept?.title || key,
      items: explicitItems ? items : kept?.items ?? items,
    })
  }

  for (const def of SECTION_DEFS) {
    if (sections.some(section => section.key === def.key)) continue
    const kept = previousByKey.get(def.key)
    sections.push({ key: def.key, title: def.title, items: kept?.items ?? [] })
  }
  return sections
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

function normalizeNodes(raw, typeSet, defaultType) {
  const list = Array.isArray(raw) ? raw : []
  const used = new Set()
  const nodes = []
  const labelToId = new Map()
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
    node.requirementIds = stringList(value.requirementIds)
    const fields = normalizeFields(value.fields ?? value.attributes ?? value.columns)
    if (fields.length > 0) node.fields = fields
    nodes.push(node)
    labelToId.set(label.toLowerCase(), id)
    labelToId.set(id.toLowerCase(), id)
  }
  return { nodes, labelToId }
}

function normalizeEdges(raw, nodes, labelToId) {
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
    if (text(value.kind ?? value.type).trim() !== '') edge.kind = text(value.kind ?? value.type).trim()
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

function normalizeDiagrams(raw, previous) {
  const source = Array.isArray(raw)
    ? raw
    : object(raw)
      ? Object.entries(raw).map(([key, value]) => ({ key, ...(object(value) ?? {}) }))
      : undefined
  if (source === undefined) return previous?.diagrams ?? defaultDiagrams()

  const previousByKey = new Map((previous?.diagrams ?? []).map(diagram => [diagram.key, diagram]))
  const used = new Set()
  const diagrams = []

  const push = (key, title, value) => {
    const def = DIAGRAM_DEFS.find(item => item.key === key)
    const typeSet = new Set(def?.types ?? ALL_NODE_TYPES)
    const rawNodes = value?.nodes
    const { nodes, labelToId } = normalizeNodes(rawNodes, typeSet, def?.defaultType ?? 'usecase')
    const edges = normalizeEdges(value?.edges ?? value?.links, nodes, labelToId)
    const kept = previousByKey.get(key)
    const diagram = {
      key: unique(key, used),
      title: text(value?.title, '').trim() || def?.title || key,
      nodes: rawNodes === undefined && kept !== undefined ? kept.nodes : nodes,
      edges: (value?.edges === undefined && value?.links === undefined && kept !== undefined) ? kept.edges : edges,
    }
    if (text(value?.description).trim() !== '') diagram.description = text(value.description).trim()
    const height = finite(value?.height)
    if (height !== undefined) diagram.height = height
    diagrams.push(diagram)
  }

  for (const entry of source) {
    const value = object(entry)
    if (value === undefined) continue
    const title = text(value.title).trim()
    const key = text(value.key) || slug(title || `diagram-${diagrams.length + 1}`)
    if (diagrams.some(diagram => diagram.key === key)) continue
    push(key, title, value)
  }

  for (const def of DIAGRAM_DEFS) {
    if (diagrams.some(diagram => diagram.key === def.key)) continue
    const kept = previousByKey.get(def.key)
    push(def.key, def.title, kept)
  }
  const order = new Map(DIAGRAM_DEFS.map((def, index) => [def.key, index]))
  diagrams.sort((left, right) => (order.get(left.key) ?? 99) - (order.get(right.key) ?? 99))
  return diagrams
}

function defaultDiagrams() {
  return DIAGRAM_DEFS.map(def => ({ key: def.key, title: def.title, nodes: [], edges: [] }))
}

function normalizeModules(raw, previous, sections) {
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
  if (entries === undefined) return previous?.modules ?? []

  const previousById = new Map((previous?.modules ?? []).map(module => [module.id, module]))
  const used = new Set()
  const byName = new Map()
  const modules = []
  const pendingDeps = []
  for (const entry of entries) {
    const value = object(entry)
    if (value === undefined) continue
    const name = text(value.name ?? value.title ?? value.label).trim()
    if (name === '') continue
    const id = unique(text(value.id) || slug(name, 'module'), used)
    const kept = previousById.get(id)
    const module = {
      id,
      name,
      summary: text(value.summary ?? value.description ?? value.scope).trim() || kept?.summary || '',
      dependsOn: [],
      nodeIds: stringList(value.nodeIds === undefined ? kept?.nodeIds : value.nodeIds),
      files: stringList(value.files === undefined ? kept?.files : value.files),
      acceptance: stringList(value.acceptance === undefined ? kept?.acceptance : value.acceptance),
      status: text(value.status, '') || kept?.status || 'pending',
    }
    if (kept?.subagentSessionId !== undefined) module.subagentSessionId = kept.subagentSessionId
    const assigned = text(value.subagentSessionId).trim()
    if (assigned !== '') module.subagentSessionId = assigned
    modules.push(module)
    byName.set(name.toLowerCase(), id)
    byName.set(id.toLowerCase(), id)
    const deps = Array.isArray(value.dependsOn) ? value.dependsOn : Array.isArray(value.deps) ? value.deps : []
    pendingDeps.push({ module, deps })
  }
  for (const { module, deps } of pendingDeps) {
    const resolved = []
    for (const dep of deps) {
      const id = byName.get(text(dep).trim().toLowerCase())
      if (id !== undefined && id !== module.id && !resolved.includes(id)) resolved.push(id)
    }
    module.dependsOn = resolved
  }
  return modules
}

export function normalizeBlueprint(input, previous, context = {}) {
  const source = object(input) ?? {}
  const base = object(previous) ?? {}
  const now = Date.now()
  const sections = normalizeSections(source.sections ?? source.requirements, base)
  const diagrams = normalizeDiagrams(source.diagrams ?? source.charts, base)
  const modules = normalizeModules(source.modules, base, sections)
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
  const status = STATUSES.has(text(source.status)) ? text(source.status) : base.status ?? 'draft'

  const blueprint = {
    version: BLUEPRINT_VERSION,
    id: text(base.id) || text(source.id) || `bp-${now.toString(36)}`,
    sessionId: context.sessionId ?? base.sessionId,
    title: text(source.title, '').trim() || base.title || '工程蓝图',
    summary: text(source.summary, '').trim() || base.summary || '',
    prompt: text(source.prompt ?? source.request, '').trim() || base.prompt || '',
    status,
    sections,
    diagrams,
    modules,
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
// "<diagramKey>:<id>". Ids stay case-sensitive to match stable node/edge ids.
function isRemoved(diagramKey, id, refs) {
  if (id === undefined || refs.length === 0) return false
  const key = text(diagramKey)
  for (const ref of refs) {
    if (ref === id) return true
    const index = ref.indexOf(':')
    if (index > 0 && ref.slice(0, index) === key && ref.slice(index + 1) === id) return true
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

function mergeDiagram(base, patchValue, rootRemovals) {
  const value = object(patchValue) ?? {}
  const key = text(value.key) || text(base?.key)
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

  return { ...(base ?? {}), ...value, key, nodes, edges }
}

function mergeDiagrams(baseDiagrams, patchRaw, rootRemovals) {
  const base = Array.isArray(baseDiagrams) ? baseDiagrams : []
  const patchList = diagramEntries(patchRaw) ?? []
  const baseByKey = new Map(base.map(diagram => [diagram.key, diagram]))
  const present = new Set()
  const merged = []
  for (const entry of patchList) {
    const value = object(entry)
    if (value === undefined) continue
    const title = text(value.title).trim()
    const key = text(value.key) || slug(title || `diagram-${merged.length + 1}`)
    if (present.has(key)) continue
    present.add(key)
    merged.push(mergeDiagram(baseByKey.get(key), value, rootRemovals))
  }
  for (const diagram of base) {
    if (present.has(diagram.key)) continue
    present.add(diagram.key)
    merged.push(rootRemovals.nodes.length === 0 && rootRemovals.edges.length === 0
      ? diagram
      : mergeDiagram(diagram, {}, rootRemovals))
  }
  return merged
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
  const merged = { ...(base ?? {}), ...update }
  const rootRemovals = {
    nodes: removalRefs(update.removedNodeIds),
    edges: removalRefs(update.removedEdgeIds),
  }
  const patchDiagrams = update.diagrams ?? update.charts
  if (patchDiagrams !== undefined) {
    merged.diagrams = mergeDiagrams(base?.diagrams, patchDiagrams, rootRemovals)
  } else if (base?.diagrams !== undefined) {
    merged.diagrams = rootRemovals.nodes.length > 0 || rootRemovals.edges.length > 0
      ? mergeDiagrams(base.diagrams, [], rootRemovals)
      : base.diagrams
  }
  return normalizeBlueprint(merged, base ?? undefined, context)
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

export function parseBlueprintSaveInput(rawInput) {
  const tokens = String(rawInput ?? '').trim().split(/\s+/u).filter(token => token !== '')
  let draft = false
  const payload = []
  for (const token of tokens) {
    if (token === '--draft') {
      draft = true
      continue
    }
    payload.push(token)
  }
  return {
    encoded: payload.join(''),
    draft,
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

export async function writeBlueprintFile(file, blueprint) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const body = `${JSON.stringify(blueprint, null, 2)}\n`
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temp, body, 'utf8')
  await fs.rename(temp, file)
  return body
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

async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await fs.rename(temp, file)
}

function fingerprint(blueprint) {
  return JSON.stringify({ ...blueprint, updatedAt: 0 })
}

export async function archiveBlueprintVersion(cwd, sessionId, blueprint, options = {}) {
  if (blueprint === undefined || blueprint === null) return undefined
  const dir = blueprintVersionsAbsoluteDir(cwd, sessionId)
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

function textSetDiff(before, after) {
  const beforeSet = new Set(before)
  const afterSet = new Set(after)
  return {
    added: after.filter(value => !beforeSet.has(value)),
    removed: before.filter(value => !afterSet.has(value)),
  }
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
    const beforeItems = (from?.items ?? []).map(item => item.text)
    const afterItems = (to?.items ?? []).map(item => item.text)
    const diff = textSetDiff(beforeItems, afterItems)
    const titleChanged = from !== undefined && to !== undefined && from.title !== to.title
    if (diff.added.length === 0 && diff.removed.length === 0 && !titleChanged && from !== undefined && to !== undefined) continue
    sections.push({
      key,
      title: to?.title ?? from?.title ?? key,
      before: beforeItems.length,
      after: afterItems.length,
      added: diff.added,
      removed: diff.removed,
      titleChanged: titleChanged ? { from: from.title, to: to.title } : undefined,
      sectionAdded: from === undefined,
      sectionRemoved: to === undefined,
    })
    totals.added += diff.added.length
    totals.removed += diff.removed.length
    if (titleChanged) totals.changed += 1
  }

  const leftDiagrams = new Map((left.diagrams ?? []).map(diagram => [diagram.key, diagram]))
  const rightDiagrams = new Map((right.diagrams ?? []).map(diagram => [diagram.key, diagram]))
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
    sections: blueprint.sections.map(section => ({ key: section.key, title: section.title, items: section.items.length })),
    diagrams: blueprint.diagrams.map(diagram => ({
      key: diagram.key,
      title: diagram.title,
      nodes: diagram.nodes.length,
      edges: diagram.edges.length,
    })),
    modules: blueprint.modules.map(module => ({
      id: module.id,
      name: module.name,
      dependsOn: module.dependsOn,
      status: module.status,
    })),
  }
}

export function mermaidFor(blueprint, key) {
  const diagram = blueprint.diagrams.find(item => item.key === key)
  if (diagram === undefined) return ''
  if (key === 'class') return mermaidClass(diagram)
  if (key === 'state') return mermaidState(diagram)
  const header = key === 'module' ? 'graph TD' : 'flowchart LR'
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
