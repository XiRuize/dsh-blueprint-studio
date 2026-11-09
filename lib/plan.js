// Plan-mode prompt and plan-graph checks for Blueprint Studio.
//
// This module is intentionally dependency-free and side-effect free. The prompt
// can be injected into a system prompt or handed to a planning model verbatim,
// while `analyzePlan` accepts a plan graph (or a Mermaid flowchart string) and
// returns a bounded, machine-readable report instead of throwing.

export const PLAN_NODE_SOFT_LIMIT = 40

export const PLAN_MODE_PROMPT = `## 计划模式（Plan Mode）

在需要多步骤实现、跨文件改动或新功能时，先产出可审阅的实施计划，再写代码。用户明确确认计划之前，不实现、不修改文件、不启动实现型子代理。

1. 先读蓝图与现状：读取现有蓝图、相关源码、测试和配置，确认已有行为与约束；不要凭想象补业务事实。计划阶段只做只读调查，不写代码。
2. 交代基线：写清目标（Goal）、非目标（Non-goal）、硬约束（约束/兼容性/性能/安全）、当前现状与关键假设。非目标要能挡住范围蔓延，假设要标注待确认项。
3. 按依赖排序实施步骤：每个步骤说明要改什么、涉及哪些文件、为什么排在这个位置；有依赖的步骤串行，无依赖的步骤才并行。
4. 每个 decision 写清判定条件与 yes/no 两条分支：条件必须可观察、可验证；两条分支都要有去向，不能只画一条边，也不能用无标签边代替分支。
5. 标出并行分组与文件边界：用 group 圈出可并行的工作，写清各组负责的文件/目录，避免两个并行分支改同一文件；跨组接口和合并顺序单独说明。
6. 每一步都要有验证方式：写明自动化测试、命令、人工验收或可观察结果；同时给出失败/回滚分支（失败时如何止损、回退到哪个状态、如何补测）。
7. 用 Mermaid flowchart TD 输出计划图：节点只用 start / end / process / decision / group / note，边必须有标签；decision 至少有两条带标签的出边，process 在标签或 note 中写验收/验证，失败或回滚路径单独成支。
8. 计划末尾列出待用户确认的问题与风险。只有用户明确确认后，才按计划实施；实施中计划变化时先更新计划并重新确认。

计划图模板（字段可增删，但不要省略目标、非目标、约束、依赖、验证、失败分支）：

\`\`\`mermaid
flowchart TD
  start([开始]) --> read[读取蓝图与现状]
  read --> goals[目标 / 非目标 / 约束]
  goals --> d1{现状是否满足需求?}
  d1 -->|yes| p1[步骤 1：按依赖实现]
  d1 -->|no| p2[步骤 2：先补齐前置条件]
  p1 --> v1[验证：命令 / 测试 / 人工验收]
  p2 --> v1
  v1 --> d2{验证是否通过?}
  d2 -->|yes| done([完成并交付])
  d2 -->|no| rollback[失败分支：回滚并记录原因]
  rollback --> read
  subgraph parallel[并行组：文件边界]
    p3[步骤 3：独立文件]
    p4[步骤 4：独立文件]
  end
  p3 --> v1
  p4 --> v1
  note[每个 process 都要写验证方式与回滚条件]
\`\`\`

判定口头禅：没有验证方式的步骤不是计划，只有一条出边的 decision 不是决策，没有失败分支的计划不可执行。`

