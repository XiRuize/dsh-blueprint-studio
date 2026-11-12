// Blueprint Studio v0.14 deep diagram validation.
//
// Pure functions only: no I/O, no runtime dependencies and no mutation of the
// input blueprint. The validator is deliberately tolerant: malformed diagrams
// degrade to a partial report instead of throwing, and every issue carries an
// actionable `fix` string. Issue order is fully deterministic so the same input
// always produces byte-identical output.
//
// This module covers the eight diagram families that carry engineering detail
// (usecase / dfd / sequence / er / class / c4 / state / flowchart). The
// `module` overview diagram is acknowledged in coverage but has no deep rules.

export const DIAGRAM_TYPES = Object.freeze([
  'usecase',
  'dfd',
  'module',
  'sequence',
  'er',
  'c4',
  'class',
  'state',
  'flowchart',
])

// Public catalog of the deep-validation rules. Each rule has exactly one
// severity; the `types` list documents which diagram family it applies to.
export const VALIDATE_RULES = Object.freeze([
  { code: 'validate-failed', severity: 'error', types: [], title: '深图校验失败' },
  { code: 'diagram-type-unknown', severity: 'info', types: [], title: '图解类型未知' },

  { code: 'usecase-no-actor', severity: 'warn', types: ['usecase'], title: '用例图缺少角色' },
  { code: 'usecase-no-usecase', severity: 'warn', types: ['usecase'], title: '用例图缺少用例' },
  { code: 'usecase-isolated', severity: 'warn', types: ['usecase'], title: '孤立用例' },
  { code: 'usecase-actor-isolated', severity: 'warn', types: ['usecase'], title: '孤立角色' },
  { code: 'usecase-system-missing', severity: 'info', types: ['usecase'], title: '缺少系统边界' },
  { code: 'usecase-system-empty', severity: 'warn', types: ['usecase'], title: '系统边界为空' },
  { code: 'usecase-system-ref-missing', severity: 'warn', types: ['usecase'], title: '系统边界引用悬空' },
  { code: 'usecase-edge-endpoint-missing', severity: 'error', types: ['usecase'], title: '用例连线端点不存在' },

  { code: 'dfd-process-unbalanced', severity: 'warn', types: ['dfd'], title: 'process 缺少输入或输出' },
  { code: 'dfd-node-isolated', severity: 'warn', types: ['dfd'], title: 'entity/store 孤立' },
  { code: 'dfd-process-unnamed', severity: 'warn', types: ['dfd'], title: 'process 无名称' },
  { code: 'dfd-edge-endpoint-missing', severity: 'error', types: ['dfd'], title: '数据流端点不存在' },

  { code: 'sequence-participant-missing', severity: 'warn', types: ['sequence'], title: 'participant 少于两个' },
  { code: 'sequence-message-endpoint-missing', severity: 'error', types: ['sequence'], title: '消息端点不存在' },
  { code: 'sequence-order-duplicate', severity: 'warn', types: ['sequence'], title: '消息 order 重复' },
  { code: 'sequence-order-missing', severity: 'warn', types: ['sequence'], title: '消息 order 缺失' },
  { code: 'sequence-no-message', severity: 'warn', types: ['sequence'], title: '时序图没有消息' },

  { code: 'er-entity-missing', severity: 'warn', types: ['er'], title: 'ER 图缺少实体' },
  { code: 'er-primary-key-missing', severity: 'warn', types: ['er'], title: '实体没有主键字段' },
  { code: 'er-relationship-endpoint-missing', severity: 'error', types: ['er'], title: '关系端点不存在' },
  { code: 'er-relationship-endpoint-count', severity: 'warn', types: ['er'], title: '关系连接端点不足' },
  { code: 'er-relationship-unlabeled', severity: 'warn', types: ['er'], title: '关系没有标签' },
  { code: 'er-field-duplicate', severity: 'warn', types: ['er'], title: '实体字段名重复' },

  { code: 'class-type-missing', severity: 'warn', types: ['class'], title: '类图缺少 class/interface' },
  { code: 'class-inheritance-cycle', severity: 'error', types: ['class'], title: '继承环' },
  { code: 'class-edge-endpoint-missing', severity: 'error', types: ['class'], title: '类关系端点不存在' },
  { code: 'class-member-empty', severity: 'warn', types: ['class'], title: '空成员' },

  { code: 'c4-node-missing', severity: 'warn', types: ['c4'], title: 'C4 图缺少核心节点' },
  { code: 'c4-external-isolated', severity: 'warn', types: ['c4'], title: 'external 孤立' },
  { code: 'c4-person-isolated', severity: 'warn', types: ['c4'], title: 'person 没有连接' },
  { code: 'c4-edge-endpoint-missing', severity: 'error', types: ['c4'], title: 'C4 连线端点不存在' },

  { code: 'state-initial-missing', severity: 'warn', types: ['state'], title: '缺少 initial' },
  { code: 'state-final-missing', severity: 'warn', types: ['state'], title: '缺少 final' },
  { code: 'state-isolated', severity: 'warn', types: ['state'], title: '状态没有迁移' },
  { code: 'state-choice-branches', severity: 'warn', types: ['state'], title: 'choice 出边不足' },
  { code: 'state-transition-endpoint-missing', severity: 'error', types: ['state'], title: '状态迁移端点不存在' },

  { code: 'flowchart-start-missing', severity: 'warn', types: ['flowchart'], title: '缺少 start' },
  { code: 'flowchart-end-missing', severity: 'warn', types: ['flowchart'], title: '缺少 end' },
  { code: 'flowchart-decision-branches', severity: 'warn', types: ['flowchart'], title: 'decision 出边不足' },
  { code: 'flowchart-decision-label-missing', severity: 'warn', types: ['flowchart'], title: 'decision 出边缺少标签' },
  { code: 'flowchart-group-parent-missing', severity: 'warn', types: ['flowchart'], title: 'group 父节点悬空' },
  { code: 'flowchart-edge-endpoint-missing', severity: 'error', types: ['flowchart'], title: '流程图连线端点不存在' },
])

