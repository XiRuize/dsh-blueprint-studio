import {
  ALL_NODE_TYPES,
  applyRunResult,
  archiveBlueprintVersion,
  blueprintAbsolutePath,
  blueprintContentHash,
  blueprintDigest,
  blueprintRelativePath,
  blueprintVersionsIndexRelativePath,
  buildDispatchPacket,
  claimConflicts,
  createConfirmTokenStore,
  deleteBlueprintFile,
  finishRun,
  mergeBlueprintForUpdate,
  normalizeBlueprint,
  parseBlueprintSaveInput,
  readBlueprintFile,
  readBlueprintVersion,
  readRunResult,
  readVersionsIndex,
  recordModuleVerification,
  rollbackPlanForRun,
  runEvidence,
  saveBlueprintFromCommand,
  semanticDiff,
  startRun,
  verifyBlueprintToken,
  writeBlueprintFile,
  writeHandoffJob,
  DIAGRAM_DEFS,
  RUN_ADAPTERS,
  RUN_LEASE_MS,
  SECTION_DEFS,
} from './lib/blueprint.js'
import { CHECK_RULES, analyzeBlueprint, coverageMatrix } from './lib/checks.js'
import { PLAN_CHECK_RULES, analyzePlan } from './lib/plan.js'
import { VALIDATE_RULES, validateDiagrams } from './lib/validate.js'
import { exportHtml, exportMarkdown } from './lib/export.js'
import { buildHandoff, buildReviewPacket, exportReviewHtml } from './lib/review.js'
import { buildProjectReview, exportProjectReviewHtml, readProjectBlueprints } from './lib/project-review.js'
import { PLAN_MODE_PROMPT } from './lib/plan.js'
import { scanWorkspace, suggestBlueprint } from './lib/scanner.js'
import { appendScanSnapshot, buildScanSnapshot, diffScanSnapshots, readScanHistory } from './lib/scan-history.js'
import * as scannerApi from './lib/scanner.js'
import { renderDiagramSvg } from './lib/svg.js'

export const name = 'blueprint-studio'
export const inject = ['tools']

// Preview → apply and check scan often run back-to-back. Keep the last scan
// briefly to avoid parsing the same tree twice; /blueprint scan always asks for
// a fresh scan. This is intentionally in-memory only: no stale cache on disk.
const scanCache = new Map()
const SCAN_CACHE_TTL_MS = 10_000
const SCAN_CACHE_LIMIT = 8

async function scanCached(cwd, { fresh = false } = {}) {
  const key = String(cwd)
  const hit = scanCache.get(key)
  if (!fresh && hit !== undefined && Date.now() - hit.at < SCAN_CACHE_TTL_MS) return hit.scan
  const scan = await scanWorkspace(cwd)
  scanCache.set(key, { at: Date.now(), scan })
  if (scanCache.size > SCAN_CACHE_LIMIT) {
    const oldest = [...scanCache.entries()].sort((left, right) => left[1].at - right[1].at)[0]
    if (oldest !== undefined) scanCache.delete(oldest[0])
  }
  return scan
}

const TOOL_DESCRIPTION = `在写代码之前，把需求整理成可协作的工程蓝图：需求栏目、用例图、数据流图、模块图、时序图、ER 图、C4 图、类图、状态图，以及用于编排实施步骤的计划流程图（可选），另有可独立分派的模块列表。

蓝图会保存到当前会话工作区的 .dsh/blueprints/<sessionId>.json，用户在「蓝图」面板中能直接看到、手工增删改，之后点击「确认并分派」。每次保存会自动归档上一版，可在「版本」里对比和恢复。

action:
- create：创建或整体覆盖蓝图（需要 blueprint 对象）。
- update：在已有蓝图上合并更新：sections 未提交的 items 沿用旧值，显式 items: [] 会清空；diagrams 按 layerId+type 对齐（root 兼容旧 key），节点/边按 id 合并，未提交的节点/边和子层图保留，用 removedNodeIds / removedEdgeIds / removedModuleIds / removedLayerIds / removedDiagramKeys 显式删除。
- get：读取当前蓝图全文；用户确认后、分派模块前必须先 get。
- confirm：已禁用。确认只能由用户在「蓝图」面板发起，Host 会校验一次性确认令牌。
- dispatch：已禁用。分派只能由用户在「蓝图」面板完成，Host 会校验一次性确认令牌。
- snapshot：把当前蓝图归档为一个手工版本（可传 label）。
- delete：删除当前会话的蓝图文件。

runs（执行账本）由 Host 拥有：工具 update 永远保留磁盘上的 runs，忽略补丁里的 runs；create 仅用于迁移旧数据时 seed，正常运行请由用户执行 /blueprint run start|evidence|complete|fail|cancel|prepare|collect|heartbeat 写入，不要用蓝图工具伪造运行状态。

blueprint 结构：
{
  "title": "一句话标题",
  "summary": "2-3 句方案摘要",
  "prompt": "用户的原始需求",
  "layers": [
    {"letter":"A","title":"总览","parentModuleId":null},
    {"letter":"B","title":"认证层","parentModuleId":"api"}
  ],
  "sections": [{"key":"goals|actors|functional|nonfunctional|constraints|acceptance|risks|自定义","title":"栏目名","items":[{"id":"i1","uid":"goals:i1","code":"R1","text":"条目文本","moduleId":"可选模块 id"}]}],
  "diagrams": [{
    "key": "usecase|dfd|module|sequence|er|c4|class|state|flowchart（仅 A 层）；子层用 \"B:dfd\"",
    "layerId": "A",
    "type": "usecase|dfd|module|sequence|er|c4|class|state|flowchart",
    "title": "图解名",
    "nodes": [{"id":"u1","type":"...","label":"名称","technology":"可选","description":"可选","parentGroup":"可选，同图 group 节点 id","condition":"可选，decision 条件","owner":"可选，负责人","verification":"可选，验证方式","collapsed":false,"requirementIds":["goals:i1"],"fields":[{"name":"id","type":"uuid","key":true}]}],
    "edges": [{"from":"u1","to":"u2","label":"标签","kind":"association|flow|depends|sync|async|return|relationship|dashed","cardinality":"1..*","order":1}]
  }],
  "modules": [{"id":"auth","name":"认证模块","layerId":"A","code":"A1","parentId":null,"summary":"范围、接口与验收要点","dependsOn":["db"],"nodeIds":["usecase:u1"],"files":["lib/auth.js"],"acceptance":["登录成功后返回会话令牌"],"status":"pending","verification":{"tests":{"status":"pending","evidence":[]},"reviewer":{"status":"pending","evidence":[]},"human":{"status":"pending","evidence":[]}}}]
}

分层规则：
- A 是根层（总览），始终存在；子层 letter 唯一，可写 A–Z、AA/AB…，id 与 letter 相同。
- 子层通过 parentModuleId 指向父层中的模块；父子不能成环，层数 ≤64，层级深度 ≤4（A 算第 1 层）。
- 模块保留稳定 id；layerId 默认 A，code 形如 A1/B1（前缀必须等于 layer.letter，全局唯一），parentId 在根层为 null、子层等于该层 parentModuleId。
- 仅根层 A 自动补齐原有 8 张图；计划流程图（flowchart）是第 9 张可选图，只有 diagrams 中显式出现时才创建（旧蓝图不会被自动补出）。子层只在 diagrams 显式出现时创建，对应 key 为 "<letter>:<type>"，同一 layer+type 唯一。
- 条目 uid 为 "<sectionKey>:<id>"，code 全局唯一且只增不改（R1/R2…）；可选 moduleId 指向模块 id，不存在时保留原值并由自检报告。
- 上限：需求条目 ≤2000、图实例 ≤256、模块 ≤500、层 ≤64、深度 ≤4；超出会返回可读错误，不会静默截断。

节点类型：
- usecase：actor、usecase、system。
- dfd：entity（外部实体）、process（处理）、store（数据存储）。
- module：module、external。
- sequence：participant、actor（用 kind=sync/async/return 表示同步/异步/返回消息，order 表示消息顺序）。
- er：entity（用 fields 写字段，key=true 表示主键）、relationship（菱形关系，边上写 cardinality）。
- c4：person、system、container、component、database、external（technology/description 写技术栈和职责）。
- flowchart：start（开始）、end（结束）、process（步骤）、decision（判断，用 condition 写条件）、group（阶段分组，label 必填，可 collapsed）、note（备注）；边 kind 只用 flow（实线，默认）或 dashed（虚线）；可用 parentGroup 把步骤归入同图的 group，用 owner/verification 写负责人和验证方式。

要求：
- 用例图至少包含 actor 与 usecase；需要系统边界时加一个 type=system 的节点。
- 数据流图用 entity → process → store 表达数据流，边上写数据名称。
- 模块图用 module 节点表达模块依赖，边用 depends。
- 时序图参与者放节点，消息放边，按 order 从上到下。
- ER 图实体字段写在 fields，关系边上写基数。
- C4 图用 technology 写技术选型，description 写职责。
- 计划流程图可选：用 start/end 界定范围，process 写可执行步骤，decision 的 condition 写分支条件，group 组织阶段并用 parentGroup 归属步骤；只在需要时显式创建 flowchart。
- 可追踪：节点用 requirementIds 引用 "<sectionKey>:<itemId>"（如 goals:i1）；模块用 nodeIds 引用 "<diagramKey>:<nodeId>"（如 usecase:u1），并用 files、acceptance 写清涉及文件与验收标准。
- 分层验证：模块的 verification 分 tests / reviewer / human 三层，只能由用户执行 /blueprint verify 写入；工具 update 会保留旧值，不能通过传 verification 绕过。任一层 failed 会把模块置为 needs-rework，三层全部 passed 才会置为 done，其余情况保持原状态。
- 模块拆分到「一个子代理能独立完成」的粒度，并在 summary 里写清交付物与验收标准。
- 不要编造用户没有提供的业务事实；不确定的写进 risks 栏目。`

const NODE_TYPES = ALL_NODE_TYPES

// The /blueprint check result is a single command payload. Keep it bounded even
// when a deliberately broken blueprint produces thousands of issues.
export const CHECK_ISSUE_LIMIT = 200

function errorMessage(error) {
  const message = (error instanceof Error ? error.message : String(error ?? '')).trim()
  return message === '' ? '未知错误' : message
}

function blueprintLayerIds(blueprint) {
  const layers = Array.isArray(blueprint?.layers) ? blueprint.layers : []
  const ids = []
  for (const layer of layers) {
    if (layer === null || typeof layer !== 'object') continue
    const id = String(layer.letter ?? layer.id ?? '').trim().toUpperCase()
    if (id !== '' && !ids.includes(id)) ids.push(id)
  }
  return ids
}

// Parse the scope of `/blueprint export <md|html> [all|<layer letter>]`.
// An omitted scope means the root layer A; `all` includes every layer.
export function parseExportScope(rawInput) {
  const value = String(rawInput ?? '').trim()
  if (value === '') return { ok: true, global: false, layerId: 'A' }
  if (value.toLowerCase() === 'all') return { ok: true, global: true, layerId: 'A' }
  const layerId = value.toUpperCase()
  if (!/^[A-Z]+$/u.test(layerId)) {
    return {
      ok: false,
      message: `无效的导出范围“${value}”。用法：/blueprint export md|html [all|层 letter]，例如 /blueprint export md A。`,
    }
  }
  return { ok: true, global: false, layerId }
}