export const PLAN_CHECK_RULES = Object.freeze([
  {
    code: 'plan-flowchart-missing',
    severity: 'error',
    title: '缺少计划流程图',
    description: '计划必须包含 flowchart TD 或等价的计划图节点/边。',
  },
  {
    code: 'plan-terminal-missing',
    severity: 'error',
    title: '缺少 start/end',
    description: '计划图必须有 start 与 end 终止节点。',
  },
  {
    code: 'plan-decision-branches',
    severity: 'error',
    title: 'decision 分支不足',
    description: '每个 decision 至少要有两条出边；条件不成立时必须给出另一条路径。',
  },
  {
    code: 'plan-decision-label-missing',
    severity: 'error',
    title: 'decision 出边缺少标签',
    description: 'decision 的每条出边都要写 yes/no 或具体条件标签。',
  },
  {
    code: 'plan-process-verification-missing',
    severity: 'error',
    title: 'process 缺少验证/验收说明',
    description: '每个实施步骤（process）都要写验证方式或验收标准。',
  },
  {
    code: 'plan-failure-branch-missing',
    severity: 'warn',
    title: '缺少失败/回滚分支',
    description: '计划要说明失败时如何止损、回滚或降级。',
  },
  {
    code: 'plan-group-parent-missing',
    severity: 'error',
    title: 'group 父节点悬空',
    description: '节点的 parentGroup 必须指向一个存在的 group。',
  },
  {
    code: 'plan-too-many-nodes',
    severity: 'warn',
    title: '计划图节点过多',
    description: `计划图节点超过 ${PLAN_NODE_SOFT_LIMIT} 个时，建议拆成子计划或分层计划。`,
  },
  {
    code: 'plan-analysis-failed',
    severity: 'error',
    title: '计划自检失败',
    description: '输入数据异常导致计划自检无法完成。',
  },
])

const RULE_BY_CODE = new Map(PLAN_CHECK_RULES.map(rule => [rule.code, rule]))

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function textOf(value) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join('；')
  return ''
}

function firstText(...values) {
  for (const value of values) {
    const text = textOf(value)
    if (text !== '') return text
  }
  return ''
}

function issue(code, message, nodeId) {
  const rule = RULE_BY_CODE.get(code)
  const result = {
    code,
    severity: rule?.severity ?? 'info',
    message,
  }
  if (nodeId !== undefined && nodeId !== null && String(nodeId) !== '') {
    result.nodeId = String(nodeId)
  }
  return result
}

function emptyCoverage(present = false) {
  return {
    present,
    source: null,
    flowchart: false,
    nodeCount: 0,
    edgeCount: 0,
    startCount: 0,
    endCount: 0,
    decisionCount: 0,
    processCount: 0,
    groupCount: 0,
    noteCount: 0,
    verifiedProcessCount: 0,
    unverifiedProcessCount: 0,
    failureBranch: false,
  }
}

function nodeIdOf(node, index) {
  return firstText(node?.id, node?.nodeId, node?.key, `n${index + 1}`)
}

function nodeTypeOf(node) {
  return firstText(node?.type, node?.kind, node?.shape).toLowerCase()
}

function labelOf(node) {
  return firstText(node?.label, node?.title, node?.name, node?.text, node?.id, node?.nodeId)
}

function edgeFromOf(edge) {
  return firstText(edge?.from, edge?.source, edge?.start, edge?.fromId)
}

function edgeToOf(edge) {
  return firstText(edge?.to, edge?.target, edge?.end, edge?.toId)
}

function edgeLabelOf(edge) {
  return firstText(edge?.label, edge?.condition, edge?.title, edge?.name)
}

function hasVerification(node) {
  const values = [
    node?.verification,
    node?.verify,
    node?.acceptance,
    node?.acceptanceCriteria,
    node?.verificationNotes,
    node?.done,
  ]
  const hasExplicit = values.some(value => {
    if (value !== null && typeof value === 'object') return Object.keys(value).length > 0
    return textOf(value) !== ''
  })
  if (hasExplicit) return true
  return /验收|验证|测试|verify|verification|test|check|断言|预期/i.test(
    [node?.description, node?.note, node?.detail, node?.label].map(textOf).join(' '),
  )
}

function nodeFailureText(node) {
  return [
    node?.failure,
    node?.rollback,
    node?.fallback,
    node?.failureBranch,
    node?.rollbackBranch,
    node?.label,
    node?.description,
    node?.note,
  ].map(textOf).join(' ')
}