const RULE_BY_CODE = new Map(VALIDATE_RULES.map(rule => [rule.code, rule]))
const SEVERITY_RANK = Object.freeze({ error: 0, warn: 1, info: 2 })

const ENDPOINT_CODE = Object.freeze({
  usecase: 'usecase-edge-endpoint-missing',
  dfd: 'dfd-edge-endpoint-missing',
  sequence: 'sequence-message-endpoint-missing',
  er: 'er-relationship-endpoint-missing',
  class: 'class-edge-endpoint-missing',
  c4: 'c4-edge-endpoint-missing',
  state: 'state-transition-endpoint-missing',
  flowchart: 'flowchart-edge-endpoint-missing',
})

const EDGE_WORD = Object.freeze({
  usecase: '连线',
  dfd: '数据流',
  sequence: '消息',
  er: '关系连线',
  class: '关系',
  c4: '连线',
  state: '状态迁移',
  flowchart: '连线',
})

const INHERITANCE_KINDS = new Set(['inheritance', 'extends', 'realization', 'implements'])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function text(value) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function lower(value) {
  return text(value).toLowerCase()
}

function firstText(...values) {
  for (const value of values) {
    const result = text(value)
    if (result !== '') return result
  }
  return ''
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function toFinite(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return undefined
}

function memberOf(entry) {
  if (typeof entry === 'string') {
    const name = entry.trim()
    return name === '' ? undefined : { name, key: false, kind: 'field' }
  }
  if (!isRecord(entry)) return undefined
  const name = firstText(entry.name, entry.field, entry.label, entry.text)
  if (name === '') return undefined
  const kind = lower(entry.kind)
  return {
    name,
    key: entry.key === true || entry.primary === true,
    kind: kind === 'method' ? 'method' : 'field',
  }
}

function membersOf(raw) {
  const result = []
  for (const entry of list(raw)) {
    const member = memberOf(entry)
    if (member !== undefined) result.push(member)
  }
  return result
}

// ER entities expose fields/attributes/columns; classes expose members plus
// explicit fields/methods. Unknown shapes are ignored instead of throwing.
function fieldsOf(node, includeMethods) {
  const values = [node.fields, node.attributes, node.columns]
  if (includeMethods) values.push(node.members, node.methods)
  const result = []
  for (const value of values) result.push(...membersOf(value))
  return result
}

function normalizeNode(entry, index) {
  const value = isRecord(entry) ? entry : {}
  const fields = fieldsOf(value, true)
  return {
    nodeId: text(value.id) || `n${index + 1}`,
    type: lower(value.type),
    label: firstText(value.label, value.name, value.title, value.text),
    fields,
    parentGroup: firstText(value.parentGroup, value.group, value.parent, value.parentId, value.container),
    x: finite(value.x),
    y: finite(value.y),
    w: finite(value.w ?? value.width),
    h: finite(value.h ?? value.height),
  }
}

function normalizeEdge(entry, index) {
  const value = isRecord(entry) ? entry : {}
  return {
    edgeId: text(value.id) || `e${index + 1}`,
    from: text(value.from ?? value.source ?? value.fromId ?? value.start),
    to: text(value.to ?? value.target ?? value.toId ?? value.end),
    label: firstText(value.label, value.name, value.message),
    kind: lower(value.kind ?? value.type),
    order: toFinite(value.order ?? value.seq ?? value.index),
  }
}

function sourceDiagrams(blueprint) {
  if (!isRecord(blueprint)) return []
  const raw = blueprint.diagrams ?? blueprint.charts
  if (Array.isArray(raw)) return raw
  if (isRecord(raw)) {
    return Object.entries(raw).map(([key, value]) => ({ key, ...(isRecord(value) ? value : {}) }))
  }
  return []
}

function normalizeDiagram(entry, index) {
  const value = isRecord(entry) ? entry : {}
  let key = text(value.key ?? value.name)
  let layerId = text(value.layerId ?? value.layer).toUpperCase()
  let type = lower(value.type)
  if (key.includes(':')) {
    const split = key.indexOf(':')
    if (layerId === '') layerId = key.slice(0, split).trim().toUpperCase()
    if (type === '') type = lower(key.slice(split + 1))
  } else if (type === '' && key !== '') {
    type = lower(key)
  }
  if (layerId === '') layerId = 'A'
  if (type === '') type = 'unknown'
  if (key === '') key = layerId === 'A' ? type : `${layerId}:${type}`
  return {
    index,
    key,
    layerId,
    type,
    nodes: list(value.nodes).map(normalizeNode),
    edges: list(value.edges ?? value.links).map(normalizeEdge),
  }
}

function makeIssue(code, message, fields = {}) {
  const rule = RULE_BY_CODE.get(code)
  const issue = {
    code,
    severity: rule?.severity ?? 'info',
    message,
  }
  for (const key of ['diagramKey', 'nodeId', 'edgeId']) {
    if (text(fields[key]) !== '') issue[key] = text(fields[key])
  }
  issue.fix = text(fields.fix) || '检查该图的节点、连线与字段定义，补全缺失信息后重新校验。'
  return issue
}

function nodeResolver(nodes) {
  const byId = new Map()
  const byKey = new Map()
  for (const node of nodes) {
    if (!byId.has(node.nodeId)) byId.set(node.nodeId, node.nodeId)
    const idKey = node.nodeId.toLowerCase()
    if (!byKey.has(idKey)) byKey.set(idKey, node.nodeId)
    const labelKey = node.label.toLowerCase()
    if (labelKey !== '' && !byKey.has(labelKey)) byKey.set(labelKey, node.nodeId)
  }
  return value => {
    const key = text(value)
    if (key === '') return undefined
    if (byId.has(key)) return byId.get(key)
    return byKey.get(key.toLowerCase())
  }
}

function graphOf(diagram) {
  const resolve = nodeResolver(diagram.nodes)
  const validEdges = []
  const broken = []
  const incoming = new Map()
  const outgoing = new Map()
  for (const edge of diagram.edges) {
    const from = resolve(edge.from)
    const to = resolve(edge.to)
    const missing = []
    if (from === undefined) missing.push('from')
    if (to === undefined) missing.push('to')
    if (missing.length > 0) {
      broken.push({ edge, missing })
      continue
    }
    validEdges.push({ edge, from, to })
    outgoing.set(from, (outgoing.get(from) ?? 0) + 1)
    incoming.set(to, (incoming.get(to) ?? 0) + 1)
  }
  return { resolve, validEdges, broken, incoming, outgoing }
}

function degreeOf(graph, nodeId) {
  return (graph.incoming.get(nodeId) ?? 0) + (graph.outgoing.get(nodeId) ?? 0)
}

function endpointIssues(diagram, graph) {
  const code = ENDPOINT_CODE[diagram.type] ?? 'diagram-type-unknown'
  const word = EDGE_WORD[diagram.type] ?? '连线'
  const issues = []
  for (const { edge, missing } of graph.broken) {
    const sides = missing.map(side => (side === 'from' ? `起点 from“${edge.from || '(空)'}”` : `终点 to“${edge.to || '(空)'}”`))
    issues.push(makeIssue(
      code,
      `图 ${diagram.key} 的${word} ${edge.edgeId} 指向不存在的节点（${sides.join('、')}）。`,
      {
        diagramKey: diagram.key,
        edgeId: edge.edgeId,
        fix: `修正${word} ${edge.edgeId} 的 ${missing.join('/')}，使其指向图中已存在的节点 id 或唯一标签。`,
      },
    ))
  }
  return issues
}

// A usecase system boundary "contains" a node either through an explicit
// parentGroup/group reference or by geometry (the node center falls inside the
// boundary rectangle). Both representations are accepted so hand-laid and
// synthesized diagrams validate the same way.
function containedInSystem(system, node, resolve) {
  if (node.nodeId === system.nodeId) return false
  if (node.parentGroup !== '') {
    const target = resolve(node.parentGroup)
    if (target === system.nodeId) return true
  }
  if (system.x === undefined || system.y === undefined || system.w === undefined || system.h === undefined) return false
  if (system.w <= 0 || system.h <= 0) return false
  if (node.x === undefined || node.y === undefined) return false
  const width = node.w ?? 0
  const height = node.h ?? 0
  const centerX = node.x + width / 2
  const centerY = node.y + height / 2
  return centerX >= system.x
    && centerX <= system.x + system.w
    && centerY >= system.y
    && centerY <= system.y + system.h
}

function usecaseIssues(diagram, graph) {
  const issues = []
  const actors = diagram.nodes.filter(node => node.type === 'actor')
  const usecases = diagram.nodes.filter(node => node.type === 'usecase')
  const systems = diagram.nodes.filter(node => node.type === 'system')

  if (usecases.length > 0 && actors.length === 0) {
    issues.push(makeIssue('usecase-no-actor', `用例图 ${diagram.key} 有 ${usecases.length} 个用例但没有角色（actor）。`, {
      diagramKey: diagram.key,
      fix: '添加至少一个 actor 节点，并用连线把它连接到相关用例。',
    }))
  }
  if (actors.length > 0 && usecases.length === 0) {
    issues.push(makeIssue('usecase-no-usecase', `用例图 ${diagram.key} 有角色但没有用例（usecase）。`, {
      diagramKey: diagram.key,
      fix: '添加至少一个 usecase 节点，并用连线连接角色与用例。',
    }))
  }

  for (const node of usecases) {
    if (degreeOf(graph, node.nodeId) > 0) continue
    issues.push(makeIssue('usecase-isolated', `用例图 ${diagram.key} 的用例“${node.label || node.nodeId}”没有任何连线。`, {
      diagramKey: diagram.key,
      nodeId: node.nodeId,
      fix: `从 actor 或 system 连一条边到用例 ${node.nodeId}，或删除这个孤立用例。`,
    }))
  }
  for (const node of actors) {
    if (degreeOf(graph, node.nodeId) > 0) continue
    issues.push(makeIssue('usecase-actor-isolated', `用例图 ${diagram.key} 的角色“${node.label || node.nodeId}”没有连接任何用例。`, {
      diagramKey: diagram.key,
      nodeId: node.nodeId,
      fix: `把角色 ${node.nodeId} 连接到至少一个 usecase，或删除这个孤立角色。`,
    }))
  }

  for (const system of systems) {
    const contains = diagram.nodes.some(node => containedInSystem(system, node, graph.resolve))
    if (contains) continue
    issues.push(makeIssue('usecase-system-empty', `用例图 ${diagram.key} 的系统边界“${system.label || system.nodeId}”没有包含任何节点。`, {
      diagramKey: diagram.key,
      nodeId: system.nodeId,
      fix: `把相关用例的 parentGroup 指向 ${system.nodeId}，或让用例坐标落入边界矩形；否则删除这个空边界。`,
    }))
  }

  if (usecases.length > 0 && systems.length === 0) {
    issues.push(makeIssue('usecase-system-missing', `用例图 ${diagram.key} 有 ${usecases.length} 个用例但没有 system 边界。`, {
      diagramKey: diagram.key,
      fix: '添加一个 system 节点作为系统边界，并用 parentGroup 或坐标把相关用例纳入边界。',
    }))
  }

  for (const node of diagram.nodes) {
    if (node.parentGroup === '') continue
    const target = graph.resolve(node.parentGroup)
    const system = diagram.nodes.find(entry => entry.nodeId === target)
    if (system !== undefined && system.type === 'system') continue
    issues.push(makeIssue('usecase-system-ref-missing', `用例图 ${diagram.key} 的节点“${node.label || node.nodeId}”引用了不存在或不是 system 的边界“${node.parentGroup}”。`, {
      diagramKey: diagram.key,
      nodeId: node.nodeId,
      fix: `把节点 ${node.nodeId} 的 parentGroup 改为已存在的 system 节点 id，或删除该引用。`,
    }))
  }
  return issues
}

function dfdIssues(diagram, graph) {
  const issues = []
  const processes = diagram.nodes.filter(node => node.type === 'process')
  for (const node of processes) {
    if (node.label === '') {
      issues.push(makeIssue('dfd-process-unnamed', `数据流图 ${diagram.key} 的 process ${node.nodeId} 没有名称。`, {
        diagramKey: diagram.key,
        nodeId: node.nodeId,
        fix: `给 process ${node.nodeId} 补充 label（如“校验订单”）。`,
      }))
    }
    const missingInput = (graph.incoming.get(node.nodeId) ?? 0) === 0
    const missingOutput = (graph.outgoing.get(node.nodeId) ?? 0) === 0
    if (!missingInput && !missingOutput) continue
    const missing = [missingInput ? '输入' : '', missingOutput ? '输出' : ''].filter(Boolean).join('和')
    const fixes = []
    if (missingInput) fixes.push(`给 process ${node.nodeId} 增加输入边`)
    if (missingOutput) fixes.push(`给 process ${node.nodeId} 增加输出边`)
    issues.push(makeIssue('dfd-process-unbalanced', `数据流图 ${diagram.key} 的 process“${node.label || node.nodeId}”缺少${missing}。`, {
      diagramKey: diagram.key,
      nodeId: node.nodeId,
      fix: `${fixes.join('，并')}（从 entity/store 流向 process，或从 process 流向 entity/store）。`,
    }))
  }

  for (const node of diagram.nodes) {
    if (node.type !== 'entity' && node.type !== 'store') continue
    if (degreeOf(graph, node.nodeId) > 0) continue
    issues.push(makeIssue('dfd-node-isolated', `数据流图 ${diagram.key} 的 ${node.type}“${node.label || node.nodeId}”没有任何连线。`, {
      diagramKey: diagram.key,
      nodeId: node.nodeId,
      fix: `用数据流把 ${node.type} ${node.nodeId} 连接到至少一个 process，或删除该节点。`,
    }))
  }
  return issues
}

function sequenceIssues(diagram, graph) {
  const issues = []
  const participants = diagram.nodes.filter(node => node.type === 'participant')
  if (diagram.nodes.length > 0 && participants.length < 2) {
    issues.push(makeIssue('sequence-participant-missing', `时序图 ${diagram.key} 只有 ${participants.length} 个 participant，至少需要 2 个。`, {
      diagramKey: diagram.key,
      fix: '添加至少两个 participant 节点，并用带 order 的消息把它们连接起来。',
    }))
  }
  if (diagram.nodes.length > 0 && graph.validEdges.length === 0 && diagram.edges.length === 0) {
    issues.push(makeIssue('sequence-no-message', `时序图 ${diagram.key} 没有任何消息。`, {
      diagramKey: diagram.key,
      fix: '添加至少一条消息边（from/to 指向 participant，并设置 order）。',
    }))
  }

  const byOrder = new Map()
  for (const { edge } of graph.validEdges) {
    if (edge.order === undefined) {
      issues.push(makeIssue('sequence-order-missing', `时序图 ${diagram.key} 的消息 ${edge.edgeId} 缺少 order。`, {
        diagramKey: diagram.key,
        edgeId: edge.edgeId,
        fix: `给消息 ${edge.edgeId} 设置唯一的 order（按时间顺序递增，如 1、2、3）。`,
      }))
      continue
    }
    const group = byOrder.get(edge.order)
    if (group === undefined) byOrder.set(edge.order, [edge.edgeId])
    else group.push(edge.edgeId)
  }
  for (const [order, edgeIds] of byOrder) {
    if (edgeIds.length < 2) continue
    issues.push(makeIssue('sequence-order-duplicate', `时序图 ${diagram.key} 的消息 order ${order} 被 ${edgeIds.length} 条消息重复使用：${edgeIds.join('、')}。`, {
      diagramKey: diagram.key,
      edgeId: edgeIds[0],
      fix: `调整消息 ${edgeIds.join('、')} 的 order，使每条消息拥有唯一的顺序值（例如改为 1、2、3）。`,
    }))
  }
  return issues
}

function erIssues(diagram, graph) {
  const issues = []
  const entities = diagram.nodes.filter(node => node.type === 'entity')
  const relationships = diagram.nodes.filter(node => node.type === 'relationship')
  const relationshipIds = new Set(relationships.map(node => node.nodeId))

  if (diagram.nodes.length > 0 && entities.length === 0) {
    issues.push(makeIssue('er-entity-missing', `ER 图 ${diagram.key} 没有任何 entity。`, {
      diagramKey: diagram.key,
      fix: '添加至少一个 entity 节点，并用 relationship 连接实体。',
    }))
  }

  for (const entity of entities) {
    if (entity.fields.some(field => field.key)) continue
    issues.push(makeIssue('er-primary-key-missing', `ER 图 ${diagram.key} 的 entity“${entity.label || entity.nodeId}”没有主键字段。`, {
      diagramKey: diagram.key,
      nodeId: entity.nodeId,
      fix: `为 entity ${entity.nodeId} 的字段添加 key: true（至少一个主键字段），或在 fields 中补一个 id 主键。`,
    }))
  }

  for (const entity of entities) {
    const seen = new Map()
    for (const field of entity.fields) {
      const key = field.name.toLowerCase()
      const group = seen.get(key)
      if (group === undefined) seen.set(key, [{ ...field }])
      else group.push({ ...field })
    }
    for (const [name, group] of seen) {
      if (group.length < 2) continue
      issues.push(makeIssue('er-field-duplicate', `ER 图 ${diagram.key} 的 entity“${entity.label || entity.nodeId}”重复定义了 ${group.length} 次字段“${name}”。`, {
        diagramKey: diagram.key,
        nodeId: entity.nodeId,
        fix: `重命名 entity ${entity.nodeId} 的重复字段 ${name}，或合并为一个字段。`,
      }))
    }
  }

  for (const relationship of relationships) {
    const neighbors = new Set()
    for (const { from, to } of graph.validEdges) {
      if (from === relationship.nodeId) neighbors.add(to)
      if (to === relationship.nodeId) neighbors.add(from)
    }
    if (neighbors.size < 2) {
      issues.push(makeIssue('er-relationship-endpoint-count', `ER 图 ${diagram.key} 的关系“${relationship.label || relationship.nodeId}”只连接了 ${neighbors.size} 个端点，至少需要 2 个。`, {
        diagramKey: diagram.key,
        nodeId: relationship.nodeId,
        fix: `为关系 ${relationship.nodeId} 添加两条到不同 entity 的连线（端点必须存在）。`,
      }))
    }
    if (relationship.label === '') {
      issues.push(makeIssue('er-relationship-unlabeled', `ER 图 ${diagram.key} 的关系 ${relationship.nodeId} 没有标签。`, {
        diagramKey: diagram.key,
        nodeId: relationship.nodeId,
        fix: `给关系 ${relationship.nodeId} 补充 label（如“拥有”“包含”）。`,
      }))
    }
  }

  for (const { edge, from, to } of graph.validEdges) {
    if (!relationshipIds.has(from) && !relationshipIds.has(to)) continue
    if (edge.label !== '') continue
    issues.push(makeIssue('er-relationship-unlabeled', `ER 图 ${diagram.key} 的关系连线 ${edge.edgeId} 没有标签。`, {
      diagramKey: diagram.key,
      edgeId: edge.edgeId,
      fix: `给关系连线 ${edge.edgeId} 添加标签（如“拥有”“包含”），或删除多余的连线。`,
    }))
  }
  return issues
}

function inheritanceCycles(graph) {
  let nextIndex = 0
  const indices = new Map()
  const lowLinks = new Map()
  const onStack = new Set()
  const stack = []
  const components = []

  const strongConnect = vertex => {
    indices.set(vertex, nextIndex)
    lowLinks.set(vertex, nextIndex)
    nextIndex += 1
    stack.push(vertex)
    onStack.add(vertex)

    for (const target of graph.get(vertex) ?? []) {
      if (!indices.has(target)) {
        strongConnect(target)
        lowLinks.set(vertex, Math.min(lowLinks.get(vertex), lowLinks.get(target)))
      } else if (onStack.has(target)) {
        lowLinks.set(vertex, Math.min(lowLinks.get(vertex), indices.get(target)))
      }
    }

    if (lowLinks.get(vertex) !== indices.get(vertex)) return
    const component = []
    for (;;) {
      const member = stack.pop()
      onStack.delete(member)
      component.push(member)
      if (member === vertex) break
    }
    const selfLoop = component.length === 1 && (graph.get(component[0]) ?? []).includes(component[0])
    if (component.length > 1 || selfLoop) components.push(component)
  }

  for (const vertex of graph.keys()) {
    if (!indices.has(vertex)) strongConnect(vertex)
  }
  return components
}

function classIssues(diagram, graph) {
  const issues = []
  const typed = diagram.nodes.filter(node => node.type === 'class' || node.type === 'interface')
  const typedIds = new Set(typed.map(node => node.nodeId))
  const labelById = new Map(diagram.nodes.map(node => [node.nodeId, node.label || node.nodeId]))

  if (diagram.nodes.length > 0 && typed.length === 0) {
    issues.push(makeIssue('class-type-missing', `类图 ${diagram.key} 没有任何 class 或 interface。`, {
      diagramKey: diagram.key,
      fix: '添加至少一个 class 或 interface 节点，并补充字段/方法。',
    }))
  }

  for (const node of typed) {
    if (node.fields.length > 0) continue
    issues.push(makeIssue('class-member-empty', `类图 ${diagram.key} 的 ${node.type}“${node.label || node.nodeId}”没有任何成员。`, {
      diagramKey: diagram.key,
      nodeId: node.nodeId,
      fix: `为 ${node.type} ${node.nodeId} 补充字段或方法，或标注它只作为占位类型。`,
    }))
  }

  const inheritance = new Map()
  for (const id of typedIds) inheritance.set(id, [])
  for (const { edge, from, to } of graph.validEdges) {
    if (!INHERITANCE_KINDS.has(edge.kind)) continue
    if (!typedIds.has(from) || !typedIds.has(to)) continue
    const targets = inheritance.get(from)
    if (!targets.includes(to)) targets.push(to)
  }
  for (const component of inheritanceCycles(inheritance)) {
    const path = [...component, component[0]].map(id => labelById.get(id) ?? id)
    issues.push(makeIssue('class-inheritance-cycle', `类图 ${diagram.key} 的继承关系存在环：${path.join(' → ')}。`, {
      diagramKey: diagram.key,
      nodeId: [...component].sort()[0],
      fix: `断开继承环 ${path.join(' → ')} 中的一条继承边，改成组合或依赖。`,
    }))
  }
  return issues
}

function c4Issues(diagram, graph) {
  const issues = []
  const core = diagram.nodes.filter(node => ['system', 'container', 'component'].includes(node.type))
  if (diagram.nodes.length > 0 && core.length === 0) {
    issues.push(makeIssue('c4-node-missing', `C4 图 ${diagram.key} 没有任何 system/container/component。`, {
      diagramKey: diagram.key,
      fix: '添加至少一个 system、container 或 component 节点，再用连线表达依赖。',
    }))
  }
  for (const node of diagram.nodes) {
    if (node.type !== 'external' && node.type !== 'person') continue
    if (degreeOf(graph, node.nodeId) > 0) continue
    const code = node.type === 'external' ? 'c4-external-isolated' : 'c4-person-isolated'
    const label = node.type === 'external' ? '外部系统' : 'person'
    issues.push(makeIssue(code, `C4 图 ${diagram.key} 的 ${label}“${node.label || node.nodeId}”没有任何连接。`, {
      diagramKey: diagram.key,
      nodeId: node.nodeId,
      fix: `用一个连线把 ${label} ${node.nodeId} 连接到相关的 system/container/component，或删除该节点。`,
    }))
  }
  return issues
}

function stateIssues(diagram, graph) {
  const issues = []
  if (diagram.nodes.length === 0) return issues
  if (!diagram.nodes.some(node => node.type === 'initial')) {
    issues.push(makeIssue('state-initial-missing', `状态图 ${diagram.key} 缺少 initial 节点。`, {
      diagramKey: diagram.key,
      fix: '添加一个 initial 节点，并用迁移边指向首个状态。',
    }))
  }
  if (!diagram.nodes.some(node => node.type === 'final')) {
    issues.push(makeIssue('state-final-missing', `状态图 ${diagram.key} 缺少 final 节点。`, {
      diagramKey: diagram.key,
      fix: '添加一个 final 节点，并让至少一条终止迁移指向它。',
    }))
  }
  for (const node of diagram.nodes) {
    if (node.type === 'state' && degreeOf(graph, node.nodeId) === 0) {
      issues.push(makeIssue('state-isolated', `状态图 ${diagram.key} 的状态“${node.label || node.nodeId}”没有任何迁移。`, {
        diagramKey: diagram.key,
        nodeId: node.nodeId,
        fix: `为状态 ${node.nodeId} 添加进入或离开的迁移边，或删除该状态。`,
      }))
    }
    if (node.type === 'choice' && (graph.outgoing.get(node.nodeId) ?? 0) < 2) {
      issues.push(makeIssue('state-choice-branches', `状态图 ${diagram.key} 的 choice“${node.label || node.nodeId}”只有 ${graph.outgoing.get(node.nodeId) ?? 0} 条出边，至少需要 2 条。`, {
        diagramKey: diagram.key,
        nodeId: node.nodeId,
        fix: `为 choice ${node.nodeId} 添加两条带条件的出边（分别指向不同状态）。`,
      }))
    }
  }
  return issues
}

function flowchartIssues(diagram, graph) {
  const issues = []
  if (diagram.nodes.length === 0) return issues
  if (!diagram.nodes.some(node => node.type === 'start')) {
    issues.push(makeIssue('flowchart-start-missing', `流程图 ${diagram.key} 缺少 start 节点。`, {
      diagramKey: diagram.key,
      fix: '添加一个 start 节点作为流程图入口。',
    }))
  }
  if (!diagram.nodes.some(node => node.type === 'end')) {
    issues.push(makeIssue('flowchart-end-missing', `流程图 ${diagram.key} 缺少 end 节点。`, {
      diagramKey: diagram.key,
      fix: '添加一个 end 节点作为流程图出口。',
    }))
  }

  const groupIds = new Set()
  for (const node of diagram.nodes) {
    if (node.type !== 'group') continue
    groupIds.add(node.nodeId)
    if (node.label !== '') groupIds.add(node.label.toLowerCase())
  }

  for (const node of diagram.nodes) {
    if (node.type === 'decision') {
      const outgoing = graph.validEdges.filter(entry => entry.from === node.nodeId)
      if (outgoing.length < 2) {
        issues.push(makeIssue('flowchart-decision-branches', `流程图 ${diagram.key} 的 decision“${node.label || node.nodeId}”只有 ${outgoing.length} 条出边，至少需要 2 条。`, {
          diagramKey: diagram.key,
          nodeId: node.nodeId,
          fix: `为 decision ${node.nodeId} 添加两条带标签的出边（如“是”和“否”），分别指向不同后续节点。`,
        }))
      }
      for (const { edge } of outgoing) {
        if (edge.label !== '') continue
        issues.push(makeIssue('flowchart-decision-label-missing', `流程图 ${diagram.key} 的 decision“${node.label || node.nodeId}”存在没有标签的出边 ${edge.edgeId}。`, {
          diagramKey: diagram.key,
          nodeId: node.nodeId,
          edgeId: edge.edgeId,
          fix: `给 decision ${node.nodeId} 的出边 ${edge.edgeId} 添加条件标签（yes/no 或具体条件）。`,
        }))
      }
    }
    if (node.type === 'group' || node.parentGroup === '') continue
    const reference = node.parentGroup
    if (groupIds.has(reference) || groupIds.has(reference.toLowerCase())) continue
    issues.push(makeIssue('flowchart-group-parent-missing', `流程图 ${diagram.key} 的节点“${node.label || node.nodeId}”的 parentGroup“${reference}”没有指向已存在的 group。`, {
      diagramKey: diagram.key,
      nodeId: node.nodeId,
      fix: `把节点 ${node.nodeId} 的 parentGroup 改为已存在的 group id 或标签，或先定义对应的 group 节点。`,
    }))
  }
  return issues
}

function validateNormalizedDiagram(diagram) {
  const graph = graphOf(diagram)
  const known = DIAGRAM_TYPES.includes(diagram.type)
  if (!known) {
    return [makeIssue('diagram-type-unknown', `图 ${diagram.key} 的类型“${diagram.type}”不在支持的图类型中。`, {
      diagramKey: diagram.key,
      fix: `把图 ${diagram.key} 的 type 设为 ${DIAGRAM_TYPES.join('/')} 之一，或删除该图。`,
    })]
  }

  const issues = endpointIssues(diagram, graph)
  if (diagram.nodes.length === 0 && diagram.edges.length === 0) return issues

  switch (diagram.type) {
    case 'usecase':
      issues.push(...usecaseIssues(diagram, graph))
      break
    case 'dfd':
      issues.push(...dfdIssues(diagram, graph))
      break
    case 'sequence':
      issues.push(...sequenceIssues(diagram, graph))
      break
    case 'er':
      issues.push(...erIssues(diagram, graph))
      break
    case 'class':
      issues.push(...classIssues(diagram, graph))
      break
    case 'c4':
      issues.push(...c4Issues(diagram, graph))
      break
    case 'state':
      issues.push(...stateIssues(diagram, graph))
      break
    case 'flowchart':
      issues.push(...flowchartIssues(diagram, graph))
      break
    default:
      break
  }
  return issues
}

function compareIssues(left, right) {
  return (SEVERITY_RANK[left.severity] ?? 9) - (SEVERITY_RANK[right.severity] ?? 9)
    || left.code.localeCompare(right.code)
    || text(left.diagramKey).localeCompare(text(right.diagramKey))
    || text(left.nodeId).localeCompare(text(right.nodeId))
    || text(left.edgeId).localeCompare(text(right.edgeId))
    || left.message.localeCompare(right.message)
}

function emptyTypeRow() {
  return { diagrams: 0, nodes: 0, edges: 0, issues: 0 }
}

function emptyCoverage() {
  const byType = {}
  for (const type of [...DIAGRAM_TYPES, 'unknown']) byType[type] = emptyTypeRow()
  return {
    diagrams: [],
    byType,
    totals: { diagrams: 0, nodes: 0, edges: 0, issues: 0 },
  }
}

function summarize(issues) {
  const summary = { error: 0, warn: 0, info: 0 }
  for (const issue of issues) {
    if (issue.severity === 'error' || issue.severity === 'warn' || issue.severity === 'info') {
      summary[issue.severity] += 1
    }
  }
  return summary
}

// Validate every diagram of a blueprint (normalized or raw). Never throws: a
// catastrophic input degrades to a single `validate-failed` issue and empty
// coverage. Issues are sorted error → warn → info, then code/diagram/node/edge.
export function validateDiagrams(blueprint) {
  try {
    const coverage = emptyCoverage()
    const issues = []
    const diagrams = sourceDiagrams(blueprint)

    for (const [index, raw] of diagrams.entries()) {
      const diagram = normalizeDiagram(raw, index)
      let diagramIssues
      try {
        diagramIssues = validateNormalizedDiagram(diagram)
      } catch (error) {
        diagramIssues = [makeIssue('validate-failed', `图 ${diagram.key} 校验失败：${String(error?.message ?? error ?? 'unknown error')}。`, {
          diagramKey: diagram.key,
          fix: '检查该图的 nodes/edges/fields 结构，修正畸形数据后重新校验。',
        })]
      }
      const record = {
        key: diagram.key,
        layerId: diagram.layerId,
        type: diagram.type,
        nodeCount: diagram.nodes.length,
        edgeCount: diagram.edges.length,
        issueCount: diagramIssues.length,
      }
      coverage.diagrams.push({
        key: record.key,
        layerId: record.layerId,
        type: record.type,
        nodes: record.nodeCount,
        edges: record.edgeCount,
        issues: record.issueCount,
      })
      const bucket = coverage.byType[record.type] ?? coverage.byType.unknown
      bucket.diagrams += 1
      bucket.nodes += record.nodeCount
      bucket.edges += record.edgeCount
      bucket.issues += record.issueCount
      coverage.totals.diagrams += 1
      coverage.totals.nodes += record.nodeCount
      coverage.totals.edges += record.edgeCount
      issues.push(...diagramIssues)
    }

    issues.sort(compareIssues)
    coverage.totals.issues = issues.length
    return { issues, summary: summarize(issues), coverage }
  } catch (error) {
    const issue = makeIssue('validate-failed', `深图校验失败：${String(error?.message ?? error ?? 'unknown error')}。`, {
      fix: '确认输入是对象且 diagrams 为数组或按 key 索引的对象，然后重新校验。',
    })
    return {
      issues: [issue],
      summary: summarize([issue]),
      coverage: emptyCoverage(),
    }
  }
}

// Single-diagram entry point. Returns exactly the same report shape as
// validateDiagrams({ diagrams: [diagram] }).
export function validateDiagram(diagram) {
  return validateDiagrams({ diagrams: [diagram] })
}
