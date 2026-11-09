import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeBlueprint } from '../lib/blueprint.js'
import {
  CHECK_RULES,
  analyzeBlueprint,
  coverageMatrix,
} from '../lib/checks.js'

function issueCodes(result) {
  return [...new Set(result.issues.map(issue => issue.code))].sort()
}

function issuesWithCode(result, code) {
  return result.issues.filter(issue => issue.code === code)
}

function cleanBlueprint() {
  return normalizeBlueprint({
    title: 'Clean',
    layers: [
      { letter: 'A' },
      { letter: 'B', parentModuleId: 'api' },
    ],
    modules: [
      { id: 'api', name: 'API', acceptance: ['返回 200'] },
      { id: 'login', name: 'Login', layerId: 'B', acceptance: ['登录成功'] },
    ],
    sections: [{
      key: 'functional',
      items: [
        { id: 'f1', text: '登录', moduleId: 'api' },
        { id: 'f2', text: '鉴权', moduleId: 'login' },
      ],
    }],
    diagrams: [
      {
        key: 'usecase',
        nodes: [
          { id: 'u1', type: 'actor', label: '用户' },
          { id: 'u2', type: 'usecase', label: '登录' },
          { id: 's1', type: 'system', label: '系统' },
        ],
        edges: [{ from: 'u1', to: 'u2' }],
      },
      {
        key: 'B:dfd',
        nodes: [
          { id: 'e1', type: 'entity', label: '客户端' },
          { id: 'p1', type: 'process', label: '校验' },
          { id: 'st1', type: 'store', label: '用户表' },
        ],
        edges: [{ from: 'e1', to: 'p1' }, { from: 'p1', to: 'st1' }],
      },
    ],
  }, undefined, { sessionId: 's' })
}

test('a consistent normalized blueprint has no issues and complete coverage', () => {
  const blueprint = cleanBlueprint()
  const result = analyzeBlueprint(blueprint)

  assert.deepEqual(result.issues, [])
  assert.deepEqual(result.summary, { error: 0, warn: 0, info: 0 })

  assert.equal(result.coverage.layers.length, 2)
  const [root, child] = result.coverage.layers
  assert.equal(root.layerId, 'A')
  assert.equal(root.moduleCount, 1)
  assert.equal(root.childLayerCount, 1)
  assert.equal(root.requirementCount, 1)
  assert.equal(root.coveredRequirementCount, 1)
  assert.equal(root.modulesMissingAcceptance, 0)
  assert.equal(root.modulesWithoutRequirements, 0)
  assert.deepEqual(root.modules.map(module => [module.code, module.name]), [['A1', 'API']])

  assert.equal(child.layerId, 'B')
  assert.equal(child.parentModuleId, 'api')
  assert.equal(child.childLayerCount, 0)
  assert.equal(child.requirementCount, 1)
  assert.deepEqual(child.modules.map(module => [module.code, module.name]), [['B1', 'Login']])

  assert.equal(result.coverage.global.totalRequirements, 2)
  assert.equal(result.coverage.global.coveredRequirements, 2)
  assert.deepEqual(result.coverage.global.unassignedRequirements, [])
  assert.deepEqual(result.coverage.global.modulesWithoutRequirements, [])
  assert.deepEqual(result.coverage.global.modulesMissingAcceptance, [])
  assert.deepEqual(result.coverage.global.layersWithoutModules, [])

  // coverageMatrix is the same pure view returned by analyzeBlueprint.
  assert.deepEqual(coverageMatrix(blueprint), result.coverage)
})

test('coverage spans an eight-level layer tree and counts child layers', () => {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  const layers = []
  const modules = []
  const sections = []
  for (const [index, letter] of letters.entries()) {
    layers.push({
      letter,
      title: `层 ${letter}`,
      ...(index === 0 ? {} : { parentModuleId: `m${index - 1}` }),
    })
    modules.push({
      id: `m${index}`,
      name: `模块 ${letter}`,
      layerId: letter,
      code: `${letter}1`,
      acceptance: ['验收通过'],
    })
    sections.push({
      key: 'functional',
      items: [{ id: `r${index}`, text: `需求 ${letter}`, code: `R${index + 1}`, moduleId: `m${index}` }],
    })
  }

  const blueprint = { layers, modules, sections }
  const result = analyzeBlueprint(blueprint)

  assert.deepEqual(result.issues, [])
  assert.equal(result.coverage.layers.length, 8)
  assert.deepEqual(
    result.coverage.layers.map(layer => [layer.layerId, layer.childLayerCount, layer.requirementCount]),
    [
      ['A', 1, 1], ['B', 1, 1], ['C', 1, 1], ['D', 1, 1],
      ['E', 1, 1], ['F', 1, 1], ['G', 1, 1], ['H', 0, 1],
    ],
  )
  assert.deepEqual(
    result.coverage.layers.map(layer => layer.modules[0].code),
    ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1'],
  )
  assert.equal(result.coverage.global.totalRequirements, 8)
  assert.equal(result.coverage.global.coveredRequirements, 8)
  assert.deepEqual(result.coverage.global.layersWithoutModules, [])
})

