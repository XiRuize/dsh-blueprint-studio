import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PLAN_CHECK_RULES,
  PLAN_MODE_PROMPT,
  PLAN_NODE_SOFT_LIMIT,
  analyzePlan,
} from '../lib/plan.js'

function codesOf(result) {
  return [...new Set(result.issues.map(issue => issue.code))].sort()
}

function issueFor(result, code) {
  return result.issues.find(issue => issue.code === code)
}

function completePlan() {
  return {
    nodes: [
      { id: 'start', type: 'start', label: '开始' },
      { id: 'read', type: 'process', label: '读取蓝图与现状', verification: '人工核对现有蓝图和测试' },
      { id: 'd1', type: 'decision', label: '现状是否满足需求?' },
      {
        id: 'build',
        type: 'process',
        label: '实现步骤',
        acceptance: 'node --test 全部通过',
        parentGroup: 'g1',
      },
      { id: 'g1', type: 'group', label: '并行组：文件边界' },
      { id: 'rollback', type: 'process', label: '失败：回滚到上一版', verification: '检查日志与工作区状态' },
      { id: 'end', type: 'end', label: '完成' },
    ],
    edges: [
      { from: 'start', to: 'read', label: '开始' },
      { from: 'read', to: 'd1', label: '已读现状' },
      { from: 'd1', to: 'build', label: 'yes' },
      { from: 'd1', to: 'rollback', label: 'no' },
      { from: 'build', to: 'end', label: '验证通过' },
      { from: 'rollback', to: 'end', label: '已回滚' },
    ],
  }
}

test('PLAN_MODE_PROMPT includes the required plan-mode constraints', () => {
  const prompt = PLAN_MODE_PROMPT

  assert.match(prompt, /不写代码/)
  assert.match(prompt, /用户.*确认|确认.*之前/)
  assert.match(prompt, /目标/)
  assert.match(prompt, /非目标/)
  assert.match(prompt, /约束/)
  assert.match(prompt, /依赖/)
  assert.match(prompt, /decision/)
  assert.match(prompt, /yes\/no|yes.*no/)
  assert.match(prompt, /并行/)
  assert.match(prompt, /文件边界|文件\/目录/)
  assert.match(prompt, /验证/)
  assert.match(prompt, /回滚|失败分支/)
  assert.match(prompt, /flowchart TD/)
  for (const type of ['start', 'end', 'process', 'decision', 'group', 'note']) {
    assert.match(prompt, new RegExp(`\\b${type}\\b`))
  }
})

test('PLAN_CHECK_RULES is a frozen catalog with unique codes', () => {
  assert.ok(Object.isFrozen(PLAN_CHECK_RULES))
  assert.ok(PLAN_CHECK_RULES.length >= 8)
  const codes = PLAN_CHECK_RULES.map(rule => rule.code)
  assert.equal(new Set(codes).size, codes.length)
  for (const rule of PLAN_CHECK_RULES) {
    assert.equal(typeof rule.code, 'string')
    assert.equal(typeof rule.title, 'string')
    assert.ok(['error', 'warn', 'info'].includes(rule.severity))
  }
})

test('a complete plan has no issues and reports coverage', () => {
  const result = analyzePlan(completePlan())

  assert.deepEqual(result.issues, [])
  assert.equal(result.coverage.present, true)
  assert.equal(result.coverage.flowchart, true)
  assert.equal(result.coverage.nodeCount, 7)
  assert.equal(result.coverage.edgeCount, 6)
  assert.equal(result.coverage.startCount, 1)
  assert.equal(result.coverage.endCount, 1)
  assert.equal(result.coverage.decisionCount, 1)
  assert.equal(result.coverage.processCount, 3)
  assert.equal(result.coverage.groupCount, 1)
  assert.equal(result.coverage.verifiedProcessCount, 3)
  assert.equal(result.coverage.unverifiedProcessCount, 0)
  assert.equal(result.coverage.failureBranch, true)
})

test('a plan can be supplied under blueprint.plan or a plan diagram', () => {
  const nested = analyzePlan({ title: 'x', plan: completePlan() })
  assert.deepEqual(nested.issues, [])

  const inDiagram = analyzePlan({
    diagrams: [{ key: 'plan', type: 'flowchart', nodes: completePlan().nodes, edges: completePlan().edges }],
  })
  assert.deepEqual(inDiagram.issues, [])
})

test('missing flowchart is reported without throwing on empty data', () => {
  for (const input of [undefined, null, {}, { title: 'empty' }, [], 'not a plan']) {
    const result = analyzePlan(input)
    assert.equal(result.issues.length, 1)
    assert.equal(result.issues[0].code, 'plan-flowchart-missing')
    assert.equal(result.issues[0].severity, 'error')
    assert.equal(result.coverage.present, false)
  }
})

test('missing start and end nodes are reported', () => {
  const plan = completePlan()
  plan.nodes = plan.nodes.filter(node => node.type !== 'start' && node.type !== 'end')
  plan.edges = plan.edges.filter(edge => !['start', 'end'].includes(edge.from) && !['start', 'end'].includes(edge.to))

  const result = analyzePlan(plan)
  const found = issueFor(result, 'plan-terminal-missing')
  assert.ok(found)
  assert.match(found.message, /start/)
  assert.match(found.message, /end/)
})

