import assert from 'node:assert/strict'
import test from 'node:test'
import { validateDiagram, validateDiagrams } from '../lib/validate.js'

const SEVERITY_RANK = { error: 0, warn: 1, info: 2 }

function blueprint(...diagrams) {
  return { diagrams }
}

function diagram(key, type, nodes, edges = []) {
  return { key, type, nodes, edges }
}

function codes(result) {
  return result.issues.map(issue => issue.code)
}

function assertHas(result, code) {
  assert.ok(codes(result).includes(code), `expected ${code} in ${JSON.stringify(codes(result))}`)
}

function assertClean(result) {
  assert.deepEqual(result.issues, [], `expected clean, got ${JSON.stringify(result.issues, null, 2)}`)
}

function positiveUsecase() {
  return diagram('usecase', 'usecase', [
    { id: 'a1', type: 'actor', label: '用户' },
    { id: 's1', type: 'system', label: '订单系统', x: 100, y: 40, w: 320, h: 220 },
    { id: 'u1', type: 'usecase', label: '下单', parentGroup: 's1' },
  ], [{ id: 'e1', from: 'a1', to: 'u1' }])
}

function positiveDfd() {
  return diagram('dfd', 'dfd', [
    { id: 'e1', type: 'entity', label: '客户端' },
    { id: 'p1', type: 'process', label: '校验订单' },
    { id: 'st1', type: 'store', label: '订单表' },
  ], [
    { id: 'e1', from: 'e1', to: 'p1' },
    { id: 'e2', from: 'p1', to: 'st1' },
  ])
}

function positiveSequence() {
  return diagram('sequence', 'sequence', [
    { id: 'p1', type: 'participant', label: '浏览器' },
    { id: 'p2', type: 'participant', label: '服务端' },
  ], [
    { id: 'm1', from: 'p1', to: 'p2', order: 1, label: 'POST /orders' },
    { id: 'm2', from: 'p2', to: 'p1', order: 2, label: '201 Created' },
    { id: 'm3', from: 'p1', to: 'p1', order: 3, label: 'self retry' },
  ])
}

function positiveEr() {
  return diagram('er', 'er', [
    { id: 'e1', type: 'entity', label: '订单', fields: [{ name: 'id', key: true }, { name: 'total' }] },
    { id: 'e2', type: 'entity', label: '用户', fields: [{ name: 'id', key: true }] },
    { id: 'r1', type: 'relationship', label: '拥有' },
  ], [
    { id: 'x1', from: 'e1', to: 'r1', label: '拥有' },
    { id: 'x2', from: 'r1', to: 'e2', label: '拥有' },
  ])
}

function positiveClass() {
  return diagram('class', 'class', [
    { id: 'c1', type: 'class', label: '订单', fields: [{ name: 'id', key: true }, { name: 'total' }] },
    { id: 'i1', type: 'interface', label: '可支付', fields: [{ name: 'pay', kind: 'method' }] },
  ], [{ id: 'e1', from: 'c1', to: 'i1', kind: 'realization' }])
}

function positiveC4() {
  return diagram('c4', 'c4', [
    { id: 'p1', type: 'person', label: '用户' },
    { id: 's1', type: 'system', label: '订单系统' },
    { id: 'x1', type: 'external', label: '支付网关' },
  ], [
    { id: 'e1', from: 'p1', to: 's1' },
    { id: 'e2', from: 'x1', to: 's1' },
  ])
}

function positiveState() {
  return diagram('state', 'state', [
    { id: 'i1', type: 'initial' },
    { id: 's1', type: 'state', label: '待支付' },
    { id: 'f1', type: 'final' },
  ], [
    { id: 'e1', from: 'i1', to: 's1' },
    { id: 'e2', from: 's1', to: 'f1' },
  ])
}

function positiveFlowchart() {
  return diagram('flowchart', 'flowchart', [
    { id: 'st', type: 'start' },
    { id: 'g1', type: 'group', label: '实现阶段' },
    { id: 'p1', type: 'process', label: '读取现状', parentGroup: 'g1' },
    { id: 'd1', type: 'decision', label: '满足需求?', condition: '测试通过' },
    { id: 'p2', type: 'process', label: '补齐实现', parentGroup: 'g1' },
    { id: 'en', type: 'end' },
  ], [
    { id: 'e1', from: 'st', to: 'p1' },
    { id: 'e2', from: 'p1', to: 'd1' },
    { id: 'e3', from: 'd1', to: 'en', label: '是' },
    { id: 'e4', from: 'd1', to: 'p2', label: '否' },
    { id: 'e5', from: 'p2', to: 'en' },
  ])
}

