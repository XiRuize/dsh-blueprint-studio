import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DIAGRAM_DEFS,
  mergeBlueprintForUpdate,
  normalizeBlueprint,
} from '../lib/blueprint.js'

const LEGACY_DIAGRAM_KEYS = ['usecase', 'dfd', 'module', 'sequence', 'er', 'c4', 'class', 'state']

function flowchartOf(blueprint) {
  return blueprint.diagrams.find(diagram => diagram.type === 'flowchart')
}

function planNodes() {
  return [
    { id: 'start', type: 'start', label: '开始', description: '收到需求' },
    {
      id: 'build',
      type: 'process',
      label: '实现接口',
      parentGroup: 'delivery',
      owner: '后端',
      verification: '单元测试与接口验收通过',
      moduleId: 'api',
      description: '按契约实现',
      requirementIds: ['functional:i1'],
    },
    { id: 'check', type: 'decision', label: '验收是否通过', parentGroup: 'delivery', condition: '测试全部通过' },
    { id: 'delivery', type: 'group', label: '交付阶段', collapsed: true },
    { id: 'hint', type: 'note', label: '发布前冻结变更' },
    { id: 'end', type: 'end', label: '结束' },
  ]
}

test('flowchart is the ninth diagram definition after state', () => {
  assert.deepEqual(DIAGRAM_DEFS.map(def => def.key), [...LEGACY_DIAGRAM_KEYS, 'flowchart'])
  const def = DIAGRAM_DEFS.find(item => item.key === 'flowchart')
  assert.equal(def.title, '计划流程图')
  assert.deepEqual(def.types, ['start', 'end', 'process', 'decision', 'group', 'note'])
  assert.equal(def.defaultType, 'process')
})

test('normalizes all six flowchart node types and keeps planning fields', () => {
  const blueprint = normalizeBlueprint({
    title: 'Plan',
    diagrams: [{
      layerId: 'A',
      type: 'flowchart',
      nodes: planNodes(),
      edges: [
        { from: 'start', to: 'build', label: '开工', kind: 'flow' },
        { from: 'build', to: 'check', label: '提交验收' },
        { from: 'check', to: 'end', label: '通过', kind: 'dashed' },
        { from: 'check', to: 'hint', label: '例外', kind: 'unexpected' },
      ],
    }],
  }, undefined, { sessionId: 's' })

  // An explicit flowchart is a real ninth slot and does not pull in the other eight.
  assert.equal(blueprint.diagrams.length, 1)
  const diagram = flowchartOf(blueprint)
  assert.equal(diagram.key, 'flowchart')
  assert.equal(diagram.layerId, 'A')
  assert.deepEqual(diagram.nodes.map(node => node.type), ['start', 'process', 'decision', 'group', 'note', 'end'])

  const build = diagram.nodes.find(node => node.id === 'build')
  assert.equal(build.parentGroup, 'delivery')
  assert.equal(build.owner, '后端')
  assert.equal(build.verification, '单元测试与接口验收通过')
  assert.equal(build.moduleId, 'api')
  assert.equal(build.description, '按契约实现')
  assert.deepEqual(build.requirementIds, ['functional:i1'])

  const check = diagram.nodes.find(node => node.id === 'check')
  assert.equal(check.condition, '测试全部通过')
  assert.equal(check.parentGroup, 'delivery')

  const group = diagram.nodes.find(node => node.id === 'delivery')
  assert.equal(group.collapsed, true)

  // flowchart edges only accept flow/dashed; an omitted or unknown kind falls back to flow.
  assert.deepEqual(diagram.edges.map(edge => [edge.label, edge.kind]), [
    ['开工', 'flow'],
    ['提交验收', 'flow'],
    ['通过', 'dashed'],
    ['例外', 'flow'],
  ])
})