test('reports structural, traceability and quality problems with stable severities', () => {
  const blueprint = {
    layers: [
      { id: 'A', title: '总览' },
      { id: 'B', title: '子层', parentModuleId: 'ghost-parent' },
      { id: 'C', title: '空层', parentModuleId: 'm1' },
    ],
    modules: [
      { id: 'm1', name: '订单', layerId: 'A', code: 'A1', acceptance: ['下单成功'], dependsOn: ['m2'] },
      { id: 'm2', name: '支付', layerId: 'A', code: 'A1', dependsOn: ['m1'] },
      { id: 'm3', name: '结算', layerId: 'B', code: 'A9', dependsOn: ['ghost'] },
      { id: 'm4', name: '孤立模块', layerId: 'D', code: 'D1', acceptance: ['ok'] },
    ],
    sections: [{
      key: 'functional',
      items: [
        { id: 'f1', text: '下单', code: 'R1', moduleId: 'm1' },
        { id: 'f2', text: '没有承接', code: 'R2' },
        { id: 'f3', text: '指向幽灵模块', code: 'R3', moduleId: 'ghost' },
      ],
    }],
    diagrams: [
      {
        key: 'usecase',
        layerId: 'A',
        type: 'usecase',
        nodes: [
          { id: 'u1', type: 'usecase', label: '登录' },
          { id: 's1', type: 'system', label: '系统' },
        ],
        edges: [],
      },
      {
        key: 'A:dfd',
        layerId: 'A',
        type: 'dfd',
        nodes: [
          { id: 'e1', type: 'entity', label: '客户端' },
          { id: 'p1', type: 'process', label: '校验' },
          { id: 'p2', type: 'process', label: '落库' },
        ],
        edges: [{ from: 'e1', to: 'p1' }, { from: 'p1', to: 'nope' }],
      },
      {
        key: 'A:module',
        layerId: 'A',
        type: 'module',
        nodes: [
          { id: 'n1', type: 'module', label: '订单', moduleId: 'ghost-node-module' },
          { id: 'n2', type: 'module', label: '重复' },
          { id: 'n3', type: 'module', label: '重复' },
        ],
        edges: [{ from: 'n1', to: 'n2' }],
      },
    ],
  }

  const result = analyzeBlueprint(blueprint)

  assert.deepEqual(issueCodes(result), [
    'dfd-process-unbalanced',
    'edge-broken',
    'layer-empty',
    'layer-parent-missing',
    'module-acceptance-missing',
    'module-code-duplicate',
    'module-code-invalid',
    'module-dep-cycle',
    'module-dep-missing',
    'module-layer-missing',
    'module-no-requirement',
    'node-duplicate',
    'node-isolated',
    'node-module-missing',
    'requirement-module-missing',
    'requirement-unassigned',
    'usecase-no-actor',
  ])

  // Every emitted issue uses the severity declared in the public rule catalog.
  const severity = new Map(CHECK_RULES.map(rule => [rule.code, rule.severity]))
  for (const issue of result.issues) {
    assert.equal(issue.severity, severity.get(issue.code), `${issue.code} severity`)
    assert.equal(typeof issue.message, 'string')
    assert.ok(issue.message.length > 0)
  }

  const brokenEdge = issuesWithCode(result, 'edge-broken')
  assert.equal(brokenEdge.length, 1)
  assert.equal(brokenEdge[0].diagramKey, 'A:dfd')
  assert.deepEqual(brokenEdge[0].details.missing, ['to'])
  assert.equal(brokenEdge[0].details.from, 'p1')
  assert.equal(brokenEdge[0].details.to, 'nope')

  assert.equal(issuesWithCode(result, 'node-isolated').length, 3)
  assert.equal(issuesWithCode(result, 'node-duplicate').length, 1)
  assert.deepEqual(issuesWithCode(result, 'node-duplicate')[0].details.nodeIds, ['n2', 'n3'])
  assert.equal(issuesWithCode(result, 'usecase-no-actor').length, 1)

  const unbalanced = issuesWithCode(result, 'dfd-process-unbalanced')
  assert.equal(unbalanced.length, 2)
  const p1 = unbalanced.find(issue => issue.details.nodeId === 'p1')
  const p2 = unbalanced.find(issue => issue.details.nodeId === 'p2')
  assert.deepEqual([p1.details.missingInput, p1.details.missingOutput], [false, true])
  assert.deepEqual([p2.details.missingInput, p2.details.missingOutput], [true, true])

  assert.equal(issuesWithCode(result, 'module-code-duplicate').length, 1)
  assert.deepEqual(issuesWithCode(result, 'module-code-duplicate')[0].details.moduleIds, ['m1', 'm2'])
  assert.equal(issuesWithCode(result, 'module-code-invalid').length, 1)
  assert.equal(issuesWithCode(result, 'module-code-invalid')[0].moduleId, 'm3')
  assert.equal(issuesWithCode(result, 'module-dep-cycle').length, 1)
  assert.deepEqual(issuesWithCode(result, 'module-dep-cycle')[0].details.moduleIds.sort(), ['m1', 'm2'])
  assert.equal(issuesWithCode(result, 'module-dep-missing').length, 1)
  assert.deepEqual(issuesWithCode(result, 'module-dep-missing')[0].details.missing, ['ghost'])
  assert.equal(issuesWithCode(result, 'module-layer-missing').length, 1)
  assert.equal(issuesWithCode(result, 'module-layer-missing')[0].moduleId, 'm4')
  assert.equal(issuesWithCode(result, 'layer-parent-missing').length, 1)
  assert.equal(issuesWithCode(result, 'layer-parent-missing')[0].details.parentModuleId, 'ghost-parent')
  assert.equal(issuesWithCode(result, 'layer-empty').length, 1)
  assert.equal(issuesWithCode(result, 'layer-empty')[0].layerId, 'C')
  assert.equal(issuesWithCode(result, 'module-acceptance-missing').length, 2)

  const nodeModule = issuesWithCode(result, 'node-module-missing')
  assert.equal(nodeModule.length, 1)
  assert.equal(nodeModule[0].moduleId, 'ghost-node-module')
  assert.equal(nodeModule[0].details.nodeId, 'n1')

  const unassigned = issuesWithCode(result, 'requirement-unassigned')
  assert.equal(unassigned.length, 1)
  assert.equal(unassigned[0].requirementUid, 'functional:f2')
  assert.equal(unassigned[0].details.code, 'R2')
  const missingModule = issuesWithCode(result, 'requirement-module-missing')
  assert.equal(missingModule.length, 1)
  assert.equal(missingModule[0].moduleId, 'ghost')
  assert.equal(missingModule[0].requirementUid, 'functional:f3')

  assert.equal(issuesWithCode(result, 'module-no-requirement').length, 3)
  assert.equal(result.summary.error, 9)
  assert.equal(result.summary.warn, 11)
  assert.equal(result.summary.info, 3)
  assert.equal(result.summary.error + result.summary.warn + result.summary.info, result.issues.length)
})