test('usecase: actor/system/containment positive and isolated/missing-edge negative', () => {
  assertClean(validateDiagrams(blueprint(positiveUsecase())))

  const result = validateDiagrams(blueprint(diagram('usecase', 'usecase', [
    { id: 'a1', type: 'actor', label: '用户' },
    { id: 's1', type: 'system', label: '订单系统' },
    { id: 'u1', type: 'usecase', label: '下单', parentGroup: 's1' },
  ], [{ id: 'e1', from: 'a1', to: 'ghost' }])))
  assertHas(result, 'usecase-edge-endpoint-missing')
  assertHas(result, 'usecase-isolated')
  assertHas(result, 'usecase-actor-isolated')
  assert.ok(result.issues.every(issue => typeof issue.fix === 'string' && issue.fix !== ''))
})

test('dfd: balanced process positive and unbalanced/unnamed/isolated negative', () => {
  assertClean(validateDiagrams(blueprint(positiveDfd())))

  const result = validateDiagrams(blueprint(diagram('dfd', 'dfd', [
    { id: 'e1', type: 'entity', label: '客户端' },
    { id: 'p1', type: 'process', label: '' },
    { id: 'st1', type: 'store', label: '订单表' },
  ], [{ id: 'e1', from: 'e1', to: 'p1' }])))
  assertHas(result, 'dfd-process-unbalanced')
  assertHas(result, 'dfd-process-unnamed')
  assertHas(result, 'dfd-node-isolated')
  assert.ok(codes(result).length >= 3)
})

test('sequence: ordered self-message positive and duplicate/missing/endpoint negative', () => {
  assertClean(validateDiagrams(blueprint(positiveSequence())))

  const result = validateDiagrams(blueprint(diagram('sequence', 'sequence', [
    { id: 'p1', type: 'participant', label: '浏览器' },
    { id: 'p2', type: 'participant', label: '服务端' },
  ], [
    { id: 'm1', from: 'p1', to: 'p2', order: 1 },
    { id: 'm2', from: 'p2', to: 'p1', order: 1 },
    { id: 'm3', from: 'p1', to: 'ghost', order: 2 },
    { id: 'm4', from: 'p1', to: 'p2' },
  ])))
  assertHas(result, 'sequence-order-duplicate')
  assertHas(result, 'sequence-order-missing')
  assertHas(result, 'sequence-message-endpoint-missing')
})

test('er: keyed entities with labels positive and pk/duplicate/relationship negative', () => {
  assertClean(validateDiagrams(blueprint(positiveEr())))

  const result = validateDiagrams(blueprint(diagram('er', 'er', [
    { id: 'e1', type: 'entity', label: '订单', fields: [{ name: 'id' }, { name: 'id' }] },
    { id: 'e2', type: 'entity', label: '用户', fields: [{ name: 'id', key: true }] },
    { id: 'r1', type: 'relationship', label: '' },
  ], [
    { id: 'x1', from: 'e1', to: 'ghost' },
    { id: 'x2', from: 'r1', to: 'e1' },
  ])))
  assertHas(result, 'er-primary-key-missing')
  assertHas(result, 'er-field-duplicate')
  assertHas(result, 'er-relationship-endpoint-missing')
  assertHas(result, 'er-relationship-endpoint-count')
  assertHas(result, 'er-relationship-unlabeled')
})

test('class: populated hierarchy positive and empty-member/cycle/endpoint negative', () => {
  assertClean(validateDiagrams(blueprint(positiveClass())))

  const result = validateDiagrams(blueprint(diagram('class', 'class', [
    { id: 'c1', type: 'class', label: '订单' },
    { id: 'i1', type: 'interface', label: '可支付', fields: [{ name: 'pay', kind: 'method' }] },
  ], [
    { id: 'e1', from: 'c1', to: 'i1', kind: 'inheritance' },
    { id: 'e2', from: 'i1', to: 'c1', kind: 'inheritance' },
    { id: 'e3', from: 'c1', to: 'ghost', kind: 'dependency' },
  ])))
  assertHas(result, 'class-member-empty')
  assertHas(result, 'class-inheritance-cycle')
  assertHas(result, 'class-edge-endpoint-missing')
})