test('group requires a label and a dangling parentGroup survives normalization', () => {
  const blueprint = normalizeBlueprint({
    diagrams: [{
      type: 'flowchart',
      nodes: [
        { id: 'nameless', type: 'group', collapsed: true },
        { id: 'orphan', type: 'process', label: '孤立步骤', parentGroup: 'missing-group' },
        { id: 'done', type: 'end', label: '结束' },
      ],
      edges: [{ from: 'orphan', to: 'done' }],
    }],
  }, undefined, { sessionId: 's' })

  const diagram = flowchartOf(blueprint)
  // A group without a label is not a usable group node, so it is not created.
  assert.equal(diagram.nodes.some(node => node.id === 'nameless'), false)
  assert.equal(diagram.nodes.some(node => node.type === 'group'), false)
  // The dangling reference is kept verbatim for the self-check to report.
  assert.equal(diagram.nodes.find(node => node.id === 'orphan').parentGroup, 'missing-group')
})

test('legacy and untyped blueprints keep exactly the original eight diagrams', () => {
  const legacy = normalizeBlueprint({
    title: 'Legacy',
    diagrams: [{
      key: 'usecase',
      nodes: [{ id: 'u1', type: 'actor', label: '用户' }],
      edges: [],
    }],
  }, undefined, { sessionId: 's' })
  assert.equal(legacy.diagrams.length, 8)
  assert.deepEqual(legacy.diagrams.map(diagram => diagram.key), LEGACY_DIAGRAM_KEYS)
  assert.equal(flowchartOf(legacy), undefined)

  const empty = normalizeBlueprint({ title: 'Empty' }, undefined, { sessionId: 's' })
  assert.deepEqual(empty.diagrams.map(diagram => diagram.key), LEGACY_DIAGRAM_KEYS)
  assert.equal(flowchartOf(empty), undefined)

  // Re-normalizing an old blueprint never introduces the ninth diagram.
  const again = normalizeBlueprint(legacy, undefined, { sessionId: 's' })
  assert.deepEqual(again.diagrams.map(diagram => diagram.key), LEGACY_DIAGRAM_KEYS)
  assert.equal(flowchartOf(again), undefined)
})

test('untyped legacy input can opt in to flowchart explicitly, producing nine slots', () => {
  const blueprint = normalizeBlueprint({
    title: 'Legacy plus plan',
    diagrams: [
      { key: 'usecase', nodes: [{ id: 'u1', type: 'actor', label: '用户' }], edges: [] },
      { key: 'flowchart', nodes: planNodes(), edges: [{ from: 'start', to: 'build' }] },
    ],
  }, undefined, { sessionId: 's' })

  assert.equal(blueprint.diagrams.length, 9)
  assert.deepEqual(blueprint.diagrams.map(diagram => diagram.key), [...LEGACY_DIAGRAM_KEYS, 'flowchart'])
  assert.ok(flowchartOf(blueprint).nodes.length > 0)
})

test('an explicit layer model may keep only the flowchart diagram', () => {
  const blueprint = normalizeBlueprint({
    layers: [{ letter: 'A' }],
    diagrams: [{
      layerId: 'A',
      type: 'flowchart',
      nodes: [{ id: 'start', type: 'start', label: '开始' }, { id: 'end', type: 'end', label: '结束' }],
      edges: [{ from: 'start', to: 'end' }],
    }],
  }, undefined, { sessionId: 's' })

  assert.equal(blueprint.diagrams.length, 1)
  assert.equal(blueprint.diagrams[0].key, 'flowchart')
  assert.equal(blueprint.diagrams[0].type, 'flowchart')
})

test('update merge keeps flowchart fields and edge kinds by node id', () => {
  const base = normalizeBlueprint({
    diagrams: [{
      type: 'flowchart',
      nodes: planNodes(),
      edges: [{ from: 'start', to: 'build', label: '开工', kind: 'dashed' }],
    }],
  }, undefined, { sessionId: 's' })

  const merged = mergeBlueprintForUpdate(base, {
    diagrams: [{
      layerId: 'A',
      type: 'flowchart',
      nodes: [{ id: 'build', label: '实现服务' }],
    }],
  }, { sessionId: 's' })

  const diagram = flowchartOf(merged)
  const build = diagram.nodes.find(node => node.id === 'build')
  assert.equal(build.label, '实现服务')
  // Omitted fields survive the shallow patch merge.
  assert.equal(build.parentGroup, 'delivery')
  assert.equal(build.owner, '后端')
  assert.equal(build.verification, '单元测试与接口验收通过')
  assert.equal(diagram.edges[0].kind, 'dashed')
})