// Cap the issues array without touching the source analysis. `summary` still
// counts every issue, while `truncated` tells the caller that the JSON list is
// a prefix of the full result.
export function truncateCheckIssues(issues, limit = CHECK_ISSUE_LIMIT) {
  const list = Array.isArray(issues) ? issues : []
  const max = Number.isInteger(limit) && limit >= 0 ? limit : CHECK_ISSUE_LIMIT
  const truncated = list.length > max
  return {
    issues: truncated ? list.slice(0, max) : list,
    truncated,
  }
}

export function decodeSnapshotLabel(raw) {
  const value = String(raw ?? '')
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// Parse `/blueprint run start <moduleId> [--adapter x] [--ttl minutes] [--by name]`.
// The parser is exported so the command surface can be tested without a filesystem.
// `--ttl` is deliberately expressed in whole minutes; the helper receives ms.
export function parseRunStartArgs(rawArgs) {
  const tokens = Array.isArray(rawArgs)
    ? rawArgs.map(token => String(token))
    : String(rawArgs ?? '').trim().split(/\s+/u).filter(token => token !== '')
  const positional = []
  const options = {}
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token === '--adapter' || token === '--ttl' || token === '--by') {
      const value = tokens[index + 1]
      if (value === undefined || value.startsWith('--')) {
        return { ok: false, message: `参数 ${token} 缺少取值。` }
      }
      options[token.slice(2)] = value
      index += 1
      continue
    }
    if (token.startsWith('--adapter=') || token.startsWith('--ttl=') || token.startsWith('--by=')) {
      const [key, ...value] = token.slice(2).split('=')
      options[key] = value.join('=')
      continue
    }
    if (token.startsWith('--')) return { ok: false, message: `未知参数：${token}。` }
    positional.push(token)
  }
  const moduleId = String(positional[0] ?? '').trim()
  if (moduleId === '') {
    return { ok: false, message: '用法：/blueprint run start <moduleId> [--adapter dsh-subagent|cli|http|manual] [--ttl minutes] [--by name]' }
  }
  const adapter = String(options.adapter ?? '').trim().toLowerCase()
  if (adapter !== '' && !RUN_ADAPTERS.includes(adapter)) {
    return { ok: false, message: `适配器无效：${adapter}（必须是 ${RUN_ADAPTERS.join('/')}）。` }
  }
  let ttlMs
  if (options.ttl !== undefined) {
    const minutes = Number(options.ttl)
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return { ok: false, message: `--ttl 必须是正数分钟，收到：${options.ttl}。` }
    }
    ttlMs = Math.round(minutes * 60_000)
  }
  return {
    ok: true,
    moduleId,
    adapter: adapter === '' ? undefined : adapter,
    ttlMs,
    claimedBy: String(options.by ?? '').trim() || undefined,
  }
}

// Parse `/blueprint run heartbeat <runId> [--ttl minutes]`. Heartbeat only renews
// the lease of a running/blocked run; it never changes the run status.
export function parseRunHeartbeatArgs(rawArgs) {
  const tokens = Array.isArray(rawArgs)
    ? rawArgs.map(token => String(token))
    : String(rawArgs ?? '').trim().split(/\s+/u).filter(token => token !== '')
  const positional = []
  let ttl
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token === '--ttl') {
      const value = tokens[index + 1]
      if (value === undefined || value.startsWith('--')) {
        return { ok: false, message: '参数 --ttl 缺少取值。' }
      }
      ttl = value
      index += 1
      continue
    }
    if (token.startsWith('--ttl=')) {
      ttl = token.slice('--ttl='.length)
      continue
    }
    if (token.startsWith('--')) return { ok: false, message: `未知参数：${token}。` }
    positional.push(token)
  }
  const runId = String(positional[0] ?? '').trim()
  if (runId === '' || positional.length > 1) {
    return { ok: false, message: '用法：/blueprint run heartbeat <runId> [--ttl minutes]' }
  }
  let ttlMs
  if (ttl !== undefined) {
    const minutes = Number(ttl)
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return { ok: false, message: `--ttl 必须是正数分钟，收到：${ttl}。` }
    }
    ttlMs = Math.round(minutes * 60_000)
  }
  return { ok: true, runId, ttlMs }
}