test('decision with fewer than two labelled outgoing edges is reported', () => {
  const plan = completePlan()
  plan.edges = [
    { from: 'start', to: 'd1', label: '开始' },
    { from: 'd1', to: 'end' },
  ]
  plan.nodes = plan.nodes.filter(node => node.id !== 'read' && node.id !== 'build' && node.id !== 'g1' && node.id !== 'rollback')

  const result = analyzePlan(plan)
  assert.ok(codesOf(result).includes('plan-decision-branches'))
  assert.ok(codesOf(result).includes('plan-decision-label-missing'))
  const decisionIssue = issueFor(result, 'plan-decision-branches')
  assert.equal(decisionIssue.nodeId, 'd1')
  assert.equal(issueFor(result, 'plan-decision-label-missing').nodeId, 'd1')
})

test('process without verification or acceptance is reported', () => {
  const plan = completePlan()
  plan.nodes.find(node => node.id === 'build').verification = undefined
  plan.nodes.find(node => node.id === 'build').acceptance = undefined
  plan.nodes.find(node => node.id === 'build').label = '实现步骤'

  const result = analyzePlan(plan)
  const found = issueFor(result, 'plan-process-verification-missing')
  assert.ok(found)
  assert.equal(found.nodeId, 'build')
  assert.equal(result.coverage.unverifiedProcessCount, 1)
})

test('a plan without any failure or rollback path is reported', () => {
  const plan = completePlan()
  plan.nodes = plan.nodes.filter(node => node.id !== 'rollback')
  plan.edges = plan.edges.filter(edge => edge.from !== 'rollback' && edge.to !== 'rollback')
  plan.edges.push({ from: 'd1', to: 'end', label: 'no' })

  const result = analyzePlan(plan)
  assert.ok(codesOf(result).includes('plan-failure-branch-missing'))
  assert.equal(result.coverage.failureBranch, false)
})

test('dangling parentGroup is reported with the child node id', () => {
  const plan = completePlan()
  plan.nodes.find(node => node.id === 'build').parentGroup = 'missing-group'

  const result = analyzePlan(plan)
  const found = issueFor(result, 'plan-group-parent-missing')
  assert.ok(found)
  assert.equal(found.nodeId, 'build')
  assert.match(found.message, /missing-group/)
})

test('too many nodes recommends splitting the plan', () => {
  const nodes = [
    { id: 'start', type: 'start', label: '开始' },
    { id: 'end', type: 'end', label: '结束' },
  ]
  const edges = []
  for (let index = 0; index <= PLAN_NODE_SOFT_LIMIT; index += 1) {
    const id = `p${index}`
    nodes.push({ id, type: 'process', label: `步骤 ${index}`, verification: '测试通过' })
    edges.push({ from: 'start', to: id, label: '开始' })
    edges.push({ from: id, to: 'end', label: '完成' })
  }

  const result = analyzePlan({ nodes, edges })
  const found = issueFor(result, 'plan-too-many-nodes')
  assert.ok(found)
  assert.equal(found.severity, 'warn')
  assert.match(found.message, new RegExp(String(nodes.length)))
})

test('Mermaid flowchart text is parsed, including labelled and subgraph nodes', () => {
  const mermaid = `flowchart TD
  start([开始]) --> p[读取蓝图与现状 验证：人工核对]
  p --> d{是否满足需求?}
  d -->|yes| rollback[失败：回滚，验证：检查日志]
  d -->|no| rollback
  rollback --> end([完成])
  subgraph g1[并行组]
    x[独立文件 验收：测试通过]
  end
  x --> end
  note[验证与回滚都要写清]
`
  const result = analyzePlan({ mermaid })

  assert.equal(result.coverage.flowchart, true)
  assert.equal(result.coverage.startCount, 1)
  assert.equal(result.coverage.endCount, 1)
  assert.equal(result.coverage.decisionCount, 1)
  assert.equal(result.coverage.groupCount, 1)
  assert.ok(result.coverage.nodeCount >= 6)
  assert.deepEqual(result.issues, [])
})

test('analyzePlan never throws on malformed data', () => {
  const malformed = [
    { plan: { nodes: 'not-an-array', edges: 42 } },
    { nodes: [null, 42, 'x'], edges: [null, { from: 1 }] },
    { diagrams: [{ key: 'plan', nodes: [{ type: 'decision' }], edges: [] }] },
    { plan: { mermaid: 'flowchart TD\n ???' } },
  ]
  for (const input of malformed) {
    const result = analyzePlan(input)
    assert.ok(Array.isArray(result.issues))
    assert.ok(result.coverage !== undefined)
    for (const issue of result.issues) {
      assert.equal(typeof issue.code, 'string')
      assert.equal(typeof issue.severity, 'string')
      assert.equal(typeof issue.message, 'string')
    }
  }
})