function hasFailureText(text) {
  return /失败|回滚|回退|降级|兜底|异常|补偿|rollback|roll\s*back|fallback|failure|failed|error/i.test(text)
}

// Very small Mermaid reader for `flowchart TD` / `graph TD` blocks. It is not a
// full parser: it understands node shapes, labelled edges and `subgraph`
// membership, which is exactly what the plan checks need.
function parseMermaid(source) {
  const nodes = []
  const edges = []
  const groups = new Map()
  const stack = []
  let groupSeq = 0

  const addNode = (id, rawLabel, shapeText) => {
    const cleanId = String(id).trim()
    if (cleanId === '') return
    let existing = nodes.find(node => node.id === cleanId)
    if (existing === undefined) {
      existing = { id: cleanId }
      nodes.push(existing)
    }
    if (rawLabel !== undefined && String(rawLabel) !== '') existing.label = rawLabel
    const hasShape = shapeText !== undefined && String(shapeText) !== ''
    const shape = String(shapeText ?? '')
    let type = 'process'
    if (shape.startsWith('{')) type = 'decision'
    else if (shape.startsWith('>')) type = 'note'
    else if (shape.startsWith('((') || shape.startsWith('([') || shape.startsWith('[/') || shape.startsWith('[\\')) {
      type = /end|结束|完成|交付|done/i.test(rawLabel ?? '') ? 'end' : 'start'
    }
    if (type === 'start' && /end|结束|完成|交付|done/i.test(rawLabel ?? '')) type = 'end'
    if (/^start$/i.test(cleanId)) type = 'start'
    if (/^end$/i.test(cleanId)) type = 'end'
    if (hasShape || existing.type === undefined) existing.type = type
    if (stack.length > 0) existing.parentGroup = stack[stack.length - 1]
  }

  for (const rawLine of String(source).split(/\r?\n/)) {
    const line = rawLine.replace(/%%.*$/, '').trim()
    if (line === '' || /^(flowchart|graph)\b/i.test(line)) continue

    const subgraph = line.match(/^subgraph\s+([^\s[]+)(?:\[(.*?)\])?/i)
    if (subgraph !== null) {
      let id = subgraph[1]
      if (groups.has(id)) id = `${id}${++groupSeq}`
      groups.set(id, subgraph[2] ?? id)
      nodes.push({ id, type: 'group', label: subgraph[2] ?? id })
      stack.push(id)
      continue
    }
    if (/^end$/i.test(line)) {
      stack.pop()
      continue
    }

    // Node declarations can share a line with edges: replace each shape with
    // the bare id so the remaining text can be parsed as edges.
    const declarationPattern = /([A-Za-z0-9_][A-Za-z0-9_.:-]*)\s*(\(\(.*?\)\)|\[\[.*?\]\]|\[\(.*?\)\]|\[.*?\]|\{.*?\}|\(.*?\)|>.*?\])/g
    const edgeLine = line.replace(declarationPattern, (match, id, shape) => {
      const inner = shape
        .replace(/^\(\(|^\[\[|^\[\(|^\[|^\{|^\(|^>/, '')
        .replace(/\)\)$|\]\]$|\)\]$|\]$|\}$|\)$/, '')
        .trim()
      const label = inner.replace(/^["']|["']$/g, '')
      addNode(id, label, shape)
      return id
    })

    // Edges: a -->|label| b, a -- label --> b, a --> b, a -.-> b, a ==> b.
    const labelledEdge = /([A-Za-z0-9_][A-Za-z0-9_.:-]*)\s*--\s*([^->]+?)\s*-->\s*([A-Za-z0-9_][A-Za-z0-9_.:-]*)/g
    const pipedEdge = /([A-Za-z0-9_][A-Za-z0-9_.:-]*)\s*(?:-->|==>|-\.->)\s*(?:\|([^|]*)\|)?\s*([A-Za-z0-9_][A-Za-z0-9_.:-]*)/g
    let edgeMatch
    const pipedLine = edgeLine.replace(labelledEdge, (match, from, label, to) => {
      edges.push({ from, to, label: firstText(label) })
      addNode(from)
      addNode(to)
      return ` ${from} ${to} `
    })
    while ((edgeMatch = pipedEdge.exec(pipedLine)) !== null) {
      const from = edgeMatch[1]
      const to = edgeMatch[3]
      if (from === to) continue
      edges.push({ from, to, label: firstText(edgeMatch[2]) })
      addNode(from)
      addNode(to)
    }
  }

  for (const [id, label] of groups) {
    const node = nodes.find(item => item.id === id)
    if (node !== undefined) node.label = label
  }

  return { nodes, edges, flowchart: nodes.length > 0 }
}

function planCandidates(input) {
  const candidates = []
  const add = value => {
    if (value !== undefined && value !== null) candidates.push(value)
  }
  if (typeof input === 'string') {
    add(input)
    return candidates
  }
  if (input === null || typeof input !== 'object') return candidates

  add(input.plan)
  add(input.planGraph)
  add(input.planMode)
  add(input.planDiagram)
  if (
    typeof input.mermaid === 'string'
    || typeof input.sourceText === 'string'
    || (typeof input.code === 'string' && /\b(flowchart|graph)\b/i.test(input.code))
  ) {
    add(input)
  }
  if (Array.isArray(input.nodes) || Array.isArray(input.edges)) add(input)

  const diagrams = asArray(input.diagrams)
  for (const diagram of diagrams) {
    if (diagram === null || typeof diagram !== 'object') continue
    const key = firstText(diagram.key, diagram.type).toLowerCase()
    if (key.includes('plan') || key.includes('flowchart')) add(diagram)
  }
  return candidates
}

function normalizePlanInput(candidate) {
  if (typeof candidate === 'string') {
    const parsed = parseMermaid(candidate)
    return {
      nodes: parsed.nodes,
      edges: parsed.edges,
      flowchart: parsed.flowchart,
      source: 'mermaid',
    }
  }
  if (candidate === null || typeof candidate !== 'object') return null

  const mermaid = firstText(candidate.mermaid, candidate.flowchart, candidate.sourceText, candidate.code)
  const nodes = asArray(candidate.nodes)
  const edges = asArray(candidate.edges)
  if (nodes.length > 0 || edges.length > 0) {
    return { nodes, edges, flowchart: true, source: 'object' }
  }
  if (mermaid !== '' && /^\s*(flowchart|graph)\b/im.test(mermaid)) {
    const parsed = parseMermaid(mermaid)
    return {
      nodes: parsed.nodes,
      edges: parsed.edges,
      flowchart: parsed.flowchart,
      source: 'mermaid',
    }
  }
  return { nodes: [], edges: [], flowchart: false, source: 'object' }
}

function resolvePlan(input) {
  for (const candidate of planCandidates(input)) {
    const normalized = normalizePlanInput(candidate)
    if (normalized !== null && normalized.flowchart) return normalized
  }
  return { nodes: [], edges: [], flowchart: false, source: null }
}

export function analyzePlan(blueprint) {
  try {
    const plan = resolvePlan(blueprint)
    const nodes = Array.isArray(plan.nodes) ? plan.nodes.filter(node => node !== null && typeof node === 'object') : []
    const edges = Array.isArray(plan.edges) ? plan.edges.filter(edge => edge !== null && typeof edge === 'object') : []
    const coverage = emptyCoverage(plan.flowchart)
    coverage.source = plan.source
    coverage.flowchart = plan.flowchart
    coverage.nodeCount = nodes.length
    coverage.edgeCount = edges.length

    if (!plan.flowchart || nodes.length === 0) {
      return {
        issues: [issue('plan-flowchart-missing', '计划中没有找到流程图（flowchart TD）或计划图节点。请先输出计划图，再实现代码。')],
        coverage,
      }
    }

    const issues = []
    const normalizedNodes = nodes.map((node, index) => ({
      raw: node,
      id: nodeIdOf(node, index),
      type: nodeTypeOf(node),
      label: labelOf(node),
      parentGroup: firstText(node.parentGroup, node.group, node.parent),
    }))
    const outgoing = new Map()
    for (const edge of edges) {
      const from = edgeFromOf(edge)
      if (from === '') continue
      const list = outgoing.get(from) ?? []
      list.push(edge)
      outgoing.set(from, list)
    }

    const starts = normalizedNodes.filter(node => node.type === 'start')
    const ends = normalizedNodes.filter(node => node.type === 'end')
    const decisions = normalizedNodes.filter(node => node.type === 'decision')
    const processes = normalizedNodes.filter(node => node.type === 'process')
    const groups = normalizedNodes.filter(node => node.type === 'group')
    const notes = normalizedNodes.filter(node => node.type === 'note')
    coverage.startCount = starts.length
    coverage.endCount = ends.length
    coverage.decisionCount = decisions.length
    coverage.processCount = processes.length
    coverage.groupCount = groups.length
    coverage.noteCount = notes.length

    if (starts.length === 0 || ends.length === 0) {
      const missing = [
        starts.length === 0 ? 'start' : '',
        ends.length === 0 ? 'end' : '',
      ].filter(Boolean).join('/')
      issues.push(issue('plan-terminal-missing', `计划图缺少 ${missing} 终止节点；计划必须有明确的开始与结束。`))
    }

    for (const decision of decisions) {
      const out = outgoing.get(decision.id) ?? []
      if (out.length < 2) {
        issues.push(issue(
          'plan-decision-branches',
          `decision“${decision.label || decision.id}”只有 ${out.length} 条出边；至少需要两条分支并写清条件。`,
          decision.id,
        ))
      }
      if (out.some(edge => edgeLabelOf(edge) === '')) {
        issues.push(issue(
          'plan-decision-label-missing',
          `decision“${decision.label || decision.id}”存在没有标签的出边；每条分支都要写 yes/no 或具体条件。`,
          decision.id,
        ))
      }
    }

    let failureBranch = nodes.some(node => hasFailureText(nodeFailureText(node)))
      || edges.some(edge => hasFailureText(firstText(edgeLabelOf(edge), edge?.note, edge?.description)))
    for (const node of normalizedNodes) {
      if (['failure', 'rollback', 'fallback', 'error'].includes(node.type)) failureBranch = true
    }
    coverage.failureBranch = failureBranch

    let unverified = 0
    for (const process of processes) {
      if (!hasVerification(process.raw)) {
        unverified += 1
        issues.push(issue(
          'plan-process-verification-missing',
          `process“${process.label || process.id}”没有验证/验收说明；请写清测试、命令或可观察结果。`,
          process.id,
        ))
      }
    }
    coverage.verifiedProcessCount = processes.length - unverified
    coverage.unverifiedProcessCount = unverified

    if (!failureBranch) {
      issues.push(issue(
        'plan-failure-branch-missing',
        '计划没有失败/回滚分支；请补充失败时的止损、回退状态或降级路径。',
      ))
    }

    const groupIds = new Set(groups.map(group => group.id))
    for (const node of normalizedNodes) {
      if (node.parentGroup === '' || node.type === 'group') continue
      if (!groupIds.has(node.parentGroup)) {
        issues.push(issue(
          'plan-group-parent-missing',
          `节点“${node.label || node.id}”的 parentGroup“${node.parentGroup}”不存在；请先定义对应 group。`,
          node.id,
        ))
      }
    }

    if (nodes.length > PLAN_NODE_SOFT_LIMIT) {
      issues.push(issue(
        'plan-too-many-nodes',
        `计划图有 ${nodes.length} 个节点，超过建议上限 ${PLAN_NODE_SOFT_LIMIT}；请拆分为主计划与子计划，或合并重复步骤。`,
      ))
    }

    return { issues, coverage }
  } catch (error) {
    return {
      issues: [issue('plan-analysis-failed', `计划自检失败：${String(error?.message ?? error)}`)],
      coverage: emptyCoverage(false),
    }
  }
}