test('coverage numbers follow moduleId attribution and expose every gap list', () => {
  const blueprint = {
    layers: [
      { id: 'A', title: '总览' },
      { id: 'B', title: '支付', parentModuleId: 'api' },
      { id: 'C', title: '登录', parentModuleId: 'api' },
      { id: 'D', title: '空层', parentModuleId: 'api' },
    ],
    modules: [
      { id: 'api', name: 'API', layerId: 'A', code: 'A1', acceptance: ['返回 200'] },
      { id: 'pay', name: '支付', layerId: 'B', code: 'B1' },
      { id: 'misc', name: '杂项', layerId: 'A', code: 'A2' },
      { id: 'login', name: '登录', layerId: 'C', code: 'C1', acceptance: ['登录成功'] },
    ],
    sections: [
      {
        key: 'functional',
        items: [
          { id: 'f1', text: '查询', code: 'R1', moduleId: 'api' },
          { id: 'f2', text: '支付', code: 'R2', moduleId: 'pay' },
          { id: 'f3', text: '登录', code: 'R3', moduleId: 'login' },
          { id: 'f4', text: '未承接', code: 'R4' },
        ],
      },
      {
        key: 'nonfunctional',
        items: [{ id: 'n1', text: '性能', code: 'R5', moduleId: 'does-not-exist' }],
      },
    ],
  }

  const result = analyzeBlueprint(blueprint)
  const coverage = result.coverage

  assert.equal(coverage.layers.length, 4)
  const [layerA, layerB, layerC, layerD] = coverage.layers
  assert.deepEqual(
    [layerA.layerId, layerA.moduleCount, layerA.requirementCount, layerA.coveredRequirementCount,
      layerA.modulesMissingAcceptance, layerA.modulesWithoutRequirements, layerA.childLayerCount],
    ['A', 2, 1, 1, 1, 1, 3],
  )
  assert.deepEqual(layerA.modules.map(module => [module.code, module.name, module.requirementCount]), [
    ['A1', 'API', 1],
    ['A2', '杂项', 0],
  ])
  assert.deepEqual(
    [layerB.layerId, layerB.requirementCount, layerB.modulesMissingAcceptance, layerB.childLayerCount],
    ['B', 1, 1, 0],
  )
  assert.deepEqual(
    [layerC.layerId, layerC.requirementCount, layerC.modulesMissingAcceptance],
    ['C', 1, 0],
  )
  assert.deepEqual([layerD.layerId, layerD.moduleCount, layerD.childLayerCount], ['D', 0, 0])

  assert.equal(coverage.global.totalRequirements, 5)
  assert.equal(coverage.global.coveredRequirements, 3)
  assert.deepEqual(
    coverage.global.unassignedRequirements.map(item => [item.uid, item.code, item.text, item.moduleId]),
    [
      ['functional:f4', 'R4', '未承接', null],
      ['nonfunctional:n1', 'R5', '性能', 'does-not-exist'],
    ],
  )
  assert.deepEqual(
    coverage.global.modulesWithoutRequirements.map(item => item.moduleId),
    ['misc'],
  )
  assert.deepEqual(
    coverage.global.modulesMissingAcceptance.map(item => item.moduleId),
    ['pay', 'misc'],
  )
  assert.deepEqual(
    coverage.global.layersWithoutModules.map(item => item.layerId),
    ['D'],
  )
  assert.deepEqual(coverage.global.parentLayersWithoutChildModules, [])

  // Same gaps are reported as issues.
  assert.equal(issuesWithCode(result, 'requirement-unassigned').length, 1)
  assert.equal(issuesWithCode(result, 'requirement-module-missing').length, 1)
  assert.equal(issuesWithCode(result, 'module-acceptance-missing').length, 2)
  assert.equal(issuesWithCode(result, 'layer-empty').length, 1)
  assert.equal(issuesWithCode(result, 'module-no-requirement').length, 1)
  assert.equal(result.summary.error, 1)
  assert.equal(result.summary.warn, 4)
  assert.equal(result.summary.info, 1)
})