function objectArgs(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function summaryText(blueprint, path) {
  const digest = blueprintDigest(blueprint)
  const lines = [
    `蓝图：${digest.title}`,
    `状态：${digest.status}`,
    `文件：${path}`,
    '',
    '需求栏目：',
    ...digest.sections.map(section => `- ${section.title}（${section.items} 条）`),
    '',
    '层：',
    ...digest.layers.map(layer => `- ${layer.letter} ${layer.title}${layer.parentModuleId ? `（父：${layer.parentModuleId}）` : ''}`),
    '',
    '图解：',
    ...digest.diagrams.map(diagram => `- ${diagram.title}：${diagram.nodes} 节点 / ${diagram.edges} 连线`),
    '',
    '工作区挂载：',
    ...(digest.mounts.length === 0
      ? ['- 未绑定工作区']
      : digest.mounts.map(mount => `- ${mount.id} ${mount.label}：${mount.root}（${mount.kind}/${mount.access}）`)),
    '',
    '模块：',
    ...(digest.modules.length === 0
      ? ['- 未拆分']
      : digest.modules.map(module => `- ${module.name}${module.dependsOn.length > 0 ? `（依赖 ${module.dependsOn.join('、')}）` : ''}`)),
  ]
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Scan preview / layered structure apply (v0.15).
//
// Both helpers are pure: they never write to disk. The Host command wraps them
// with a scan and (for apply) a single blueprint save. Keeping them exported lets
// tests exercise the layered contract even when lib/scanner.js still emits the
// pre-v0.15 shape.
// ---------------------------------------------------------------------------

export const SCAN_PREVIEW_LIMITS = Object.freeze({
  maxTreeNodes: 200,
  maxTreeDepth: 8,
  maxDiagramNodes: 80,
  maxImportDiagramNodes: 40,
  maxImportDiagramEdges: 80,
  maxImportsDirectories: 40,
  maxImportAliases: 24,
  maxPackages: 30,
  maxHotspots: 10,
  maxInsights: 10,
  maxLanguages: 12,
})

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function listOf(value) {
  return Array.isArray(value) ? value : []
}

function textOf(value) {
  return value === null || value === undefined ? '' : String(value)
}

function cloneData(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function baseName(target) {
  const parts = textOf(target).split(/[\\/]/u).filter(Boolean)
  return parts.length === 0 ? '' : parts[parts.length - 1]
}

function testPath(relative) {
  const value = textOf(relative)
  return /(^|\/)(?:__tests__|tests?|specs?)\//iu.test(value)
    || /\.(?:test|spec)\.[A-Za-z0-9]+$/u.test(value)
}

function positiveInteger(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback
}

function normalizeLetter(value) {
  const letter = textOf(value).trim().toUpperCase()
  return /^[A-Z]+$/u.test(letter) && letter.length <= 2 ? letter : ''
}

function moduleReference(modules, reference) {
  const key = textOf(reference).trim().toLowerCase()
  if (key === '') return undefined
  return modules.find(module => textOf(module?.id).toLowerCase() === key
    || textOf(module?.code).toLowerCase() === key
    || textOf(module?.name).toLowerCase() === key)
}

function languageBuckets(raw, limit) {
  const buckets = isRecord(raw) ? raw : {}
  const entries = Object.entries(buckets)
    .filter(([name, value]) => name !== '' && isRecord(value))
    .sort((left, right) => positiveInteger(right[1].bytes, 0) - positiveInteger(left[1].bytes, 0))
  const result = {}
  for (const [name, value] of entries.slice(0, limit)) {
    result[name] = {
      files: positiveInteger(value.files, 0),
      bytes: positiveInteger(value.bytes, 0),
    }
  }
  return result
}

function previewTreeEntry(raw, basePath = '') {
  if (!isRecord(raw)) return undefined
  const name = textOf(raw.name ?? raw.label).trim() || baseName(raw.path) || baseName(basePath)
  if (name === '') return undefined
  const path = textOf(raw.path).trim() || (basePath === '' ? name : `${basePath}/${name}`)
  const children = listOf(raw.children ?? raw.items)
    .map(child => previewTreeEntry(child, path))
    .filter(child => child !== undefined)
  const explicitType = textOf(raw.type).toLowerCase()
  const type = explicitType === 'file' || explicitType === 'directory'
    ? explicitType
    : (children.length > 0 ? 'directory' : 'file')
  const node = {
    name,
    path,
    type,
    children,
    entryPoint: raw.entryPoint === true || raw.entry === true,
    test: raw.test === true || testPath(path),
  }
  if (typeof raw.size === 'number' && Number.isFinite(raw.size)) node.size = raw.size
  if (typeof raw.language === 'string' && raw.language !== '') node.language = raw.language
  return node
}

function stripHintTree(raw) {
  if (Array.isArray(raw)) return raw
  if (isRecord(raw) && (Array.isArray(raw.children) || raw.name !== undefined || raw.path !== undefined)) return [raw]
  return []
}

function buildFallbackTree(scan) {
  const rootName = baseName(scan.root) || 'root'
  const root = { name: rootName, path: '', type: 'directory', children: [], entryPoint: false, test: false }
  const byPath = new Map([['', root]])
  const ensureDirectory = relative => {
    const value = textOf(relative).replace(/^\.\//u, '').replace(/\/+$/u, '')
    if (value === '') return root
    if (byPath.has(value)) return byPath.get(value)
    const index = value.lastIndexOf('/')
    const parent = ensureDirectory(index < 0 ? '' : value.slice(0, index))
    const node = {
      name: value.slice(index + 1),
      path: value,
      type: 'directory',
      children: [],
      entryPoint: false,
      test: false,
    }
    parent.children.push(node)
    byPath.set(value, node)
    return node
  }
  for (const directory of listOf(scan.directories)) {
    if (textOf(directory).trim() === '') continue
    ensureDirectory(directory)
  }
  const entryPoints = new Set(listOf(scan.entryPoints).map(item => textOf(item)))
  for (const file of listOf(scan.files)) {
    const relative = textOf(file?.path).trim()
    if (relative === '') continue
    const index = relative.lastIndexOf('/')
    const parent = ensureDirectory(index < 0 ? '' : relative.slice(0, index))
    const node = {
      name: relative.slice(index + 1),
      path: relative,
      type: 'file',
      children: [],
      entryPoint: entryPoints.has(relative),
      test: testPath(relative),
    }
    if (typeof file.size === 'number' && Number.isFinite(file.size)) node.size = file.size
    if (typeof file.language === 'string' && file.language !== '') node.language = file.language
    parent.children.push(node)
  }
  return [root]
}

function sortTree(nodes) {
  nodes.sort((left, right) => {
    if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
    return left.name < right.name ? -1 : left.name > right.name ? 1 : 0
  })
  for (const node of nodes) sortTree(node.children)
  return nodes
}

function trimPreviewTree(roots, limits) {
  const state = { count: 0, truncated: false }
  const walk = (node, depth) => {
    if (state.count >= limits.maxTreeNodes) {
      state.truncated = true
      return undefined
    }
    state.count += 1
    const children = []
    if (depth >= limits.maxTreeDepth && node.children.length > 0) {
      state.truncated = true
    } else {
      for (const child of node.children) {
        if (state.count >= limits.maxTreeNodes) {
          state.truncated = true
          break
        }
        const trimmed = walk(child, depth + 1)
        if (trimmed !== undefined) children.push(trimmed)
      }
    }
    return { ...node, children }
  }
  const tree = []
  for (const root of roots) {
    const trimmed = walk(root, 0)
    if (trimmed === undefined) break
    tree.push(trimmed)
  }
  return { tree, truncated: state.truncated }
}

function previewHealth(scan, warnings) {
  const supplied = isRecord(scan.metrics?.health) ? scan.metrics.health : undefined
  if (supplied !== undefined && typeof supplied.score === 'number') return supplied
  let score = 100
  score -= Math.min(24, warnings.length * 4)
  const limits = isRecord(scan.limits) ? scan.limits : {}
  if (positiveInteger(scan.fileCount, 0) >= positiveInteger(limits.maxFiles, Number.POSITIVE_INFINITY)) score -= 6
  score = Math.max(0, Math.min(100, score))
  const level = score >= 85 ? 'low' : score >= 60 ? 'medium' : 'high'
  return { score, level }
}

function buildPreviewMetrics(scan, limits) {
  const supplied = isRecord(scan.metrics) ? scan.metrics : {}
  const files = listOf(scan.files)
  const fileCount = positiveInteger(supplied.totals?.files, positiveInteger(scan.fileCount, files.length))
  const totalBytes = positiveInteger(supplied.totals?.bytes, positiveInteger(scan.totalBytes, files.reduce((total, file) => total + positiveInteger(file?.size, 0), 0)))
  const directories = positiveInteger(supplied.totals?.directories, listOf(scan.directories).length)
  const packageCount = positiveInteger(supplied.totals?.packages, listOf(scan.packages).length)
  const languages = languageBuckets(isRecord(supplied.languages) ? supplied.languages : scan.languages, limits.maxLanguages)
  const suppliedPackages = listOf(supplied.packages)
  const packages = (suppliedPackages.length > 0 ? suppliedPackages : listOf(scan.packages).map(entry => ({
    name: textOf(entry?.name),
    relativePath: textOf(entry?.relativePath) || '.',
    kind: textOf(entry?.kind),
  }))).slice(0, limits.maxPackages)
  const suppliedHotspots = listOf(supplied.hotspots)
  const hotspots = (suppliedHotspots.length > 0
    ? suppliedHotspots
    : [...files]
        .sort((left, right) => positiveInteger(right?.size, 0) - positiveInteger(left?.size, 0))
        .slice(0, limits.maxHotspots)
        .map(file => ({ path: textOf(file?.path), size: positiveInteger(file?.size, 0) })))
    .slice(0, limits.maxHotspots)
  const warnings = listOf(scan.warnings).map(item => textOf(item)).filter(item => item !== '')
  const suppliedInsights = listOf(supplied.insights).map(item => textOf(item)).filter(item => item !== '')
  let insights = suppliedInsights
  if (insights.length === 0) {
    insights = [
      ...warnings.slice(0, 3),
      `扫描到 ${fileCount} 个文件、${packageCount} 个包；主要语言：${Object.keys(languages).slice(0, 3).join(', ') || '未知'}。`,
    ]
    if (listOf(scan.entryPoints).length > 0) insights.push(`识别出 ${listOf(scan.entryPoints).length} 个入口点。`)
    if (listOf(scan.testCommands).length > 0) insights.push(`可用测试命令：${listOf(scan.testCommands).slice(0, 3).join('、')}。`)
  }
  return {
    totals: { files: fileCount, bytes: totalBytes, directories, packages: packageCount },
    languages,
    packages,
    hotspots,
    insights: insights.slice(0, limits.maxInsights),
    health: previewHealth(scan, warnings),
  }
}

function importAliasList(raw, limits) {
  const values = []
  const push = value => {
    const text = textOf(value).trim()
    if (text !== '') values.push(text)
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (isRecord(item)) push(item.alias ?? item.prefix ?? item.from ?? item.name ?? item.path)
      else push(item)
    }
  } else if (isRecord(raw)) {
    for (const key of Object.keys(raw)) push(key)
  } else {
    push(raw)
  }
  return [...new Set(values)].slice(0, limits.maxImportAliases)
}

function buildPreviewImports(scan, suggestions, limits) {
  const supplied = isRecord(scan.imports) ? scan.imports : {}
  let edges
  if (Array.isArray(supplied.edges)) edges = supplied.edges.length
  else if (typeof supplied.edges === 'number' && Number.isFinite(supplied.edges)) edges = Math.max(0, Math.floor(supplied.edges))
  else {
    edges = listOf(suggestions.modules).reduce((total, module) => total + listOf(module?.dependsOn).length, 0)
  }
  const rawByDirectory = isRecord(supplied.byDirectory)
    ? supplied.byDirectory
    : Array.isArray(supplied.byDirectory)
      ? supplied.byDirectory
      : isRecord(supplied.byDir) ? supplied.byDir : Array.isArray(supplied.byDir) ? supplied.byDir : []
  const byDirectory = {}
  if (Array.isArray(rawByDirectory)) {
    for (const item of rawByDirectory.slice(0, limits.maxImportsDirectories)) {
      if (!isRecord(item)) continue
      const from = textOf(item.from).trim() || '.'
      const to = textOf(item.to).trim() || '.'
      byDirectory[`${from} → ${to}`] = positiveInteger(item.weight, 1)
    }
  } else {
    for (const [key, value] of Object.entries(rawByDirectory).slice(0, limits.maxImportsDirectories)) {
      byDirectory[key] = value
    }
  }
  let external
  if (Array.isArray(supplied.external)) external = supplied.external.length
  else if (typeof supplied.external === 'number' && Number.isFinite(supplied.external)) external = Math.max(0, Math.floor(supplied.external))
  else external = listOf(scan.externalDeps).length
  const aliases = importAliasList(supplied.aliases ?? supplied.alias ?? scan.aliases, limits)
  return { edges, byDirectory, external, aliases }
}

function directoryLabel(directory, rootName) {
  const value = textOf(directory).trim() || '.'
  const label = value === '.' || value === '' ? (rootName || 'root') : value
  return label.length > 64 ? `${label.slice(0, 61)}...` : label
}

function importDirectoryPairs(scan) {
  const supplied = isRecord(scan.imports) ? scan.imports : {}
  const pairs = new Map()
  const add = (from, to, weight) => {
    const left = textOf(from).trim() || '.'
    const right = textOf(to).trim() || '.'
    if (left === right) return
    const key = `${left}|${right}`
    const bucket = pairs.get(key)
    const value = positiveInteger(weight, 1) || 1
    if (bucket === undefined) pairs.set(key, { from: left, to: right, weight: value })
    else bucket.weight += value
  }
  const rawByDirectory = supplied.byDirectory ?? supplied.byDir
  if (Array.isArray(rawByDirectory)) {
    for (const item of rawByDirectory) {
      if (isRecord(item)) add(item.from, item.to, item.weight)
    }
  } else if (isRecord(rawByDirectory)) {
    for (const item of Object.values(rawByDirectory)) {
      if (isRecord(item) && item.from !== undefined && item.to !== undefined) add(item.from, item.to, item.weight)
    }
  }
  if (pairs.size === 0 && Array.isArray(supplied.edges)) {
    for (const edge of supplied.edges) {
      if (!isRecord(edge)) continue
      const fromDirectory = textOf(edge.from).includes('/')
        ? textOf(edge.from).split('/').slice(0, -1).join('/') || '.'
        : '.'
      const toDirectory = textOf(edge.to).includes('/')
        ? textOf(edge.to).split('/').slice(0, -1).join('/') || '.'
        : '.'
      add(fromDirectory, toDirectory, edge.weight)
    }
  }
  return pairs
}

function buildFallbackImportDiagram(scan, limits) {
  const rootName = baseName(scan.root) || 'root'
  const pairs = importDirectoryPairs(scan)
  const weights = new Map()
  const bump = (directory, direction, weight) => {
    const bucket = weights.get(directory) ?? { incoming: 0, outgoing: 0, total: 0 }
    bucket[direction] += weight
    bucket.total += weight
    weights.set(directory, bucket)
  }
  for (const pair of pairs.values()) {
    bump(pair.from, 'outgoing', pair.weight)
    bump(pair.to, 'incoming', pair.weight)
  }
  const directories = [...weights.entries()]
    .sort((left, right) => right[1].total - left[1].total || (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0))
    .slice(0, limits.maxImportDiagramNodes)
    .map(([directory]) => directory)
  const nodeIds = new Map(directories.map((directory, index) => [directory, `dir-${index}`]))
  const nodes = directories.map(directory => {
    const bucket = weights.get(directory) ?? { incoming: 0, outgoing: 0 }
    return {
      id: nodeIds.get(directory),
      type: 'module',
      label: directoryLabel(directory, rootName),
      technology: `${bucket.incoming} in / ${bucket.outgoing} out`,
    }
  })
  const edges = [...pairs.values()]
    .filter(pair => nodeIds.has(pair.from) && nodeIds.has(pair.to))
    .sort((left, right) => right.weight - left.weight
      || (left.from < right.from ? -1 : left.from > right.from ? 1 : 0)
      || (left.to < right.to ? -1 : left.to > right.to ? 1 : 0))
    .slice(0, limits.maxImportDiagramEdges)
    .map(pair => ({
      from: nodeIds.get(pair.from),
      to: nodeIds.get(pair.to),
      label: pair.weight > 1 ? String(pair.weight) : '',
      kind: 'depends',
    }))
  return {
    key: 'import-graph',
    layerId: 'A',
    type: 'module',
    title: 'Import graph',
    nodes,
    edges,
  }
}

function scannerImportDiagram(scan, limits) {
  // The scanner-side builder can land later (same release train, different
  // worktree). A namespace import lets us prefer it without a brittle dynamic
  // import, and the local directory aggregation is the always-available
  // fallback.
  if (typeof scannerApi.buildImportDiagram !== 'function') return undefined
  const attempts = [
    () => scannerApi.buildImportDiagram(scan),
    () => scannerApi.buildImportDiagram(scan, limits),
    () => scannerApi.buildImportDiagram(scan.imports),
  ]
  for (const attempt of attempts) {
    try {
      const candidate = attempt()
      if (!isRecord(candidate)) continue
      if (Array.isArray(candidate.nodes)) return candidate
      if (isRecord(candidate.diagram) && Array.isArray(candidate.diagram.nodes)) return candidate.diagram
      if (Array.isArray(candidate.diagrams)) {
        const diagram = candidate.diagrams.find(item => isRecord(item) && Array.isArray(item.nodes))
        if (diagram !== undefined) return diagram
      }
    } catch {
      // Try the next supported signature, then fall back to local aggregation.
    }
  }
  return undefined
}

function buildImportPreviewSvg(scan, limits) {
  try {
    const preferred = scannerImportDiagram(scan, limits)
    const diagram = preferred !== undefined && listOf(preferred.nodes).length > 0
      ? preferred
      : buildFallbackImportDiagram(scan, limits)
    const trimmed = trimPreviewDiagram(diagram, limits, {
      maxNodes: limits.maxImportDiagramNodes,
      maxEdges: limits.maxImportDiagramEdges,
      key: 'import-graph',
      title: 'Import graph',
    })
    return renderDiagramSvg(trimmed, { maxNodes: limits.maxImportDiagramNodes })
  } catch {
    return renderDiagramSvg({
      key: 'import-graph',
      type: 'module',
      title: 'Import graph',
      nodes: [],
      edges: [],
    })
  }
}

function previewModuleDiagram(suggestions) {
  const diagrams = [
    ...listOf(suggestions.diagrams),
    ...listOf(suggestions.layers).flatMap(layer => listOf(layer?.diagrams)),
  ].filter(diagram => isRecord(diagram))
  const modules = diagrams.filter(diagram => textOf(diagram.type).toLowerCase() === 'module')
  const root = modules.find(diagram => textOf(diagram.layerId).toUpperCase() === 'A')
  if (root !== undefined && listOf(root.nodes).length >= 2) return root
  const best = modules
    .slice()
    .sort((left, right) => listOf(right.nodes).length - listOf(left.nodes).length)[0]
  return best ?? root ?? { key: 'module', layerId: 'A', type: 'module', title: 'Repository structure', nodes: [], edges: [] }
}

function trimPreviewDiagram(diagram, limits, options = {}) {
  const source = isRecord(diagram) ? diagram : {}
  const maxNodes = positiveInteger(options.maxNodes, limits.maxDiagramNodes)
  const maxEdges = positiveInteger(options.maxEdges, maxNodes * 3)
  const nodes = listOf(source.nodes).filter(node => isRecord(node)).slice(0, maxNodes).map(node => cloneData(node))
  const nodeIds = new Set(nodes.map(node => textOf(node.id)))
  const edges = listOf(source.edges)
    .filter(edge => isRecord(edge) && nodeIds.has(textOf(edge.from)) && nodeIds.has(textOf(edge.to)))
    .slice(0, maxEdges)
    .map(edge => cloneData(edge))
  return {
    key: textOf(source.key) || textOf(options.key) || 'module',
    layerId: textOf(source.layerId) || 'A',
    type: textOf(source.type) || 'module',
    title: textOf(source.title) || textOf(options.title) || 'Repository structure',
    nodes,
    edges,
  }
}

export function buildScanPreview({ scan, suggestions, limits } = {}) {
  const source = isRecord(scan) ? scan : {}
  const suggested = isRecord(suggestions) ? suggestions : {}
  const mergedLimits = { ...SCAN_PREVIEW_LIMITS, ...(isRecord(limits) ? limits : {}) }
  const provided = stripHintTree(source.tree)
    .map(node => previewTreeEntry(node))
    .filter(node => node !== undefined)
  const baseTree = provided.length > 0 ? provided : buildFallbackTree(source)
  const sorted = sortTree(baseTree)
  const trimmed = trimPreviewTree(sorted, mergedLimits)
  const metrics = buildPreviewMetrics(source, mergedLimits)
  const imports = buildPreviewImports(source, suggested, mergedLimits)
  const svg = renderDiagramSvg(trimPreviewDiagram(previewModuleDiagram(suggested), mergedLimits))
  const importSvg = buildImportPreviewSvg(source, mergedLimits)
  const layers = listOf(suggested.layers).filter(layer => normalizeLetter(layer?.letter ?? layer?.id) !== '')
  return {
    ok: true,
    scan: {
      root: textOf(source.root),
      metrics,
      tree: trimmed.tree,
      languages: metrics.languages,
      packages: metrics.packages,
      hotspots: metrics.hotspots,
      insights: metrics.insights,
      imports,
      truncated: trimmed.truncated,
    },
    suggestions: {
      mounts: listOf(suggested.mounts).length,
      modules: listOf(suggested.modules).length,
      layers: layers.length === 0 ? 1 : layers.length,
      diagrams: listOf(suggested.diagrams).length,
    },
    svg,
    importSvg,
  }
}

function diagramIdentity(diagram) {
  const layerId = normalizeLetter(diagram?.layerId) || 'A'
  const rawKey = textOf(diagram?.key)
  let type = textOf(diagram?.type).trim().toLowerCase()
  if (type === '' && rawKey !== '') {
    const index = rawKey.indexOf(':')
    type = (index < 0 ? rawKey : rawKey.slice(index + 1)).toLowerCase()
  }
  return { layerId, type, key: layerId === 'A' ? type : `${layerId}:${type}` }
}

function moduleNode(module) {
  const label = `${textOf(module?.code)} ${textOf(module?.name)}`.trim()
  return {
    id: textOf(module?.id),
    type: 'module',
    label: label || textOf(module?.id),
    moduleId: textOf(module?.id),
  }
}

function edgeKey(edge) {
  return `${textOf(edge?.from)}|${textOf(edge?.to)}|${textOf(edge?.kind)}`
}

function addMissingEdges(target, edges, knownNodeIds) {
  const present = new Set(listOf(target?.edges).map(edgeKey))
  for (const edge of listOf(edges)) {
    if (!isRecord(edge)) continue
    if (!knownNodeIds.has(textOf(edge.from)) || !knownNodeIds.has(textOf(edge.to))) continue
    const key = edgeKey(edge)
    if (present.has(key)) continue
    present.add(key)
    target.edges.push(cloneData(edge))
  }
}

function mergeLayers(previousLayers, suggestedLayers, modules) {
  const previous = listOf(previousLayers).filter(layer => normalizeLetter(layer?.letter ?? layer?.id) !== '')
  const layers = []
  const byLetter = new Map()
  for (const layer of previous) {
    const letter = normalizeLetter(layer?.letter ?? layer?.id)
    if (byLetter.has(letter)) continue
    const entry = {
      letter,
      id: letter,
      title: textOf(layer?.title ?? layer?.name).trim() || (letter === 'A' ? 'Overview' : `Layer ${letter}`),
      parentModuleId: letter === 'A' ? null : textOf(layer?.parentModuleId).trim() || null,
    }
    byLetter.set(letter, entry)
    layers.push(entry)
  }
  if (!byLetter.has('A')) {
    const root = { letter: 'A', id: 'A', title: 'Overview', parentModuleId: null }
    byLetter.set('A', root)
    layers.unshift(root)
  } else {
    const root = byLetter.get('A')
    root.parentModuleId = null
    layers.sort((left, right) => (left.letter === 'A' ? -1 : right.letter === 'A' ? 1 : 0))
  }
  const previousLetters = new Set(previous.filter(layer => normalizeLetter(layer?.letter ?? layer?.id) !== '')
    .map(layer => normalizeLetter(layer?.letter ?? layer?.id)))
  const pending = listOf(suggestedLayers)
    .map(layer => {
      const letter = normalizeLetter(layer?.letter ?? layer?.id)
      return letter === '' || letter === 'A' || byLetter.has(letter) ? undefined : {
        letter,
        title: textOf(layer?.title ?? layer?.name).trim() || `Layer ${letter}`,
        parentModuleId: textOf(layer?.parentModuleId).trim(),
      }
    })
    .filter(layer => layer !== undefined)
  let progress = true
  while (progress) {
    progress = false
    for (let index = 0; index < pending.length; index += 1) {
      const layer = pending[index]
      const parent = moduleReference(modules, layer.parentModuleId)
      if (parent === undefined) continue
      if (!byLetter.has(textOf(parent.layerId).toUpperCase() || 'A')) continue
      const entry = {
        letter: layer.letter,
        id: layer.letter,
        title: layer.title,
        parentModuleId: textOf(parent.id),
      }
      byLetter.set(layer.letter, entry)
      layers.push(entry)
      pending.splice(index, 1)
      progress = true
      index -= 1
    }
  }
  return { layers, layersAdded: layers.filter(layer => !previousLetters.has(layer.letter)).length }
}

function mergeMounts(previousMounts, suggestedMounts) {
  const mounts = listOf(previousMounts).filter(mount => isRecord(mount)).map(cloneData)
  const ids = new Set(mounts.map(mount => textOf(mount.id)))
  const added = []
  for (const mount of listOf(suggestedMounts)) {
    if (!isRecord(mount)) continue
    const id = textOf(mount.id).trim()
    if (id === '' || ids.has(id)) continue
    ids.add(id)
    const entry = cloneData(mount)
    mounts.push(entry)
    added.push(entry)
  }
  return { mounts, mountsAdded: added.length }
}

function mergeModules(previousModules, suggestedModules) {
  const modules = listOf(previousModules).filter(module => isRecord(module)).map(cloneData)
  const hasPrevious = listOf(previousModules).some(module => isRecord(module))
  const ids = new Set(modules.map(module => textOf(module.id).toLowerCase()))
  const codes = new Set(modules.map(module => textOf(module.code).toUpperCase()).filter(code => code !== ''))
  const added = []
  for (const module of listOf(suggestedModules)) {
    if (!isRecord(module)) continue
    const layerId = normalizeLetter(module.layerId)
    const id = textOf(module.id).trim()
    const code = textOf(module.code).trim().toUpperCase()
    if (hasPrevious && (layerId === '' || layerId === 'A')) continue
    if (id === '' || ids.has(id.toLowerCase())) continue
    if (code !== '' && codes.has(code)) continue
    const entry = cloneData(module)
    modules.push(entry)
    added.push(entry)
    ids.add(id.toLowerCase())
    if (code !== '') codes.add(code)
  }
  return { modules, modulesAdded: added.length }
}

function buildModuleDiagram(modules, layerId = 'A') {
  const nodes = modules
    .filter(module => (normalizeLetter(module.layerId) || 'A') === layerId)
    .map(moduleNode)
  const ids = new Set(nodes.map(node => node.id))
  const edges = []
  for (const module of modules) {
    for (const dependency of listOf(module.dependsOn)) {
      if (ids.has(textOf(module.id)) && ids.has(textOf(dependency))) {
        edges.push({ from: textOf(module.id), to: textOf(dependency), label: 'depends', kind: 'depends' })
      }
    }
  }
  return { key: layerId === 'A' ? 'module' : `${layerId}:module`, layerId, type: 'module', title: 'Repository structure', nodes, edges }
}

export function mergeScanSuggestions({ previous, suggestions } = {}) {
  const current = isRecord(previous) ? previous : undefined
  const suggested = isRecord(suggestions) ? suggestions : {}
  const suggestedLayers = listOf(suggested.layers).filter(layer => isRecord(layer))
  const nestedModules = suggestedLayers.flatMap(layer => listOf(layer.modules).filter(module => isRecord(module)))
  const nestedDiagrams = suggestedLayers.flatMap(layer => listOf(layer.diagrams).filter(diagram => isRecord(diagram)))
  const suggestedModules = [...listOf(suggested.modules).filter(module => isRecord(module)), ...nestedModules]
  const mountResult = mergeMounts(current?.mounts, suggested.mounts)
  const moduleResult = mergeModules(current?.modules, suggestedModules)
  const candidateModules = moduleResult.modules
  const layerResult = mergeLayers(current?.layers, suggestedLayers, candidateModules)
  const layers = layerResult.layers
  const layerLetters = new Set(layers.map(layer => layer.letter))
  // A suggested module anchored to a layer that could not be applied must not be
  // persisted: the layered blueprint would reject it at save time.
  const modules = candidateModules.filter(module => {
    const layerId = normalizeLetter(module.layerId) || 'A'
    return layerLetters.has(layerId)
  })
  const moduleIds = new Set(modules.map(module => textOf(module.id)))
  const diagrams = listOf(current?.diagrams).filter(diagram => isRecord(diagram)).map(cloneData)
  const diagramKeys = new Set(diagrams.filter(diagram => isRecord(diagram)).map(diagramIdentity).map(identity => identity.key))
  const addDiagram = value => {
    if (!isRecord(value)) return false
    const identity = diagramIdentity(value)
    if (identity.type === '' || !layerLetters.has(identity.layerId) || diagramKeys.has(identity.key)) return false
    const entry = cloneData(value)
    entry.key = identity.key
    entry.layerId = identity.layerId
    entry.type = identity.type
    diagrams.push(entry)
    diagramKeys.add(identity.key)
    return true
  }
  const suggestedDiagrams = [...listOf(suggested.diagrams).filter(diagram => isRecord(diagram)), ...nestedDiagrams]
  const suggestedAModule = suggestedDiagrams.find(diagram => {
    const identity = diagramIdentity(diagram)
    return identity.layerId === 'A' && identity.type === 'module'
  })
  const existingAModule = diagrams.find(diagram => {
    const identity = diagramIdentity(diagram)
    return identity.layerId === 'A' && identity.type === 'module'
  })
  if (existingAModule !== undefined) {
    // Existing A modules stay; imported edges from the fresh scan are preferred,
    // and module.dependsOn fills any relationship the import scan did not catch.
    const nodes = listOf(existingAModule.nodes).filter(node => isRecord(node))
    existingAModule.nodes = nodes
    const nodeIds = new Set(nodes.map(node => textOf(node.id)))
    const rootModules = modules.filter(module => (normalizeLetter(module.layerId) || 'A') === 'A')
    for (const module of rootModules) {
      const id = textOf(module.id)
      if (id === '' || nodeIds.has(id)) continue
      nodes.push(moduleNode(module))
      nodeIds.add(id)
    }
    existingAModule.edges = listOf(existingAModule.edges).filter(edge => isRecord(edge))
    const known = nodeIds
    addMissingEdges(existingAModule, suggestedAModule?.edges, known)
    for (const module of rootModules) {
      const dependencies = listOf(module.dependsOn)
      addMissingEdges(existingAModule, dependencies.map(dependency => ({
        from: textOf(module.id), to: textOf(dependency), label: 'depends', kind: 'depends',
      })), known)
    }
  } else if (suggestedAModule !== undefined) {
    addDiagram(suggestedAModule)
  } else if (modules.length > 0) {
    addDiagram(buildModuleDiagram(modules, 'A'))
  }
  for (const diagram of suggestedDiagrams) {
    const identity = diagramIdentity(diagram)
    if (identity.layerId === 'A' && identity.type === 'module') continue
    addDiagram(diagram)
  }
  return {
    layers,
    modules,
    diagrams,
    mounts: mountResult.mounts,
    layersAdded: layerResult.layersAdded,
    modulesAdded: Math.max(0, modules.length - listOf(current?.modules).length),
    diagramsAdded: diagrams.length - listOf(current?.diagrams).length,
    mountsAdded: mountResult.mountsAdded,
  }
}

export function apply(ctx, rawConfig) {
  const config = objectArgs(rawConfig)
  const workingDirectory = ctx.get('workingDirectory')
  // Host-side gate: only the /blueprint confirm + dispatch commands can issue and spend
  // confirmation tokens. The tool handlers below can never create or consume one.
  const confirmTokens = createConfirmTokenStore({
    ttlMs: Number.isFinite(config.confirmTokenTtlMs) ? config.confirmTokenTtlMs : undefined,
  })

  const cwdOf = async agent => {
    const sessionCwd = agent?.session?.header?.cwd
    if (typeof sessionCwd === 'string' && sessionCwd !== '') return sessionCwd
    if (workingDirectory !== undefined && agent?.session !== undefined) {
      const fromSession = workingDirectory.get(agent.session)
      if (typeof fromSession === 'string' && fromSession !== '') return fromSession
    }
    if (workingDirectory !== undefined && agent !== undefined) {
      return await workingDirectory.ensure(agent)
    }
    if (workingDirectory?.defaultDirectory !== undefined) return workingDirectory.defaultDirectory
    return process.cwd()
  }

  const sessionIdOf = agent => agent?.id ?? 'session'

  const fileOf = async agent => {
    const cwd = await cwdOf(agent)
    const sessionId = sessionIdOf(agent)
    return {
      cwd,
      sessionId,
      absolute: blueprintAbsolutePath(cwd, sessionId),
      relative: blueprintRelativePath(sessionId),
    }
  }

  const readCurrent = async agent => {
    const file = await fileOf(agent)
    const raw = await readBlueprintFile(file.absolute)
    return { file, raw }
  }

  const archive = async (file, blueprint, source, label) => {
    if (blueprint === undefined || blueprint === null) return
    try {
      await archiveBlueprintVersion(file.cwd, file.sessionId, blueprint, { source, label })
    } catch (error) {
      ctx.logger?.warn?.(`blueprint-studio: could not archive version: ${String(error)}`)
    }
  }

  const definition = {
    name: 'blueprint',
    description: TOOL_DESCRIPTION,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'get', 'confirm', 'dispatch', 'snapshot', 'delete'],
          description: '要执行的操作；默认 get。',
        },
        blueprint: {
          type: 'object',
          additionalProperties: true,
          description: 'create/update 时提供的蓝图对象，结构见工具说明。',
        },
        title: { type: 'string', description: '可选：只更新标题。' },
        summary: { type: 'string', description: '可选：只更新摘要。' },
        prompt: { type: 'string', description: '可选：只更新原始需求。' },
        label: { type: 'string', description: 'snapshot 时的版本说明。' },
      },
      required: ['action'],
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render(_args, value) {
        if (value === null || typeof value !== 'object') return [{ type: 'text', text: String(value ?? '') }]
        const parts = []
        if (typeof value.message === 'string') parts.push(value.message)
        if (value.blueprint !== null && typeof value.blueprint === 'object') {
          parts.push('```json\n' + JSON.stringify(value.blueprint, null, 2) + '\n```')
        }
        if (parts.length === 0) parts.push(JSON.stringify(value, null, 2))
        return [{ type: 'text', text: parts.join('\n\n') }]
      },
    },
    timeoutMs: 30000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const input = objectArgs(args)
      const action = typeof input.action === 'string' ? input.action : 'get'
      const agent = exec?.agent

      if (action === 'get') {
        const { file, raw } = await readCurrent(agent)
        if (raw === undefined) {
          return { found: false, path: file.relative, absolutePath: file.absolute, message: '当前会话还没有工程蓝图。' }
        }
        const blueprint = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
        return {
          found: true,
          path: file.relative,
          absolutePath: file.absolute,
          blueprint,
          message: summaryText(blueprint, file.relative),
        }
      }

      if (action === 'delete') {
        const file = await fileOf(agent)
        const raw = await readBlueprintFile(file.absolute)
        if (raw !== undefined) await archive(file, normalizeBlueprint(raw, undefined, { sessionId: file.sessionId }), 'ui', 'before delete')
        const removed = await deleteBlueprintFile(file.absolute)
        return { removed, path: file.relative, message: removed ? `已删除蓝图 ${file.relative}` : '蓝图文件不存在。' }
      }

      if (action === 'snapshot') {
        const { file, raw } = await readCurrent(agent)
        if (raw === undefined) throw new Error('还没有工程蓝图，无法归档。')
        const current = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
        const archived = await archiveBlueprintVersion(file.cwd, file.sessionId, current, {
          source: 'manual',
          label: typeof input.label === 'string' ? input.label : '',
        })
        return {
          ok: true,
          skipped: archived?.skipped === true,
          path: file.relative,
          versionsPath: blueprintVersionsIndexRelativePath(file.sessionId),
          message: archived?.skipped === true ? '当前蓝图与最近版本相同，未新增版本。' : '已归档当前蓝图版本。',
        }
      }

      if (action === 'create' || action === 'update') {
        const patch = objectArgs(input.blueprint)
        if (Object.keys(patch).length === 0 && input.title === undefined && input.summary === undefined) {
          throw new Error('create/update 需要 blueprint 对象。')
        }
        const { file, raw } = await readCurrent(agent)
        const previous = raw === undefined ? undefined : normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
        const merged = {
          ...(action === 'update' ? previous ?? {} : {}),
          ...patch,
        }
        if (input.title !== undefined) merged.title = input.title
        if (input.summary !== undefined) merged.summary = input.summary
        if (input.prompt !== undefined) merged.prompt = input.prompt
        // Status is not part of the agent-writable surface: create always starts a draft,
        // and update keeps whatever status the Host/user flow already established. This
        // prevents passing status="confirmed"/"dispatched" through the tool.
        merged.status = action === 'create' ? 'draft' : (previous?.status ?? 'draft')
        const blueprint = action === 'update'
          ? mergeBlueprintForUpdate(previous, merged, { sessionId: file.sessionId })
          : normalizeBlueprint(merged, undefined, { sessionId: file.sessionId })
        await archive(file, previous, 'agent')
        await writeBlueprintFile(file.absolute, blueprint)
        if (previous === undefined) await archive(file, blueprint, 'agent', 'initial')
        return {
          ok: true,
          path: file.relative,
          absolutePath: file.absolute,
          digest: blueprintDigest(blueprint),
          message: `已保存 ${file.relative}\n\n${summaryText(blueprint, file.relative)}`,
        }
      }

      if (action === 'confirm' || action === 'dispatch') {
        // Deliberately stateless and source-rejecting: the agent must not be able to mark
        // its own blueprint as confirmed/dispatched. Only the user-driven command flow does.
        throw new Error(
          `工具 action="${action}" 已被禁用：确认与分派必须由用户在「蓝图」面板完成，Host 会校验一次性确认令牌。请让用户点击「确认并分派」。`,
        )
      }

      throw new Error(`不支持的 action：${action}`)
    },
  }

  ctx.effect(() => ctx.tools.register(definition))

  const commands = ctx.get('commands')
  if (commands !== undefined) {
    ctx.effect(() =>
      commands.register({
        name: 'blueprint',
        description: '蓝图工坊：保存、归档、对比、恢复、导出、评审交接、记录分层验收和自检当前会话的工程蓝图（界面调用）。',
        recordInput: false,
        input: { hint: 'save <base64-json> [--draft] | verify <moduleId> <tests|reviewer|human> <passed|failed|pending> [evidence] | confirm | dispatch <token> | versions | diff <from> <to> | restore <id> | snapshot <label> | path | get | export <md|html> [all|<层>] | review | review html | review handoff <runId> | review project [html] | check [scan] | run list | run start <moduleId> [--adapter x] [--ttl minutes] [--by name] | run evidence <runId> <text...> | run complete|fail|cancel <runId> [text...] | run rollback <runId> | run prepare <runId> | run collect <runId> | run heartbeat <runId> [--ttl minutes] | scan [preview|apply|snapshot|history|diff] | cancel <childSessionId>' },
        async handler(invocation) {
          const rawInput = String(invocation.rawInput ?? '').trim()
          const [sub, ...rest] = rawInput.split(/\s+/)
          if (sub === 'save') {
            const { encoded, draft, base, force } = parseBlueprintSaveInput(rest.join(' '))
            if (encoded === '') return { kind: 'error', text: '缺少蓝图数据。' }
            let parsed
            try {
              parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
            } catch {
              return { kind: 'error', text: '蓝图数据不是合法的 base64 JSON。' }
            }
            const { file, raw } = await readCurrent(invocation.agent)
            const previous = raw === undefined ? undefined : normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            const diskUpdatedAt = previous?.updatedAt
            if (!force && base !== undefined && previous !== undefined && Number(base) !== Number(diskUpdatedAt)) {
              return {
                kind: 'success',
                text: JSON.stringify({
                  ok: false,
                  code: 'conflict',
                  updatedAt: diskUpdatedAt,
                  path: file.relative,
                  message: '蓝图已被其他写入更新，请重新加载或选择保留我的修改。',
                }),
              }
            }
            if (force && previous !== undefined) {
              await archive(file, previous, 'ui', 'conflict: keep mine')
            }
            const saved = await saveBlueprintFromCommand({
              cwd: file.cwd,
              sessionId: file.sessionId,
              input: parsed,
              previous,
              draft,
              source: 'ui',
            })
            return {
              kind: 'success',
              text: JSON.stringify({
                ok: true,
                mode: saved.mode,
                archived: saved.archived,
                skipped: saved.skipped,
                archiveErrors: saved.archiveErrors,
                updatedAt: saved.blueprint.updatedAt,
                path: file.relative,
              }),
            }
          }
          if (sub === 'verify') {
            const moduleId = String(rest[0] ?? '').trim()
            const role = String(rest[1] ?? '').trim()
            const status = String(rest[2] ?? '').trim()
            const evidence = rest.slice(3).join(' ').trim()
            const usage = '用法：/blueprint verify <moduleId> <tests|reviewer|human> <passed|failed|pending> [evidence]'
            if (moduleId === '' || role === '' || status === '') {
              return { kind: 'error', text: `参数不足。${usage}` }
            }
            const { file, raw } = await readCurrent(invocation.agent)
            if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图，无法记录验证。' }
            const previous = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            // Only this user-driven command mutates verification. The agent tool's
            // update path preserves the previous value (see mergeBlueprintForUpdate).
            const blueprint = normalizeBlueprint(previous, undefined, { sessionId: file.sessionId })
            const result = recordModuleVerification(blueprint, { moduleId, role, status, evidence })
            if (!result.ok) return { kind: 'error', text: result.message }
            blueprint.updatedAt = Date.now()
            await archive(file, previous, 'ui', `verify ${result.moduleId} ${result.role} ${result.status}`)
            await writeBlueprintFile(file.absolute, blueprint)
            return {
              kind: 'success',
              text: JSON.stringify({
                ok: true,
                moduleId: result.moduleId,
                role: result.role,
                status: result.status,
                moduleStatus: result.moduleStatus,
                evidence: result.evidence,
                at: result.at,
                verification: result.verification,
                path: file.relative,
              }),
            }
          }
          if (sub === 'confirm') {
            const { file, raw } = await readCurrent(invocation.agent)
            if (raw === undefined) return { kind: 'error', text: '还没有工程蓝图，无法确认。' }
            const previous = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            if (previous.status === 'dispatched') {
              return { kind: 'error', text: '蓝图已分派，不能再次确认；如需重新分派请先创建新蓝图或恢复版本。' }
            }
            const blueprint = normalizeBlueprint(previous, undefined, { sessionId: file.sessionId })
            blueprint.status = 'confirmed'
            blueprint.updatedAt = Date.now()
            const hash = blueprintContentHash(blueprint)
            await archive(file, previous, 'ui', 'before confirm')
            await writeBlueprintFile(file.absolute, blueprint)
            const issued = confirmTokens.issue(file.sessionId, hash)
            return {
              kind: 'success',
              text: JSON.stringify({
                ok: true,
                status: blueprint.status,
                token: issued.token,
                hash: issued.hash,
                createdAt: issued.createdAt,
                expiresAt: issued.expiresAt,
                path: file.relative,
              }),
            }
          }
          if (sub === 'dispatch') {
            const token = String(rest[0] ?? '').trim()
            if (token === '') {
              return {
                kind: 'error',
                text: '缺少确认令牌。用法：/blueprint dispatch <token>（请先由用户执行 /blueprint confirm）。',
              }
            }
            const { file, raw } = await readCurrent(invocation.agent)
            if (raw === undefined) return { kind: 'error', text: '还没有工程蓝图，无法分派。' }
            const previous = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            const blueprint = normalizeBlueprint(previous, undefined, { sessionId: file.sessionId })
            const checked = verifyBlueprintToken(confirmTokens, file.sessionId, token, blueprint)
            if (!checked.ok) return { kind: 'error', text: checked.message }
            const consumed = confirmTokens.consume(file.sessionId, token)
            if (!consumed.ok) return { kind: 'error', text: consumed.message }
            blueprint.status = 'dispatched'
            blueprint.updatedAt = Date.now()
            await archive(file, previous, 'ui', 'before dispatch')
            await writeBlueprintFile(file.absolute, blueprint)
            return {
              kind: 'success',
              text: JSON.stringify({
                ok: true,
                status: blueprint.status,
                path: file.relative,
                modules: blueprint.modules,
                summary: summaryText(blueprint, file.relative),
              }),
            }
          }
          if (sub === 'snapshot') {
            const { file, raw } = await readCurrent(invocation.agent)
            if (raw === undefined) return { kind: 'error', text: '还没有工程蓝图。' }
            const current = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            const label = decodeSnapshotLabel(rest.join(' '))
            await archive(file, current, 'manual', label)
            return { kind: 'success', text: '当前蓝图已归档。' }
          }
          if (sub === 'versions') {
            const file = await fileOf(invocation.agent)
            const index = await readVersionsIndex(file.cwd, file.sessionId)
            const raw = await readBlueprintFile(file.absolute)
            const current = raw === undefined ? undefined : normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            return {
              kind: 'success',
              text: JSON.stringify({
                current: current === undefined ? undefined : {
                  title: current.title,
                  status: current.status,
                  updatedAt: current.updatedAt,
                  counts: blueprintDigest(current),
                },
                versions: index.versions,
                index: blueprintVersionsIndexRelativePath(file.sessionId),
              }),
            }
          }
          if (sub === 'diff') {
            const file = await fileOf(invocation.agent)
            const [fromId, toId] = rest
            const currentRaw = await readBlueprintFile(file.absolute)
            const resolve = async id => {
              if (id === undefined || id === 'current') {
                return currentRaw === undefined ? undefined : normalizeBlueprint(currentRaw, undefined, { sessionId: file.sessionId })
              }
              const version = await readBlueprintVersion(file.cwd, file.sessionId, id)
              return version === undefined ? undefined : normalizeBlueprint(version, undefined, { sessionId: file.sessionId })
            }
            const before = await resolve(fromId)
            const after = await resolve(toId)
            if (before === undefined || after === undefined) return { kind: 'error', text: '版本不存在。' }
            return { kind: 'success', text: JSON.stringify(semanticDiff(before, after)) }
          }
          if (sub === 'restore') {
            const file = await fileOf(invocation.agent)
            const id = rest[0]
            const target = id === undefined ? undefined : await readBlueprintVersion(file.cwd, file.sessionId, id)
            if (target === undefined) return { kind: 'error', text: '版本不存在。' }
            const currentRaw = await readBlueprintFile(file.absolute)
            const current = currentRaw === undefined ? undefined : normalizeBlueprint(currentRaw, undefined, { sessionId: file.sessionId })
            if (current !== undefined) await archive(file, current, 'ui', `before restore ${id}`)
            const restored = normalizeBlueprint(target, current, { sessionId: file.sessionId })
            restored.updatedAt = Date.now()
            await writeBlueprintFile(file.absolute, restored)
            return { kind: 'success', text: `已恢复到 ${id}：${file.relative}` }
          }
          if (sub === 'path') {
            const file = await fileOf(invocation.agent)
            return { kind: 'success', text: file.relative }
          }
          if (sub === 'get') {
            const { file, raw } = await readCurrent(invocation.agent)
            if (raw === undefined) return { kind: 'success', text: '当前会话还没有工程蓝图。' }
            return { kind: 'success', text: JSON.stringify(raw) }
          }
          if (sub === 'export') {
            const format = String(rest[0] ?? '').trim().toLowerCase()
            if (format !== 'md' && format !== 'html') {
              return {
                kind: 'error',
                text: '用法：/blueprint export <md|html> [all|层 letter]，例如 /blueprint export md A。',
              }
            }
            const scope = parseExportScope(rest.slice(1).join(' '))
            if (!scope.ok) return { kind: 'error', text: scope.message }
            let file
            let raw
            try {
              const current = await readCurrent(invocation.agent)
              file = current.file
              raw = current.raw
            } catch (error) {
              return { kind: 'error', text: `读取蓝图失败：${errorMessage(error)}` }
            }
            if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图，无法导出。' }
            let blueprint
            try {
              blueprint = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            } catch (error) {
              return { kind: 'error', text: `蓝图数据无法规范化，导出失败：${errorMessage(error)}` }
            }
            const layerIds = blueprintLayerIds(blueprint)
            if (!scope.global && !layerIds.includes(scope.layerId)) {
              return {
                kind: 'error',
                text: `层 ${scope.layerId} 不存在，无法导出。可用层：${layerIds.join('、') || 'A'}。`,
              }
            }
            const options = scope.global ? { global: true } : { layerId: scope.layerId }
            try {
              const text = format === 'md'
                ? exportMarkdown(blueprint, options)
                : exportHtml(blueprint, options)
              return { kind: 'success', text }
            } catch (error) {
              if (error?.code === 'export-too-large') return { kind: 'error', text: error.message }
              const label = format === 'md' ? 'Markdown' : 'HTML'
              return { kind: 'error', text: `${label} 导出失败：${errorMessage(error)}` }
            }
          }
          if (sub === 'packet') {
            const moduleId = String(rest[0] ?? '').trim()
            if (moduleId === '') return { kind: 'error', text: '用法：/blueprint packet <moduleId>。' }
            const { file, raw } = await readCurrent(invocation.agent)
            if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图。' }
            const blueprint = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            const packet = buildDispatchPacket(blueprint, moduleId)
            if (packet === undefined) return { kind: 'error', text: `模块 ${moduleId} 不存在。` }
            return { kind: 'success', text: JSON.stringify(packet) }
          }
          if (sub === 'review') {
            const reviewUsage = '用法：/blueprint review | review html | review handoff <runId> | review project [html]'
            const projectUsage = '用法：/blueprint review project [html]'
            const format = String(rest[0] ?? '').trim().toLowerCase()
            if (rest.length > 0 && format !== 'html' && format !== 'handoff' && format !== 'project') {
              return { kind: 'error', text: reviewUsage }
            }
            if (format === 'html' && rest.length > 1) {
              return { kind: 'error', text: reviewUsage }
            }
            if (format === 'handoff' && rest.length !== 2) {
              return { kind: 'error', text: '用法：/blueprint review handoff <runId>。' }
            }
            if (format === 'project') {
              const projectFormat = String(rest[1] ?? '').trim().toLowerCase()
              if (rest.length > 2 || (rest.length === 2 && projectFormat !== 'html')) {
                return { kind: 'error', text: projectUsage }
              }
              let cwd
              try {
                const current = await readCurrent(invocation.agent)
                cwd = current.file.cwd
              } catch (error) {
                return { kind: 'error', text: `读取工作区失败：${errorMessage(error)}` }
              }
              const project = await readProjectBlueprints(cwd)
              if (projectFormat === 'html') {
                try {
                  return { kind: 'success', text: exportProjectReviewHtml(project) }
                } catch (error) {
                  if (error?.code === 'review-too-large') return { kind: 'error', text: error.message }
                  return { kind: 'error', text: `项目评审页面生成失败：${errorMessage(error)}` }
                }
              }
              return { kind: 'success', text: JSON.stringify(buildProjectReview(project)) }
            }
            let file
            let raw
            try {
              const current = await readCurrent(invocation.agent)
              file = current.file
              raw = current.raw
            } catch (error) {
              return { kind: 'error', text: `读取蓝图失败：${errorMessage(error)}` }
            }
            if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图，无法评审。' }
            let blueprint
            try {
              blueprint = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            } catch (error) {
              return { kind: 'error', text: `蓝图数据无法规范化，评审失败：${errorMessage(error)}` }
            }
            if (format === 'html') {
              try {
                return { kind: 'success', text: exportReviewHtml(blueprint) }
              } catch (error) {
                if (error?.code === 'review-too-large') return { kind: 'error', text: error.message }
                return { kind: 'error', text: `评审页面生成失败：${errorMessage(error)}` }
              }
            }
            if (format === 'handoff') {
              const runId = String(rest[1] ?? '').trim()
              const handoff = buildHandoff(blueprint, runId)
              if (handoff === undefined) {
                return { kind: 'error', text: `运行 ${runId} 不存在，或它指向的模块已不存在，无法交接。` }
              }
              return { kind: 'success', text: JSON.stringify(handoff) }
            }
            return { kind: 'success', text: JSON.stringify(buildReviewPacket(blueprint)) }
          }
          if (sub === 'run') {
            const runUsage = '用法：/blueprint run list | start <moduleId> [--adapter dsh-subagent|cli|http|manual] [--ttl minutes] [--by name] | evidence <runId> <text...> | complete|fail|cancel <runId> [text...] | rollback <runId> | prepare <runId> | collect <runId> | heartbeat <runId> [--ttl minutes]'
            const action = String(rest[0] ?? '').trim().toLowerCase()
            const args = rest.slice(1)
            if (action === 'prepare') {
              const runId = String(args[0] ?? '').trim()
              if (runId === '' || args.length > 1) return { kind: 'error', text: runUsage }
              const { file, raw } = await readCurrent(invocation.agent)
              if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图，无法准备交接。' }
              const blueprint = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
              let written
              try {
                written = await writeHandoffJob(file.cwd, file.sessionId, blueprint, runId)
              } catch (error) {
                return { kind: 'error', text: `准备交接失败：${errorMessage(error)}` }
              }
              return {
                kind: 'success',
                text: JSON.stringify({
                  ok: true,
                  runId: written.handoff.runId,
                  handoff: written.handoff,
                  path: written.relativePath,
                  absolutePath: written.absolutePath,
                  blueprintPath: file.relative,
                  auto: false,
                }),
              }
            }
            if (action === 'collect') {
              const runId = String(args[0] ?? '').trim()
              if (runId === '' || args.length > 1) return { kind: 'error', text: runUsage }
              const { file, raw } = await readCurrent(invocation.agent)
              if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图，无法收集结果。' }
              const previous = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
              const read = await readRunResult(file.cwd, file.sessionId, runId)
              if (!read.ok) return { kind: 'error', text: read.error }
              const applied = applyRunResult(previous, read.result)
              if (!applied.ok) return { kind: 'error', text: applied.error }
              const blueprint = applied.blueprint
              blueprint.updatedAt = Date.now()
              await archive(file, previous, 'ui', `run collect ${applied.run.status}`)
              await writeBlueprintFile(file.absolute, blueprint)
              return {
                kind: 'success',
                text: JSON.stringify({
                  ok: true,
                  run: applied.run,
                  warnings: applied.warnings,
                  resultPath: read.relativePath,
                  path: file.relative,
                }),
              }
            }
            if (action === 'heartbeat') {
              const parsed = parseRunHeartbeatArgs(args)
              if (!parsed.ok) return { kind: 'error', text: parsed.message }
              const { file, raw } = await readCurrent(invocation.agent)
              if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图，无法续租。' }
              const previous = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
              const existing = (previous.runs ?? []).find(run => String(run.id) === parsed.runId)
              if (existing === undefined) return { kind: 'error', text: `执行记录不存在：${parsed.runId}。` }
              const status = String(existing.status ?? '').toLowerCase()
              if (status !== 'running' && status !== 'blocked') {
                return { kind: 'error', text: `执行记录 ${parsed.runId} 已结束（${status}），不能再续租。` }
              }
              const now = Date.now()
              const run = { ...existing, leaseUntil: now + (parsed.ttlMs ?? RUN_LEASE_MS) }
              const blueprint = {
                ...previous,
                runs: (previous.runs ?? []).map(entry => (String(entry.id) === parsed.runId ? run : entry)),
                updatedAt: now,
              }
              await archive(file, previous, 'ui', 'run heartbeat')
              await writeBlueprintFile(file.absolute, blueprint)
              return { kind: 'success', text: JSON.stringify({ ok: true, run, path: file.relative }) }
            }
            if (action === 'list') {
              if (args.length > 0) return { kind: 'error', text: runUsage }
              const { file, raw } = await readCurrent(invocation.agent)
              if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图。' }
              const blueprint = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
              return {
                kind: 'success',
                text: JSON.stringify({
                  ok: true,
                  runs: blueprint.runs,
                  claims: claimConflicts(blueprint),
                  path: file.relative,
                }),
              }
            }
            if (action === 'start') {
              const parsed = parseRunStartArgs(args)
              if (!parsed.ok) return { kind: 'error', text: parsed.message }
              const { file, raw } = await readCurrent(invocation.agent)
              if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图，无法启动运行。' }
              const previous = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
              const started = startRun(previous, {
                moduleId: parsed.moduleId,
                adapter: parsed.adapter,
                ttlMs: parsed.ttlMs,
                claimedBy: parsed.claimedBy,
              })
              if (!started.ok) return { kind: 'error', text: started.error }
              const blueprint = started.blueprint
              blueprint.updatedAt = Date.now()
              await archive(file, previous, 'ui', 'run start')
              await writeBlueprintFile(file.absolute, blueprint)
              return {
                kind: 'success',
                text: JSON.stringify({ ok: true, run: started.run, path: file.relative }),
              }
            }
            if (action === 'evidence') {
              const runId = String(args[0] ?? '').trim()
              const evidenceText = args.slice(1).join(' ').trim()
              if (runId === '' || evidenceText === '') return { kind: 'error', text: runUsage }
              const { file, raw } = await readCurrent(invocation.agent)
              if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图。' }
              const previous = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
              const appended = runEvidence(previous, runId, evidenceText)
              if (!appended.ok) return { kind: 'error', text: appended.error }
              const blueprint = appended.blueprint
              blueprint.updatedAt = Date.now()
              await archive(file, previous, 'ui', 'run evidence')
              await writeBlueprintFile(file.absolute, blueprint)
              return {
                kind: 'success',
                text: JSON.stringify({ ok: true, run: appended.run, path: file.relative }),
              }
            }
            if (action === 'complete' || action === 'fail' || action === 'cancel') {
              const runId = String(args[0] ?? '').trim()
              if (runId === '') return { kind: 'error', text: runUsage }
              const status = action === 'complete' ? 'done' : action === 'fail' ? 'failed' : 'cancelled'
              const summary = args.slice(1).join(' ').trim()
              const { file, raw } = await readCurrent(invocation.agent)
              if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图。' }
              const previous = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
              const finished = finishRun(previous, runId, { status, summary })
              if (!finished.ok) return { kind: 'error', text: finished.error }
              const blueprint = finished.blueprint
              blueprint.updatedAt = Date.now()
              await archive(file, previous, 'ui', `run ${action}`)
              await writeBlueprintFile(file.absolute, blueprint)
              return {
                kind: 'success',
                text: JSON.stringify({
                  ok: true,
                  run: finished.run,
                  warning: finished.warning,
                  path: file.relative,
                }),
              }
            }
            if (action === 'rollback') {
              const runId = String(args[0] ?? '').trim()
              if (runId === '' || args.length > 1) return { kind: 'error', text: runUsage }
              const { file, raw } = await readCurrent(invocation.agent)
              if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图。' }
              const blueprint = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
              const planned = rollbackPlanForRun(blueprint, runId)
              if (!planned.ok) return { kind: 'error', text: planned.error }
              return {
                kind: 'success',
                text: JSON.stringify({ ok: true, plan: planned.plan, path: file.relative }),
              }
            }
            return { kind: 'error', text: runUsage }
          }
          if (sub === 'check') {
            const checkScan = rest[0] === 'scan'
            if (rest.length > 1 || (rest.length === 1 && !checkScan)) return { kind: 'error', text: '用法：/blueprint check [scan]。' }
            let blueprint
            let cwd = ''
            try {
              const { file, raw } = await readCurrent(invocation.agent)
              if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图，无法自检。' }
              cwd = file.cwd
              blueprint = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            } catch (error) {
              return { kind: 'error', text: `蓝图自检失败：无法读取或规范化蓝图（${errorMessage(error)}）。` }
            }
            let result
            try {
              const analyzed = analyzeBlueprint(blueprint)
              const hasFlowchart = (blueprint.diagrams ?? []).some(diagram => diagram.type === 'flowchart' || diagram.key === 'flowchart' || String(diagram.key).endsWith(':flowchart'))
              const planned = hasFlowchart ? analyzePlan(blueprint) : { issues: [], coverage: null }
              const deep = validateDiagrams(blueprint)
              const issues = [...analyzed.issues, ...planned.issues, ...deep.issues]
              let scanCoverage = null
              const scanRules = []
              if (checkScan) {
                try {
                  const scan = await scanCached(cwd)
                  scanCoverage = {
                    health: scan.metrics?.totals ? scan.metrics.health ?? null : null,
                    insights: scan.metrics?.insights ?? [],
                    languages: scan.metrics?.totals?.languages ?? [],
                    packages: (scan.metrics?.packages ?? []).map(entry => ({ name: entry.name, health: entry.health ?? null })),
                  }
                  const seen = new Set()
                  for (const insight of scanCoverage.insights) {
                    const code = `scan-${String(insight.code ?? 'insight').replace(/[^a-z0-9-]+/giu, '-')}`
                    issues.push({
                      code,
                      severity: insight.severity === 'error' ? 'error' : insight.severity === 'warn' ? 'warn' : 'info',
                      message: insight.message,
                      diagramKey: 'scan',
                      nodeId: insight.subject ?? '',
                      fix: insight.fix ?? '',
                    })
                    if (!seen.has(code)) {
                      seen.add(code)
                      scanRules.push({ code, severity: insight.severity ?? 'info', title: insight.code ?? code })
                    }
                  }
                } catch (error) {
                  issues.push({
                    code: 'scan-failed', severity: 'warn', message: `仓库扫描失败：${errorMessage(error)}`,
                    diagramKey: 'scan', fix: '确认工作目录可读后重试 /blueprint check scan。',
                  })
                }
              }
              const summary = { error: 0, warn: 0, info: 0 }
              for (const issue of issues) {
                if (summary[issue.severity] !== undefined) summary[issue.severity] += 1
              }
              result = {
                issues,
                coverage: { ...coverageMatrix(blueprint), plan: planned.coverage, validation: deep.coverage, scan: scanCoverage },
                summary,
                rules: [...CHECK_RULES, ...PLAN_CHECK_RULES, ...VALIDATE_RULES, ...scanRules],
              }
            } catch (error) {
              return { kind: 'error', text: `蓝图自检失败：${errorMessage(error)}` }
            }
            const limited = truncateCheckIssues(result.issues)
            return {
              kind: 'success',
              text: JSON.stringify({
                issues: limited.issues,
                coverage: result.coverage,
                summary: result.summary,
                rules: result.rules,
                truncated: limited.truncated,
              }),
            }
          }
          if (sub === 'scan') {
            const mode = String(rest[0] ?? '').trim()
            if (mode === 'preview') {
              try {
                const cwd = await cwdOf(invocation.agent)
                const scan = await scanCached(cwd)
                const suggestions = suggestBlueprint(scan)
                const preview = buildScanPreview({ scan, suggestions })
                return { kind: 'success', text: JSON.stringify(preview) }
              } catch (error) {
                return { kind: 'error', text: `扫描预览失败：${errorMessage(error)}` }
              }
            }
            if (mode === 'apply') {
              try {
                const { file, raw } = await readCurrent(invocation.agent)
                const scan = await scanCached(file.cwd)
                const suggestions = suggestBlueprint(scan)
                const previous = raw === undefined ? undefined : normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
                const merged = mergeScanSuggestions({ previous, suggestions })
                const title = previous?.title || baseName(scan.root) || 'Repository structure'
                const input = previous === undefined
                  ? {
                      title,
                      summary: 'Repository structure generated by workspace scan; refine before confirmation.',
                      prompt: 'Understand the existing repository structure and module dependencies before changing code.',
                      status: 'draft',
                      layers: merged.layers,
                      sections: SECTION_DEFS.map(def => ({ key: def.key, title: def.title, items: [] })),
                      mounts: merged.mounts,
                      modules: merged.modules,
                      diagrams: merged.diagrams,
                    }
                  : {
                      ...previous,
                      layers: merged.layers,
                      mounts: merged.mounts,
                      modules: merged.modules,
                      diagrams: merged.diagrams,
                    }
                const saved = await saveBlueprintFromCommand({
                  cwd: file.cwd,
                  sessionId: file.sessionId,
                  input,
                  previous,
                  source: 'ui',
                })
                return {
                  kind: 'success',
                  text: JSON.stringify({
                    ok: true,
                    mountsAdded: merged.mountsAdded,
                    modulesAdded: merged.modulesAdded,
                    layersAdded: merged.layersAdded,
                    diagramsAdded: merged.diagramsAdded,
                    path: file.relative,
                    updatedAt: saved.blueprint.updatedAt,
                  }),
                }
              } catch (error) {
                return { kind: 'error', text: `扫描应用失败：${errorMessage(error)}` }
              }
            }
            if (mode === 'snapshot') {
              try {
                const { file } = await readCurrent(invocation.agent)
                const scan = await scanCached(file.cwd, { fresh: true })
                const label = rest.slice(1).join(' ').trim()
                const snapshot = buildScanSnapshot(scan, label)
                const saved = await appendScanSnapshot(file.cwd, file.sessionId, snapshot)
                return {
                  kind: 'success',
                  text: JSON.stringify({
                    ok: true,
                    snapshot: { id: snapshot.id, at: snapshot.at, label: snapshot.label, health: snapshot.health, totals: snapshot.totals },
                    path: saved.path,
                    count: saved.snapshots.length,
                  }),
                }
              } catch (error) {
                return { kind: 'error', text: `扫描快照保存失败：${errorMessage(error)}` }
              }
            }
            if (mode === 'history') {
              try {
                const { file } = await readCurrent(invocation.agent)
                const history = await readScanHistory(file.cwd, file.sessionId)
                return {
                  kind: 'success',
                  text: JSON.stringify({
                    ok: true,
                    path: history.path,
                    warning: history.warning ?? null,
                    snapshots: history.snapshots.map(snapshot => ({
                      id: snapshot.id,
                      at: snapshot.at,
                      label: snapshot.label,
                      health: snapshot.health,
                      totals: snapshot.totals,
                    })),
                  }),
                }
              } catch (error) {
                return { kind: 'error', text: `扫描历史读取失败：${errorMessage(error)}` }
              }
            }
            if (mode === 'diff') {
              try {
                const { file } = await readCurrent(invocation.agent)
                const history = await readScanHistory(file.cwd, file.sessionId)
                const snapshots = history.snapshots
                if (snapshots.length < 2) {
                  return { kind: 'error', text: '至少需要两个扫描快照才能比较；先运行 /blueprint scan snapshot。' }
                }
                const pick = (token, fallback) => {
                  const value = String(token ?? '').trim()
                  if (value === '' || value === 'latest') return snapshots[snapshots.length - 1 - fallback]
                  return snapshots.find(snapshot => snapshot.id === value || snapshot.label === value)
                }
                const from = pick(rest[1], 1)
                const to = pick(rest[2], 0)
                if (from === undefined || to === undefined) {
                  return { kind: 'error', text: '找不到指定的扫描快照；用法：/blueprint scan diff [fromId|label] [toId|latest]。' }
                }
                return { kind: 'success', text: JSON.stringify({ ok: true, ...diffScanSnapshots(from, to) }) }
              } catch (error) {
                return { kind: 'error', text: `扫描快照比较失败：${errorMessage(error)}` }
              }
            }
            if (mode !== '') {
              return { kind: 'error', text: `未知 scan 参数：${mode}。用法：/blueprint scan [preview|apply|snapshot|history|diff]` }
            }
            try {
              const cwd = await cwdOf(invocation.agent)
              const scan = await scanCached(cwd, { fresh: true })
              const suggestions = suggestBlueprint(scan)
              return { kind: 'success', text: JSON.stringify({ scan, suggestions }) }
            } catch (error) {
              return { kind: 'error', text: `仓库扫描失败：${errorMessage(error)}` }
            }
          }
          if (sub === 'cancel') {
            const childSessionId = String(rest[0] ?? '').trim()
            if (childSessionId === '') {
              return { kind: 'error', text: '缺少子会话 ID。用法：/blueprint cancel <childSessionId>（Missing child session id.）' }
            }
            let subagents
            try {
              subagents = ctx.get('subagents')
            } catch {
              subagents = undefined
            }
            if (subagents === undefined || typeof subagents.interruptByParent !== 'function') {
              return { kind: 'error', text: '当前环境没有可用的子代理服务，无法取消。Subagent service unavailable.' }
            }
            const parentSessionId = invocation.agent?.session?.header?.id ?? invocation.agent?.id
            if (typeof parentSessionId !== 'string' || parentSessionId === '') {
              return { kind: 'error', text: '无法确定当前父会话 ID，已跳过取消。Unknown parent session.' }
            }
            try {
              const receipt = await subagents.interruptByParent(childSessionId, parentSessionId, 'continuable')
              if (receipt !== undefined && receipt !== null && receipt.accepted === false) {
                return { kind: 'error', text: `取消子代理未被接受：${childSessionId}。Cancel was not accepted.` }
              }
              return { kind: 'success', text: `已向子代理 ${childSessionId} 发送取消信号。Subagent cancel requested.` }
            } catch (error) {
              return { kind: 'error', text: `取消子代理失败：${String(error?.message ?? error)}` }
            }
          }
          return { kind: 'error', text: '可用：/blueprint save | verify <moduleId> <tests|reviewer|human> <passed|failed|pending> [evidence] | confirm | dispatch <token> | versions | diff | restore | snapshot | path | get | export <md|html> [all|<层>] | review | review html | review handoff <runId> | review project [html] | check [scan] | run list|start|evidence|complete|fail|cancel|rollback|prepare|collect|heartbeat | scan | cancel' }
        },
      }),
    )
  }

  if (config.promptSection !== false) {
    const systemPrompt = ctx.get('systemPrompt')
    if (systemPrompt !== undefined) {
      ctx.effect(() =>
        systemPrompt.section({
          name: 'blueprint-studio',
          order: 42,
          text: `## 工程蓝图工作流（Blueprint Studio）

当用户提出需要多步骤实现、跨文件改动或新功能的任务时，在写代码之前：
1. 调用 blueprint(action="create") 生成结构化蓝图：7 个需求栏目、根层 A（总览）与按需子层（layers）、usecase / dfd / module 三张基础图，按需补 sequence / er / c4 / class / state，以及可独立分派的 modules。把原始需求写进 prompt。
2. 分层数据模型：A 是根层，子层 letter 唯一且 id=letter，用 parentModuleId 指向父层模块；模块用稳定的 id、layerId、code（如 A1/B1）和 parentId，需求条目用 uid（sectionKey:id）和全局递增 code（R1/R2…）。只有根层 A 自动保留 8 张图；子层图必须显式给出，key 为 "<letter>:<type>"，没有空图占位。
3. 用两三句话向用户说明方案，并请他在「蓝图」面板中检查、增删改；在用户明确确认之前，不要开始实现，也不要调用文件编辑工具。确认与分派由用户在面板发起，Host 会校验一次性令牌；不要调用 blueprint(action="confirm") 或 blueprint(action="dispatch")，它们会被拒绝。
4. 用户确认后，调用 blueprint(action="get") 读取最新蓝图（用户可能手工改过），再按 modules 为每个模块启动一个子代理：有依赖的按依赖顺序，无依赖的并行。子代理提示词必须包含模块范围、层路径、依赖、验收标准，以及相关图表中的接口/数据流。
5. 启动子代理后，把子代理 sessionId 写回对应 module 的 subagentSessionId 字段，并用 module.status 标记 running；每个子代理完成后不要自行宣称模块 done：tests / reviewer / human 三层验证只能由用户执行 /blueprint verify 记录，任一层 failed 会自动置为 needs-rework，三层全部 passed 才会置为 done。
6. 全部完成后汇总改动、验证结果与剩余风险。用户可以在「版本」面板对比每次保存并恢复旧版本。

简单问答、解释概念、单行小修不需要蓝图，直接回答或修改即可。

可用节点类型：${NODE_TYPES.join('、')}。固定栏目：${SECTION_DEFS.map(item => item.key).join('、')}。固定图解：${DIAGRAM_DEFS.map(item => item.key).join('、')}。
蓝图由插件自动保存到工作区并自动归档历史版本；不要用 write/edit 手工改蓝图文件。

${PLAN_MODE_PROMPT}

## 复杂任务分层要求

在复杂任务中不要只画 A 层：

- 复杂度触发（满足任一）：模块数 ≥6、跨 3 个以上领域、存在多个适配器/外部系统、预计需要 2 个以上子代理并行。
- 触发后必须设计至少 2 层：根层 A + 一个或多个子层 B/C；子层用 parentModuleId 指向根层的父模块。
- 根层 A 只保留总览模块图和必要的用例概览；具体接口、数据流、时序、类/状态放到对应子层。
- 每个子层必须显式提供 diagrams，至少 letter:module；涉及接口时补 letter:dfd 或 letter:sequence。只写 layers/modules 而不写子层图，视为未完成。
- 子层模块 code 使用 B1/C1；父模块只负责汇总，叶子模块才分派。
- 简单任务确实不需要子层时，在 summary/risks 中写明原因，不要静默只做 A 层。
## 工作区挂载（Workspace Map）

当任务跨多个文件夹、仓库、快照或归档目录时，不要只在 summary 里写路径：

- 在 blueprint 顶层创建 mounts：每个挂载有稳定 id、label、root、kind（working/snapshot/archive）、access（rw/ro）；可写工作目录用 working/rw，归档/快照用 snapshot 或 archive 且默认只读。
- 每个模块用 mountIds 绑定它实际读写的挂载；一个模块可绑定多个，一个挂载可被多个模块共享，但同一 rw mount 不能让两个并行子代理同时改同一文件。
- 模块可选 execution：adapter（dsh-subagent/cli/http/manual）、cwd、allow、commands、agentProfile、storage。密钥只写 env/配置引用，不写进蓝图。
- 跨文件夹任务必须给出 mounts 和模块绑定，再分派；缺少挂载时明确说明“未绑定工作区”，不要默认所有模块都在根目录执行。
- 归档目录只读；不要把 snapshot/archive 标成 rw。确认蓝图时尽量用 workspaceSnapshot 记录每个 mount 的 ref/checksum。
## 执行账本（Run Ledger）

- 分派一个模块前，用 /blueprint run start <moduleId> 建立持久 run：记录 mount claim、adapter、baseSnapshot 与 lease。
- 执行中的证据用 /blueprint run evidence <runId> <text> 追加；不要只在聊天里说“测过了”。
- 结束用 /blueprint run complete|fail|cancel；失败时用 /blueprint run rollback 取回滚计划，不自动破坏文件。
- runs 由 Host 命令维护；工具 update 不能伪造 run 或 claim。模块是否 done 仍由 tests/reviewer/human 验证决定，run complete 不等于验收通过。`,
        }),
      )
    }
  }
}

