// Blueprint Studio v0.9 Review & Handoff.
//
// Pure review projections: a review packet for the Host/UI, an advisory handoff
// plan for one run, and a single-file offline review page. Nothing in this module
// touches the filesystem, spawns a process or sends a request; every handoff step
// is an instruction for a human. Malformed blueprints degrade to empty sections
// instead of throwing; only an HTML page above the size cap throws.

import {
  DIAGRAM_DEFS,
  SECTION_DEFS,
  VERIFICATION_ROLES,
  mermaidFor,
  verificationComplete,
} from './blueprint.js'
import { analyzeBlueprint } from './checks.js'
import { renderDiagramSvg } from './svg.js'

export const REVIEW_MAX_BYTES = 5 * 1024 * 1024

export class ReviewTooLargeError extends Error {
  constructor(size, limit = REVIEW_MAX_BYTES) {
    super(`评审页面超过 5MB 上限（当前 ${formatBytes(size)}）。请减少蓝图内容后重试。`)
    this.name = 'ReviewTooLargeError'
    this.code = 'review-too-large'
    this.size = size
    this.limit = limit
  }
}

// Only these self-check rules belong in a review report. Diagram-shape warnings
// (isolated node, duplicate label, usecase without actor, ...) stay in /blueprint
// check; a reviewer cares about requirements, modules, mounts, runs and layer shape.
export const REVIEW_GAP_CODES = Object.freeze([
  'analysis-failed',
  'requirement-unassigned',
  'requirement-module-missing',
  'module-acceptance-missing',
  'module-verification-incomplete',
  'module-dep-missing',
  'module-dep-cycle',
  'module-code-invalid',
  'module-code-duplicate',
  'module-layer-missing',
  'module-mount-missing',
  'module-no-requirement',
  'mount-duplicate',
  'mount-path-missing',
  'mount-path-unsafe',
  'mount-ref-missing',
  'mount-readonly-write',
  'mount-overlap',
  'mount-snapshot-ref-missing',
  'run-module-missing',
  'run-mount-conflict',
  'run-lease-expired',
  'run-rollback-missing',
  'run-evidence-missing',
  'layer-parent-missing',
  'layer-empty',
  'layer-flat-complex',
  'layer-child-diagram-missing',
])
const REVIEW_GAP_SET = new Set(REVIEW_GAP_CODES)
const SEVERITY_RANK = Object.freeze({ error: 0, warn: 1, info: 2 })
const ADAPTERS = new Set(['manual', 'cli', 'http', 'dsh-subagent'])

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function text(value, fallback = '') {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function trimmed(value, fallback = '') {
  return text(value).trim() || fallback
}

function finite(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringList(value) {
  const seen = new Set()
  const result = []
  for (const entry of list(value)) {
    const item = trimmed(entry)
    if (item === '' || seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  return result
}

function compareNatural(left, right) {
  const a = text(left)
  const b = text(right)
  if (a === b) return 0
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }) || (a < b ? -1 : 1)
}

function generatedAtOf(source) {
  const value = source.updatedAt
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function layerOrderOf(source) {
  const order = new Map()
  for (const [index, layer] of list(source.layers).entries()) {
    const id = trimmed(layer?.letter ?? layer?.id).toUpperCase()
    if (id !== '' && !order.has(id)) order.set(id, index)
  }
  return order
}

function diagramTypeOrder() {
  const order = new Map()
  for (const [index, def] of DIAGRAM_DEFS.entries()) order.set(def.key, index)
  return order
}

function sectionOrderOf(source) {
  const known = new Map(SECTION_DEFS.map((def, index) => [def.key, index]))
  return (section, index) => {
    const key = trimmed(section?.key)
    const position = known.get(key)
    return position === undefined ? 1000 + index : position
  }
}

function moduleCodeOf(module) {
  return trimmed(module?.code)
}

function safeVerification(module) {
  const source = object(module?.verification)
  const verification = {}
  for (const role of VERIFICATION_ROLES) {
    const entry = object(source?.[role])
    verification[role] = {
      status: trimmed(entry?.status, 'pending').toLowerCase(),
      evidence: stringList(entry?.evidence),
    }
  }
  return verification
}

// The review page is deterministic: a run's lease and next action are reported as
// stored, never compared against the clock. Active means the stored status is
// running; lease expiry is surfaced by the self-check gap instead.
function isActiveRun(run) {
  return trimmed(run?.status).toLowerCase() === 'running'
}

function collectModules(source) {
  const rows = []
  for (const entry of list(source.modules)) {
    const module = object(entry)
    if (module === undefined) continue
    const id = trimmed(module.id)
    const name = trimmed(module.name ?? module.title ?? module.label)
    if (id === '' && name === '') continue
    rows.push({
      raw: module,
      id: id || name,
      name: name || id,
      code: moduleCodeOf(module) || trimmed(module.id) || name,
      layer: trimmed(module.layerId ?? module.layer, 'A').toUpperCase() || 'A',
      status: trimmed(module.status, 'pending'),
      acceptance: stringList(module.acceptance),
      verification: safeVerification(module),
      mountIds: stringList(module.mountIds),
      adapter: trimmed(module.execution?.adapter),
      activeRunId: '',
    })
  }
  rows.sort((left, right) => compareNatural(left.code, right.code) || compareNatural(left.id, right.id))
  return rows
}

function collectMounts(source, modules) {
  const rows = []
  const seen = new Set()
  for (const entry of list(source.mounts)) {
    const mount = object(entry)
    if (mount === undefined) continue
    const id = trimmed(mount.id)
    if (id === '' || seen.has(id)) continue
    seen.add(id)
    rows.push({
      id,
      label: trimmed(mount.label),
      root: trimmed(mount.root),
      kind: trimmed(mount.kind, 'working') || 'working',
      access: trimmed(mount.access, 'rw') || 'rw',
      ref: trimmed(mount.ref),
      checksum: trimmed(mount.checksum),
      boundModules: modules
        .filter(module => module.mountIds.includes(id))
        .map(module => module.code)
        .sort(compareNatural),
    })
  }
  rows.sort((left, right) => compareNatural(left.id, right.id))
  return rows
}

function collectRuns(source, modules) {
  const moduleCodeById = new Map(modules.map(module => [module.id, module.code]))
  const rows = []
  for (const entry of list(source.runs)) {
    const run = object(entry)
    if (run === undefined) continue
    const id = trimmed(run.id)
    if (id === '') continue
    const moduleId = trimmed(run.moduleId)
    rows.push({
      id,
      moduleId,
      moduleCode: moduleCodeById.get(moduleId) ?? moduleId,
      status: trimmed(run.status, 'running'),
      adapter: trimmed(run.adapter, 'manual'),
      claimedBy: trimmed(run.claimedBy),
      leaseUntil: typeof run.leaseUntil === 'number' && Number.isFinite(run.leaseUntil) ? run.leaseUntil : null,
      evidenceCount: list(run.evidence).length,
      nextAction: trimmed(run.nextAction),
      error: trimmed(run.error),
      rollbackInstructions: stringList(run.rollback?.instructions),
      raw: run,
    })
  }
  rows.sort((left, right) =>
    finite(left.raw?.startedAt) - finite(right.raw?.startedAt)
    || compareNatural(left.id, right.id))
  return rows
}

function collectGaps(source) {
  let issues
  try {
    issues = list(analyzeBlueprint(source).issues)
  } catch {
    issues = []
  }
  const gaps = []
  for (const issue of issues) {
    if (object(issue) === undefined || typeof issue.message !== 'string') continue
    if (!REVIEW_GAP_SET.has(issue.code)) continue
    const gap = {
      code: issue.code,
      severity: SEVERITY_RANK[issue.severity] === undefined ? 'info' : issue.severity,
      message: issue.message,
    }
    if (trimmed(issue.moduleId) !== '') gap.moduleId = trimmed(issue.moduleId)
    if (trimmed(issue.mountId) !== '') gap.mountId = trimmed(issue.mountId)
    if (trimmed(issue.runId) !== '') gap.runId = trimmed(issue.runId)
    gaps.push(gap)
  }
  gaps.sort((left, right) =>
    (SEVERITY_RANK[left.severity] ?? 9) - (SEVERITY_RANK[right.severity] ?? 9)
    || compareNatural(left.code, right.code)
    || compareNatural(left.moduleId ?? '', right.moduleId ?? '')
    || compareNatural(left.mountId ?? '', right.mountId ?? '')
    || compareNatural(left.runId ?? '', right.runId ?? '')
    || compareNatural(left.message, right.message))
  return gaps
}

function collectNextActions(modules, runs) {
  const actions = []
  const push = (rank, textBody, fields = {}) => {
    const body = trimmed(textBody)
    if (body === '') return
    const entry = { rank, text: body }
    if (fields.runId !== undefined) entry.runId = fields.runId
    if (fields.moduleCode !== undefined) entry.moduleCode = fields.moduleCode
    actions.push(entry)
  }

  for (const run of runs) {
    if (run.status !== 'running') continue
    const textBody = run.nextAction !== ''
      ? run.nextAction
      : run.evidenceCount === 0
        ? `运行 ${run.id} 仍在进行，但还没有记录任何 evidence；补充验证证据或结束运行。`
        : `运行 ${run.id} 仍在进行；确认进度，完成后用 complete/fail/cancel 收尾。`
    push(0, textBody, { runId: run.id, moduleCode: run.moduleCode })
  }

  for (const run of runs) {
    if (run.status !== 'failed') continue
    const textBody = run.rollbackInstructions.length > 0
      ? `失败运行 ${run.id} 的回滚计划（仅建议，不会自动执行）：${run.rollbackInstructions.join('；')}`
      : `失败运行 ${run.id} 缺少回滚说明；请补充 rollback.instructions 并人工确认改动范围。`
    push(1, textBody, { runId: run.id, moduleCode: run.moduleCode })
  }

  for (const module of modules) {
    if (module.mountIds.length > 0) continue
    push(2, `模块 ${module.code} 没有绑定任何 mount；先绑定工作区再分派。`, { moduleCode: module.code })
  }

  for (const module of modules) {
    if (verificationComplete(module.verification)) continue
    push(3, `模块 ${module.code} 的分层验收（tests/reviewer/human）尚未全部通过。`, { moduleCode: module.code })
  }

  actions.sort((left, right) =>
    left.rank - right.rank
    || compareNatural(left.runId ?? '', right.runId ?? '')
    || compareNatural(left.moduleCode ?? '', right.moduleCode ?? '')
    || compareNatural(left.text, right.text))
  const seen = new Set()
  const result = []
  for (const action of actions) {
    const key = `${action.rank}\u0000${action.runId ?? ''}\u0000${action.moduleCode ?? ''}\u0000${action.text}`
    if (seen.has(key)) continue
    seen.add(key)
    const entry = { text: action.text }
    if (action.runId !== undefined) entry.runId = action.runId
    if (action.moduleCode !== undefined) entry.moduleCode = action.moduleCode
    result.push(entry)
  }
  return result
}

function packetOf(source) {
  const modules = collectModules(source)
  const moduleById = new Map(modules.map(module => [module.id, module]))
  const layerOrder = layerOrderOf(source)
  const typeOrder = diagramTypeOrder()
  const orderSection = sectionOrderOf(source)

  const sectionEntries = list(source.sections)
    .map((section, index) => ({ section: object(section), index }))
    .filter(entry => entry.section !== undefined)
  sectionEntries.sort((left, right) => orderSection(left.section, left.index) - orderSection(right.section, right.index))

  const sections = sectionEntries.map(({ section }) => {
    const key = trimmed(section.key) || 'section'
    const items = []
    for (const entry of list(section.items ?? section.requirements)) {
      const item = typeof entry === 'string' ? { text: entry } : object(entry)
      if (item === undefined) continue
      const body = trimmed(item.text ?? item.label ?? item.title ?? item.value)
      if (body === '') continue
      const id = trimmed(item.id)
      const moduleId = trimmed(item.moduleId)
      const module = moduleById.get(moduleId)
      items.push({
        code: trimmed(item.code),
        uid: trimmed(item.uid) || (id === '' ? '' : `${key}:${id}`),
        text: body,
        moduleCode: module?.code ?? '',
        moduleName: module?.name ?? '',
      })
    }
    return { key, title: trimmed(section.title) || key, items }
  })

  // mermaidFor takes the whole blueprint and looks the diagram up by key, so it
  // needs the filtered source list before the ordered review rows are built.
  const rawDiagrams = list(source.diagrams ?? source.charts)
    .map(entry => object(entry))
    .filter(entry => entry !== undefined)
  const diagrams = rawDiagrams.map((diagram, index) => {
    const key = trimmed(diagram.key)
    const layerId = trimmed(diagram.layerId ?? diagram.layer, 'A').toUpperCase() || 'A'
    const type = trimmed(diagram.type).toLowerCase() || key.split(':').pop() || ''
    let mermaid = ''
    try {
      mermaid = text(mermaidFor({ diagrams: rawDiagrams }, key))
    } catch {
      mermaid = ''
    }
    return {
      index,
      key,
      layerId,
      type,
      title: trimmed(diagram.title) || type || key,
      nodeCount: list(diagram.nodes).length,
      edgeCount: list(diagram.edges).length,
      mermaid,
    }
  })
  diagrams.sort((left, right) =>
    (layerOrder.get(left.layerId) ?? 99) - (layerOrder.get(right.layerId) ?? 99)
    || (typeOrder.get(left.type) ?? 99) - (typeOrder.get(right.type) ?? 99)
    || compareNatural(left.key, right.key)
    || left.index - right.index)
  for (const diagram of diagrams) delete diagram.index

  const mounts = collectMounts(source, modules)
  const runs = collectRuns(source, modules)
  const activeRuns = runs.filter(run => run.status === 'running')
  const activeRunByModule = new Map()
  for (const run of activeRuns) {
    if (run.moduleId === '') continue
    const current = activeRunByModule.get(run.moduleId)
    if (current === undefined
      || finite(run.raw?.startedAt) >= finite(current.raw?.startedAt)) {
      activeRunByModule.set(run.moduleId, run)
    }
  }
  for (const module of modules) module.activeRunId = activeRunByModule.get(module.id)?.id ?? ''

  const gaps = collectGaps(source)
  const nextActions = collectNextActions(modules, runs)

  const requirementCount = sections.reduce((sum, section) => sum + section.items.length, 0)

  return {
    title: trimmed(source.title) || '工程蓝图',
    status: trimmed(source.status) || 'draft',
    generatedAt: generatedAtOf(source),
    summary: {
      layers: list(source.layers).length,
      modules: modules.length,
      requirements: requirementCount,
      diagrams: diagrams.length,
      mounts: mounts.length,
      runs: runs.length,
      activeRuns: activeRuns.length,
      openGaps: gaps.length,
    },
    requirements: { sections },
    modules: modules.map(module => ({
      code: module.code,
      id: module.id,
      name: module.name,
      layer: module.layer,
      status: module.status,
      acceptance: module.acceptance,
      verification: module.verification,
      mountIds: module.mountIds,
      adapter: module.adapter,
      activeRunId: module.activeRunId,
    })),
    mounts,
    diagrams,
    runs: runs.map(run => ({
      id: run.id,
      moduleCode: run.moduleCode,
      status: run.status,
      adapter: run.adapter,
      claimedBy: run.claimedBy,
      leaseUntil: run.leaseUntil,
      evidenceCount: run.evidenceCount,
      nextAction: run.nextAction,
      error: run.error,
      rollbackInstructions: run.rollbackInstructions,
    })),
    gaps,
    nextActions,
  }
}

function emptyPacket(source) {
  return {
    title: trimmed(source?.title) || '工程蓝图',
    status: trimmed(source?.status) || 'draft',
    generatedAt: generatedAtOf(object(source) ?? {}),
    summary: {
      layers: 0,
      modules: 0,
      requirements: 0,
      diagrams: 0,
      mounts: 0,
      runs: 0,
      activeRuns: 0,
      openGaps: 0,
    },
    requirements: { sections: [] },
    modules: [],
    mounts: [],
    diagrams: [],
    runs: [],
    gaps: [],
    nextActions: [],
  }
}

// Pure review projection. Stable ordering, no clock reads and no mutation of the
// input: two calls on the same blueprint produce deeply equal packets.
export function buildReviewPacket(blueprint) {
  const source = object(blueprint) ?? {}
  try {
    return packetOf(source)
  } catch {
    return emptyPacket(source)
  }
}

function mountSummary(mount) {
  return {
    id: trimmed(mount?.id),
    label: trimmed(mount?.label),
    root: trimmed(mount?.root),
    kind: trimmed(mount?.kind, 'working') || 'working',
    access: trimmed(mount?.access, 'rw') || 'rw',
    readOnly: mount?.readOnly === true,
    ref: trimmed(mount?.ref),
    checksum: trimmed(mount?.checksum),
  }
}

function storageOf(module) {
  const storage = object(module?.execution?.storage)
  if (storage === undefined) return null
  return {
    kind: trimmed(storage.kind, 'fs') || 'fs',
    ref: trimmed(storage.ref),
  }
}

function pushStep(steps, value) {
  const body = trimmed(value)
  if (body !== '' && !steps.includes(body)) steps.push(body)
}

// Advisory handoff for one run. The result is a plan only: `auto` is always false,
// commands are suggestions, and no endpoint request body or secret is included.
export function buildHandoff(blueprint, runId) {
  const source = object(blueprint)
  const wanted = trimmed(runId)
  if (source === undefined || wanted === '') return undefined

  const run = list(source.runs)
    .map(entry => object(entry))
    .find(entry => entry !== undefined && trimmed(entry.id) === wanted)
  if (run === undefined) return undefined

  const moduleId = trimmed(run.moduleId)
  const module = list(source.modules)
    .map(entry => object(entry))
    .find(entry => entry !== undefined && trimmed(entry.id) === moduleId)
  if (module === undefined) return undefined

  const mounts = []
  const mountsById = new Map()
  for (const entry of list(source.mounts)) {
    const mount = object(entry)
    const id = trimmed(mount?.id)
    if (mount === undefined || id === '' || mountsById.has(id)) continue
    mountsById.set(id, mount)
  }
  for (const id of stringList(module.mountIds)) {
    const mount = mountsById.get(id)
    if (mount !== undefined) mounts.push(mountSummary(mount))
  }

  const execution = object(module.execution)
  const adapterWanted = trimmed(run.adapter, 'manual').toLowerCase()
  const mode = ADAPTERS.has(adapterWanted) ? adapterWanted : 'manual'
  const moduleCode = trimmed(module.code) || trimmed(module.id)
  const cwd = trimmed(execution?.cwd) || trimmed(mounts[0]?.root)
  const allow = stringList(execution?.allow)
  const commands = stringList(execution?.commands)
  const agentProfile = trimmed(execution?.agentProfile)
  const storage = storageOf(module)
  const endpointRef = trimmed(execution?.endpointRef)
  const acceptance = stringList(module.acceptance)
  const warnings = []
  const steps = []

  if (mounts.length === 0) warnings.push(`模块 ${moduleCode} 没有绑定任何工作挂载。`)
  if (cwd === '') warnings.push(`模块 ${moduleCode} 没有可用的 cwd；请设置 execution.cwd 或绑定 working 挂载。`)
  for (const mount of mounts) {
    if (mount.readOnly && (allow.length > 0 || commands.length > 0)) {
      warnings.push(`只读挂载 ${mount.id} 上声明了 allow/commands，交接时只能执行只读操作。`)
    }
  }
  if (trimmed(run.status).toLowerCase() === 'failed' && stringList(run.rollback?.instructions).length === 0) {
    warnings.push(`失败运行 ${wanted} 没有回滚说明；先补充 rollback.instructions。`)
  }

  if (mode === 'manual') {
    pushStep(steps, `手动模式：不自动派发、不执行命令，由人工完成模块 ${moduleCode}。`)
    pushStep(steps, cwd === '' ? '未设置工作目录，请先确认改动范围。' : `工作目录：${cwd}。`)
    if (mounts.length > 0) {
      pushStep(steps, `可访问挂载：${mounts.map(mount => `${mount.id}（${mount.root || '未设置 root'}，${mount.access}）`).join('、')}。`)
    }
    for (const command of commands) pushStep(steps, `建议命令（需人工确认，不会自动执行）：${command}`)
    if (acceptance.length > 0) pushStep(steps, `验收标准：${acceptance.join('；')}。`)
    pushStep(steps, `完成后用 /blueprint run evidence ${wanted} <证据> 记录结果。`)
  } else if (mode === 'cli') {
    pushStep(steps, `CLI 模式：以下只是建议，Blueprint Studio 不会执行任何命令。`)
    if (cwd !== '') pushStep(steps, `cd ${cwd}`)
    else pushStep(steps, '先设置 execution.cwd 或绑定 working 挂载，再进入工作目录。')
    for (const command of commands) pushStep(steps, command)
    if (commands.length === 0) warnings.push(`模块 ${moduleCode} 没有建议命令，CLI 交接只能人工补全。`)
    if (allow.length > 0) pushStep(steps, `允许的操作范围：${allow.join('、')}。`)
    if (acceptance.length > 0) pushStep(steps, `验收标准：${acceptance.join('；')}。`)
    pushStep(steps, `执行后用 /blueprint run evidence ${wanted} <证据> 记录命令与结果。`)
  } else if (mode === 'http') {
    pushStep(steps, `HTTP 模式：只交接端点引用与存储信息；不生成请求体，不包含任何密钥。`)
    pushStep(steps, `端点引用：${endpointRef || '（未设置）'}。`)
    if (storage === null) {
      warnings.push(`模块 ${moduleCode} 没有配置 storage，HTTP 交接无法确定证据存储位置。`)
      pushStep(steps, '未配置 storage；请补充 execution.storage。')
    } else {
      pushStep(steps, `证据存储：${storage.kind}${storage.ref === '' ? '' : `（${storage.ref}）`}。`)
    }
    if (mounts.length > 0) pushStep(steps, `交接挂载：${mounts.map(mount => `${mount.id}:${mount.root}`).join('、')}。`)
    if (acceptance.length > 0) pushStep(steps, `验收标准：${acceptance.join('；')}。`)
    pushStep(steps, `完成后用 /blueprint run evidence ${wanted} <证据> 记录结果。`)
  } else {
    pushStep(steps, `dsh-subagent 模式：不自动 spawn 子代理；把下列上下文交给人工或用户在面板确认分派。`)
    pushStep(steps, `模块 ${moduleCode}（${module.name}），运行 ${wanted}。`)
    if (agentProfile !== '') pushStep(steps, `子代理配置：${agentProfile}。`)
    if (mounts.length > 0) pushStep(steps, `可写范围：${mounts.map(mount => `${mount.id}（${mount.access}）`).join('、')}。`)
    else pushStep(steps, '没有绑定挂载；子代理无法确定工作目录。')
    if (acceptance.length > 0) pushStep(steps, `验收标准：${acceptance.join('；')}。`)
    const requirements = []
    for (const section of list(source.sections)) {
      const sectionKey = trimmed(section?.key)
      for (const entry of list(section?.items)) {
        const item = object(entry)
        if (item === undefined || trimmed(item.moduleId) !== moduleId) continue
        const body = trimmed(item.text ?? item.label ?? item.title ?? item.value)
        if (body !== '') requirements.push(`${trimmed(item.code) || `${sectionKey}:${trimmed(item.id)}`} ${body}`)
      }
    }
    if (requirements.length > 0) pushStep(steps, `关联需求：${requirements.join('；')}。`)
    pushStep(steps, '子代理完成后由用户执行 /blueprint verify 记录 tests/reviewer/human，不要自行宣称 done。')
  }

  const rollbackInstructions = stringList(run.rollback?.instructions)
  if (rollbackInstructions.length > 0) {
    pushStep(steps, `回滚建议（不自动执行）：${rollbackInstructions.join('；')}。`)
  }

  return {
    runId: wanted,
    moduleCode,
    adapter: mode,
    cwd,
    mounts,
    allow,
    commands,
    agentProfile,
    endpointRef,
    storage,
    mode,
    steps,
    auto: false,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Offline review page. One file, no scripts, no CDN, no font or image URL:
// everything is escaped markup and inline CSS.
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  return text(value)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;')
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '未知大小'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatTimestamp(value) {
  if (value === 0) return '未记录（确定性快照）'
  try {
    return new Date(value).toISOString()
  } catch {
    return String(value)
  }
}

function statusClass(value) {
  return text(value).replace(/[^a-z0-9_-]/giu, '').toLowerCase() || 'unknown'
}

function verificationSummary(verification) {
  return VERIFICATION_ROLES
    .map(role => `${role}=${trimmed(verification?.[role]?.status, 'pending')}`)
    .join(' · ')
}

function statCard(label, value) {
  return `<div class="stat"><span class="stat-value">${escapeHtml(value)}</span><span class="stat-label">${escapeHtml(label)}</span></div>`
}

function requirementsHtml(packet) {
  const rows = []
  for (const section of packet.requirements.sections) {
    rows.push(`<h3>${escapeHtml(section.title)} <span class="muted">(${escapeHtml(section.key)})</span></h3>`)
    rows.push('<table class="data"><thead><tr><th>Code</th><th>需求</th><th>模块</th></tr></thead><tbody>')
    if (section.items.length === 0) {
      rows.push('<tr class="empty"><td colspan="3">（无）</td></tr>')
    } else {
      for (const item of section.items) {
        const module = item.moduleCode === ''
          ? '未归属'
          : `${item.moduleCode}${item.moduleName === '' ? '' : ` · ${item.moduleName}`}`
        rows.push(`<tr><td class="code">${escapeHtml(item.code || item.uid)}</td><td>${escapeHtml(item.text)}</td><td>${escapeHtml(module)}</td></tr>`)
      }
    }
    rows.push('</tbody></table>')
  }
  if (rows.length === 0) rows.push('<p class="empty">（无需求）</p>')
  return rows.join('\n')
}

function modulesHtml(packet) {
  const rows = ['<table class="data"><thead><tr><th>Code</th><th>名称</th><th>层</th><th>状态</th><th>挂载</th><th>适配器</th><th>验收标准</th></tr></thead><tbody>']
  if (packet.modules.length === 0) {
    rows.push('<tr class="empty"><td colspan="7">（无模块）</td></tr>')
  } else {
    for (const module of packet.modules) {
      rows.push('<tr>')
      rows.push(`<td class="code">${escapeHtml(module.code)}</td>`)
      rows.push(`<td>${escapeHtml(module.name)}</td>`)
      rows.push(`<td>${escapeHtml(module.layer)}</td>`)
      rows.push(`<td><span class="status status-${escapeHtml(statusClass(module.status))}">${escapeHtml(module.status)}</span><br><span class="muted">${escapeHtml(verificationSummary(module.verification))}</span></td>`)
      rows.push(`<td>${escapeHtml(module.mountIds.length === 0 ? '未绑定' : module.mountIds.join('、'))}</td>`)
      rows.push(`<td>${escapeHtml(module.adapter || '默认')}</td>`)
      rows.push(`<td>${module.acceptance.length === 0 ? '<span class="muted">未填写</span>' : `<ul>${module.acceptance.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`}</td>`)
      rows.push('</tr>')
    }
  }
  rows.push('</tbody></table>')
  return rows.join('\n')
}

function mountsHtml(packet) {
  const rows = ['<table class="data"><thead><tr><th>ID</th><th>Label</th><th>Root</th><th>Kind</th><th>Access</th><th>Ref</th><th>Checksum</th><th>绑定模块</th></tr></thead><tbody>']
  if (packet.mounts.length === 0) {
    rows.push('<tr class="empty"><td colspan="8">（无挂载）</td></tr>')
  } else {
    for (const mount of packet.mounts) {
      rows.push('<tr>')
      rows.push(`<td class="code">${escapeHtml(mount.id)}</td>`)
      rows.push(`<td>${escapeHtml(mount.label)}</td>`)
      rows.push(`<td class="code">${escapeHtml(mount.root || '未设置')}</td>`)
      rows.push(`<td>${escapeHtml(mount.kind)}</td>`)
      rows.push(`<td>${escapeHtml(mount.access)}</td>`)
      rows.push(`<td class="code">${escapeHtml(mount.ref)}</td>`)
      rows.push(`<td class="code">${escapeHtml(mount.checksum)}</td>`)
      rows.push(`<td>${escapeHtml(mount.boundModules.length === 0 ? '未绑定' : mount.boundModules.join('、'))}</td>`)
      rows.push('</tr>')
    }
  }
  rows.push('</tbody></table>')
  return rows.join('\n')
}

function diagramsHtml(packet, svgByKey) {
  if (packet.diagrams.length === 0) return '<p class="empty">（无图解）</p>'
  const cards = []
  for (const diagram of packet.diagrams) {
    const svg = svgByKey.get(diagram.key) ?? ''
    cards.push('<figure class="diagram">')
    cards.push('<figcaption>')
    cards.push(`<h3>${escapeHtml(diagram.title)} <span class="badge">${escapeHtml(diagram.type)}</span> <span class="muted">${escapeHtml(diagram.key)}</span></h3>`)
    cards.push(`<p class="muted">层 ${escapeHtml(diagram.layerId)} · 节点 ${escapeHtml(diagram.nodeCount)} · 边 ${escapeHtml(diagram.edgeCount)}</p>`)
    cards.push('</figcaption>')
    cards.push('<div class="diagram-canvas">')
    cards.push(svg !== '' ? svg : '<p class="empty">（该图暂无可用 SVG）</p>')
    cards.push('</div>')
    if (diagram.mermaid !== '') {
      // Mermaid stays available for copy/paste, but it is no longer the primary
      // rendering: the inline SVG above is what a reviewer reads.
      cards.push('<details class="mermaid-source">')
      cards.push('<summary>Mermaid 源码（可选）</summary>')
      cards.push(`<pre class="mermaid-source"><code>${escapeHtml(diagram.mermaid)}</code></pre>`)
      cards.push('</details>')
    }
    cards.push('</figure>')
  }
  return cards.join('\n')
}

// Render the original normalized diagrams for the HTML projection only. The
// review packet deliberately stays lean (Mermaid source + counts), so a large
// command result does not carry every SVG string.
function renderSvgByKey(blueprint) {
  const result = new Map()
  for (const entry of list(blueprint?.diagrams ?? blueprint?.charts)) {
    const diagram = object(entry)
    if (diagram === undefined) continue
    const key = trimmed(diagram.key)
    if (key === '' || result.has(key)) continue
    try {
      result.set(key, renderDiagramSvg(diagram))
    } catch {
      result.set(key, '')
    }
  }
  return result
}

function runsHtml(packet) {
  const rows = ['<table class="data"><thead><tr><th>Run</th><th>模块</th><th>状态</th><th>适配器</th><th>Claimed by</th><th>Lease until</th><th>证据</th><th>Next action</th><th>回滚</th></tr></thead><tbody>']
  if (packet.runs.length === 0) {
    rows.push('<tr class="empty"><td colspan="9">（无运行）</td></tr>')
  } else {
    for (const run of packet.runs) {
      rows.push('<tr>')
      rows.push(`<td class="code">${escapeHtml(run.id)}</td>`)
      rows.push(`<td class="code">${escapeHtml(run.moduleCode)}</td>`)
      rows.push(`<td><span class="status status-${escapeHtml(statusClass(run.status))}">${escapeHtml(run.status)}</span></td>`)
      rows.push(`<td>${escapeHtml(run.adapter)}</td>`)
      rows.push(`<td>${escapeHtml(run.claimedBy || '—')}</td>`)
      rows.push(`<td class="code">${run.leaseUntil === null ? '—' : escapeHtml(formatTimestamp(run.leaseUntil))}</td>`)
      rows.push(`<td>${escapeHtml(run.evidenceCount)}</td>`)
      rows.push(`<td>${escapeHtml(run.nextAction || run.error || '—')}</td>`)
      rows.push(`<td>${run.rollbackInstructions.length === 0 ? '—' : `<ul>${run.rollbackInstructions.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`}</td>`)
      rows.push('</tr>')
    }
  }
  rows.push('</tbody></table>')
  return rows.join('\n')
}

function gapsHtml(packet) {
  const rows = ['<table class="data"><thead><tr><th>Severity</th><th>Code</th><th>Message</th><th>引用</th></tr></thead><tbody>']
  if (packet.gaps.length === 0) {
    rows.push('<tr class="empty"><td colspan="4">（无评审缺口）</td></tr>')
  } else {
    for (const gap of packet.gaps) {
      const refs = [gap.moduleId, gap.mountId, gap.runId].filter(value => value !== undefined && value !== '')
      rows.push('<tr>')
      rows.push(`<td><span class="severity severity-${escapeHtml(statusClass(gap.severity))}">${escapeHtml(gap.severity)}</span></td>`)
      rows.push(`<td class="code">${escapeHtml(gap.code)}</td>`)
      rows.push(`<td>${escapeHtml(gap.message)}</td>`)
      rows.push(`<td class="code">${escapeHtml(refs.join(' · '))}</td>`)
      rows.push('</tr>')
    }
  }
  rows.push('</tbody></table>')
  return rows.join('\n')
}

function nextActionsHtml(packet) {
  if (packet.nextActions.length === 0) return '<p class="empty">（无待办）</p>'
  const items = packet.nextActions.map(action => {
    const refs = [action.runId, action.moduleCode].filter(value => value !== undefined && value !== '')
    const prefix = refs.length === 0 ? '' : `<span class="code">${escapeHtml(refs.join(' / '))}</span> `
    return `<li>${prefix}${escapeHtml(action.text)}</li>`
  })
  return `<ol class="actions">\n${items.join('\n')}\n</ol>`
}

const REVIEW_STYLE = `
:root {
  color-scheme: light dark;
  --bg: #f6f7fb;
  --surface: #ffffff;
  --ink: #1f2430;
  --muted: #5f6878;
  --line: #dde2ec;
  --accent: #2f55d4;
  --code: #f0f2f7;
  --error: #b3261e;
  --warn: #8a5a00;
  --info: #31558a;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  padding: 24px;
  background: var(--bg);
  color: var(--ink);
  font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}
main { max-width: 1180px; margin: 0 auto; }
h1 { margin: 0 0 8px; font-size: 26px; line-height: 1.25; overflow-wrap: anywhere; }
h2 { margin: 32px 0 12px; font-size: 19px; border-bottom: 2px solid var(--accent); padding-bottom: 6px; }
h3 { margin: 20px 0 8px; font-size: 16px; }
p { margin: 6px 0; }
header.review-header {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 22px;
  margin-bottom: 20px;
}
.eyebrow { margin: 0 0 6px; color: var(--muted); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
.meta { display: flex; flex-wrap: wrap; gap: 10px 18px; color: var(--muted); font-size: 13px; margin-top: 8px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 18px 0 0; }
.stat { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; }
.stat-value { font-size: 22px; font-weight: 700; }
.stat-label { color: var(--muted); font-size: 12px; }
section.card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px; margin: 16px 0; overflow-x: auto; }
table.data { width: 100%; border-collapse: collapse; font-size: 13px; }
table.data th, table.data td { border-bottom: 1px solid var(--line); padding: 7px 8px; text-align: left; vertical-align: top; }
table.data th { background: var(--code); font-weight: 600; white-space: nowrap; }
table.data ul { margin: 0; padding-left: 18px; }
tr.empty td { color: var(--muted); text-align: center; }
.code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; overflow-wrap: anywhere; }
.muted { color: var(--muted); font-size: 12px; font-weight: 400; }
.empty { color: var(--muted); }
.status, .severity { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 12px; background: var(--code); }
.status-done { color: #1b6b3a; }
.status-needs-rework, .severity-error { color: var(--error); }
.status-running, .status-blocked { color: var(--accent); }
.severity-warn { color: var(--warn); }
.severity-info { color: var(--info); }
.badge { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 999px; background: var(--code); }
.diagram { margin: 18px 0 26px; }
.diagram figcaption h3 { margin: 0 0 2px; }
.diagram-canvas { margin-top: 8px; border: 1px solid var(--line); border-radius: 8px; padding: 10px; background: var(--surface); overflow-x: auto; }
.diagram-canvas svg { display: block; width: 100%; height: auto; max-width: 100%; }
.diagram details.mermaid-source { margin-top: 8px; }
.diagram details.mermaid-source summary { cursor: pointer; color: var(--muted); font-size: 12px; }
pre.mermaid-source { background: var(--code); border: 1px solid var(--line); border-radius: 8px; padding: 12px; overflow-x: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
pre.mermaid-source code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
ol.actions { padding-left: 22px; }
ol.actions li { margin: 4px 0; }
footer { max-width: 1180px; margin: 28px auto 0; color: var(--muted); font-size: 12px; text-align: center; }
@media (max-width: 760px) {
  body { padding: 12px; }
  header.review-header, section.card { padding: 14px; }
  h1 { font-size: 21px; }
  table.data { font-size: 12px; }
}
@media print {
  :root { color-scheme: light; --bg: #ffffff; --surface: #ffffff; }
  body { padding: 0; background: #ffffff; }
  section.card, header.review-header { break-inside: avoid-page; border-color: #bbb; }
  table.data th { background: #eee; }
  h2 { break-after: avoid-page; }
  a { color: inherit; text-decoration: none; }
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14171d;
    --surface: #1c2029;
    --ink: #e6e9f0;
    --muted: #9aa4b5;
    --line: #303746;
    --accent: #7f9cff;
    --code: #232936;
    --error: #ff8f86;
    --warn: #f0c070;
    --info: #9db9e8;
  }
}
`

// Build the single-file offline review page. Returns an HTML document string; a
// page above REVIEW_MAX_BYTES (measured in encoded bytes) throws
// ReviewTooLargeError so the command layer can report a readable error. Each
// diagram SVG is bounded by the renderer's node cap (SVG_MAX_NODES) and node
// truncation note, so a single diagram cannot grow without bound; the 5MB cap
// remains the hard stop for the whole page.
export function exportReviewHtml(blueprint) {
  const packet = buildReviewPacket(blueprint)
  const svgByKey = renderSvgByKey(blueprint)
  const title = `${packet.title} · 蓝图评审`
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Blueprint Studio review">
<title>${escapeHtml(title)}</title>
<style>${REVIEW_STYLE}</style>
</head>
<body>
<main>
<header class="review-header">
<p class="eyebrow">Blueprint Studio · Review &amp; Handoff</p>
<h1>${escapeHtml(packet.title)}</h1>
<div class="meta">
<span>状态：<span class="status status-${escapeHtml(statusClass(packet.status))}">${escapeHtml(packet.status)}</span></span>
<span>生成时间：${escapeHtml(formatTimestamp(packet.generatedAt))}</span>
</div>
<div class="stats">
${statCard('层', packet.summary.layers)}
${statCard('模块', packet.summary.modules)}
${statCard('需求', packet.summary.requirements)}
${statCard('图解', packet.summary.diagrams)}
${statCard('挂载', packet.summary.mounts)}
${statCard('运行', packet.summary.runs)}
${statCard('进行中', packet.summary.activeRuns)}
${statCard('评审缺口', packet.summary.openGaps)}
</div>
</header>

<section class="card" id="requirements">
<h2>需求</h2>
${requirementsHtml(packet)}
</section>

<section class="card" id="modules">
<h2>模块</h2>
${modulesHtml(packet)}
</section>

<section class="card" id="mounts">
<h2>挂载</h2>
${mountsHtml(packet)}
</section>

<section class="card" id="diagrams">
<h2>图解</h2>
${diagramsHtml(packet, svgByKey)}
</section>

<section class="card" id="runs">
<h2>运行与证据</h2>
${runsHtml(packet)}
</section>

<section class="card" id="gaps">
<h2>评审缺口</h2>
${gapsHtml(packet)}
</section>

<section class="card" id="next-actions">
<h2>下一步</h2>
${nextActionsHtml(packet)}
</section>
</main>
<footer>由 Blueprint Studio 离线生成 · 单文件，无外部依赖</footer>
</body>
</html>
`
  const size = new TextEncoder().encode(html).byteLength
  if (size > REVIEW_MAX_BYTES) throw new ReviewTooLargeError(size)
  return html
}