test('c4: connected person/system positive and missing-core/isolated/endpoint negative', () => {
  assertClean(validateDiagrams(blueprint(positiveC4())))

  const result = validateDiagrams(blueprint(diagram('c4', 'c4', [
    { id: 'p1', type: 'person', label: '用户' },
    { id: 'x1', type: 'external', label: '支付网关' },
  ], [{ id: 'e1', from: 'p1', to: 'ghost' }])))
  assertHas(result, 'c4-node-missing')
  assertHas(result, 'c4-person-isolated')
  assertHas(result, 'c4-external-isolated')
  assertHas(result, 'c4-edge-endpoint-missing')
})

test('state: initial/final positive and final/choice/isolated/endpoint negative', () => {
  assertClean(validateDiagrams(blueprint(positiveState())))

  const result = validateDiagrams(blueprint(diagram('state', 'state', [
    { id: 'i1', type: 'initial' },
    { id: 's1', type: 'state', label: '待支付' },
    { id: 's2', type: 'state', label: '已取消' },
    { id: 'ch', type: 'choice', label: '校验' },
  ], [
    { id: 'e1', from: 'i1', to: 'ch' },
    { id: 'e2', from: 'ch', to: 's1' },
    { id: 'e3', from: 'ch', to: 'ghost' },
  ])))
  assertHas(result, 'state-final-missing')
  assertHas(result, 'state-isolated')
  assertHas(result, 'state-choice-branches')
  assertHas(result, 'state-transition-endpoint-missing')
})

test('flowchart: labeled decision with groups positive and branch/label/group/end negative', () => {
  assertClean(validateDiagrams(blueprint(positiveFlowchart())))

  const result = validateDiagrams(blueprint(diagram('flowchart', 'flowchart', [
    { id: 'st', type: 'start' },
    { id: 'p1', type: 'process', label: '读取现状' },
    { id: 'd1', type: 'decision', label: '满足需求?' },
    { id: 'p2', type: 'process', label: '补齐实现', parentGroup: 'missing-group' },
  ], [
    { id: 'e1', from: 'st', to: 'p1' },
    { id: 'e2', from: 'p1', to: 'd1' },
    { id: 'e3', from: 'd1', to: 'p2' },
    { id: 'e4', from: 'd1', to: 'ghost' },
  ])))
  assertHas(result, 'flowchart-end-missing')
  assertHas(result, 'flowchart-decision-branches')
  assertHas(result, 'flowchart-decision-label-missing')
  assertHas(result, 'flowchart-group-parent-missing')
  assertHas(result, 'flowchart-edge-endpoint-missing')
})

test('every issue carries code, severity, message, diagramKey and executable fix', () => {
  const result = validateDiagrams(blueprint(
    diagram('usecase', 'usecase', [{ id: 'u1', type: 'usecase', label: '下单' }]),
    diagram('dfd', 'dfd', [{ id: 'p1', type: 'process', label: '' }]),
    diagram('sequence', 'sequence', [{ id: 'p1', type: 'participant', label: 'A' }], [{ id: 'm1', from: 'p1', to: 'p1' }]),
    diagram('er', 'er', [{ id: 'e1', type: 'entity', label: '订单' }]),
    diagram('class', 'class', [{ id: 'c1', type: 'class', label: '订单' }]),
    diagram('c4', 'c4', [{ id: 'p1', type: 'person', label: '用户' }]),
    diagram('state', 'state', [{ id: 's1', type: 'state', label: '待支付' }]),
    diagram('flowchart', 'flowchart', [{ id: 'd1', type: 'decision', label: '?' }]),
    diagram('mystery', 'mystery', [{ id: 'n1', type: 'thing', label: 'X' }]),
  ))
  assert.ok(result.issues.length > 0)
  for (const issue of result.issues) {
    assert.equal(typeof issue.code, 'string')
    assert.ok(['error', 'warn', 'info'].includes(issue.severity))
    assert.equal(typeof issue.message, 'string')
    assert.ok(issue.message.length > 0)
    assert.equal(typeof issue.diagramKey, 'string')
    assert.ok(issue.diagramKey.length > 0)
    assert.equal(typeof issue.fix, 'string')
    assert.ok(issue.fix.length > 0, `missing fix for ${issue.code}`)
    if (issue.nodeId !== undefined) assert.equal(typeof issue.nodeId, 'string')
    if (issue.edgeId !== undefined) assert.equal(typeof issue.edgeId, 'string')
  }
  assertHas(result, 'diagram-type-unknown')
})