test('malformed and hostile input degrades to empty coverage instead of throwing', () => {
  const inputs = [
    undefined,
    null,
    42,
    'not a blueprint',
    [],
    { sections: [null, 'x', { items: [null, 42, {}] }] },
    { modules: [null, { id: 1 }, {}], layers: 'bad', diagrams: { bad: null } },
    { layers: [{ id: 1 }], modules: 'bad', diagrams: [null, 'x'] },
  ]
  for (const input of inputs) {
    assert.doesNotThrow(() => {
      const result = analyzeBlueprint(input)
      assert.ok(Array.isArray(result.issues))
      assert.deepEqual(Object.keys(result.summary).sort(), ['error', 'info', 'warn'])
      assert.equal(result.summary.error + result.summary.warn + result.summary.info, result.issues.length)
      assert.ok(Array.isArray(result.coverage.layers))
      assert.ok(Array.isArray(result.coverage.modules))
      assert.ok(Array.isArray(result.coverage.global.unassignedRequirements))
      assert.equal(typeof result.coverage.global.totalRequirements, 'number')
    })
    assert.doesNotThrow(() => {
      const coverage = coverageMatrix(input)
      assert.ok(Array.isArray(coverage.layers))
      assert.ok(Array.isArray(coverage.modules))
    })
  }

  const hostile = {}
  Object.defineProperty(hostile, 'sections', {
    enumerable: true,
    get() {
      throw new Error('boom')
    },
  })
  assert.doesNotThrow(() => analyzeBlueprint(hostile))
  const result = analyzeBlueprint(hostile)
  assert.deepEqual(result.issues, [])
  assert.deepEqual(result.coverage.layers, [])
})

test('the rule catalog is unique, documented and severity-consistent', () => {
  const codes = CHECK_RULES.map(rule => rule.code)
  assert.equal(new Set(codes).size, codes.length)
  for (const rule of CHECK_RULES) {
    assert.ok(['error', 'warn', 'info'].includes(rule.severity))
    assert.ok(rule.title.length > 0)
  }
  assert.ok(CHECK_RULES.length >= 9)
  assert.ok(['edge-broken', 'module-dep-cycle', 'requirement-unassigned', 'module-acceptance-missing']
    .every(code => codes.includes(code)))
})

test('group and note containers are not reported as isolated nodes', () => {
  const blueprint = normalizeBlueprint({
    diagrams: [{
      key: 'flowchart',
      nodes: [
        { id: 'group-1', type: 'group', label: 'Phase' },
        { id: 'note-1', type: 'note', label: 'Remember' },
        { id: 'process-1', type: 'process', label: 'Lonely step' },
      ],
      edges: [],
    }],
  }, undefined, { sessionId: 's' })
  const result = analyzeBlueprint(blueprint)
  const isolated = result.issues.filter(issue => issue.code === 'node-isolated')
  assert.deepEqual(isolated.map(issue => issue.details.nodeId), ['process-1'])
})