test('issues are stably sorted error/warn/info then code, diagramKey, nodeId, edgeId', () => {
  const build = () => [
    diagram('usecase', 'usecase', [{ id: 'u1', type: 'usecase', label: '下单' }]),
    diagram('flowchart', 'flowchart', [
      { id: 'p1', type: 'process', label: '步骤' },
      { id: 'd1', type: 'decision', label: '判断' },
    ], [{ id: 'e1', from: 'p1', to: 'd1' }]),
    diagram('dfd', 'dfd', [{ id: 'p1', type: 'process', label: '' }], [{ id: 'e1', from: 'p1', to: 'ghost' }]),
  ]

  const forward = validateDiagrams(blueprint(...build()))
  const reversed = validateDiagrams(blueprint(...build().reverse()))
  assert.deepEqual(forward.issues, reversed.issues)

  for (let index = 1; index < forward.issues.length; index += 1) {
    const previous = forward.issues[index - 1]
    const current = forward.issues[index]
    assert.ok(SEVERITY_RANK[previous.severity] <= SEVERITY_RANK[current.severity])
    if (previous.severity === current.severity) {
      assert.ok(previous.code <= current.code)
    }
  }
  assert.ok(forward.summary.error > 0)
  assert.ok(forward.summary.warn > 0)
})

test('malformed and non-object blueprints never throw and always return a report', () => {
  const inputs = [
    undefined,
    null,
    42,
    'not a blueprint',
    { diagrams: 'nope' },
    { diagrams: [null, {}, { key: 'usecase', nodes: 'x', edges: [null] }] },
    { charts: { usecase: { nodes: [{ id: 'u1', type: 'usecase' }] } } },
  ]
  for (const input of inputs) {
    const result = validateDiagrams(input)
    assert.ok(Array.isArray(result.issues))
    assert.deepEqual(Object.keys(result.summary).sort(), ['error', 'info', 'warn'])
    assert.ok(result.coverage !== undefined)
    assert.ok(Array.isArray(result.coverage.diagrams))
  }
})

test('empty blueprint yields no issues and zero coverage', () => {
  const result = validateDiagrams({})
  assert.deepEqual(result.issues, [])
  assert.deepEqual(result.summary, { error: 0, warn: 0, info: 0 })
  assert.deepEqual(result.coverage.diagrams, [])
  assert.deepEqual(result.coverage.totals, { diagrams: 0, nodes: 0, edges: 0, issues: 0 })
  assert.deepEqual(result.coverage.byType.usecase, { diagrams: 0, nodes: 0, edges: 0, issues: 0 })
  assert.deepEqual(result.coverage.byType.unknown, { diagrams: 0, nodes: 0, edges: 0, issues: 0 })
})

test('coverage reports node/edge/issue counts for each diagram family', () => {
  const result = validateDiagrams(blueprint(
    positiveUsecase(),
    positiveDfd(),
    diagram('er', 'er', [{ id: 'e1', type: 'entity', label: '订单' }]),
  ))
  assert.equal(result.coverage.totals.diagrams, 3)
  assert.equal(result.coverage.totals.nodes, 3 + 3 + 1)
  assert.equal(result.coverage.totals.edges, 1 + 2 + 0)
  assert.equal(result.coverage.totals.issues, result.issues.length)
  assert.deepEqual(result.coverage.byType.usecase, { diagrams: 1, nodes: 3, edges: 1, issues: 0 })
  assert.deepEqual(result.coverage.byType.dfd, { diagrams: 1, nodes: 3, edges: 2, issues: 0 })
  assert.equal(result.coverage.byType.er.diagrams, 1)
  assert.equal(result.coverage.byType.er.nodes, 1)
  assert.equal(result.coverage.byType.er.issues, 1)
  assert.equal(result.coverage.diagrams[0].key, 'usecase')
  assert.equal(result.coverage.diagrams[0].layerId, 'A')
})

test('validateDiagram is the single-diagram entry point with the same shape', () => {
  const single = positiveDfd()
  const one = validateDiagram(single)
  const wrapped = validateDiagrams({ diagrams: [single] })
  assert.deepEqual(one, wrapped)
  assert.equal(one.issues.length, 0)
  assert.equal(one.coverage.totals.diagrams, 1)
})
