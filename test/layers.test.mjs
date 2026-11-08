import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BlueprintValidationError,
  BLUEPRINT_LIMITS,
  BLUEPRINT_VERSION,
  mergeBlueprintForUpdate,
  normalizeBlueprint,
  semanticDiff,
} from '../lib/blueprint.js'

const DIAGRAM_KEYS = ['usecase', 'dfd', 'module', 'sequence', 'er', 'c4', 'class', 'state']

function withoutUpdatedAt(blueprint) {
  const copy = JSON.parse(JSON.stringify(blueprint))
  delete copy.updatedAt
  return copy
}

function expectInvalid(run, pattern) {
  assert.throws(run, error => {
    assert.ok(error instanceof BlueprintValidationError, `expected BlueprintValidationError, got ${error}`)
    assert.match(error.message, pattern)
    return true
  })
}

function letterAt(index) {
  let value = index
  let result = ''
  while (value > 0) {
    value -= 1
    result = String.fromCharCode(65 + (value % 26)) + result
    value = Math.floor(value / 26)
  }
  return result
}

test('migrates a version 1 blueprint to layers, module codes, diagram types and requirement codes', () => {
  const legacy = normalizeBlueprint({
    version: 1,
    title: 'Legacy',
    sections: [{ key: 'goals', items: ['one', 'two'] }],
    diagrams: [{ key: 'usecase', nodes: [{ id: 'u1', type: 'actor', label: 'User' }], edges: [] }],
    modules: [{ id: 'auth', name: 'Auth', dependsOn: [] }],
  }, undefined, { sessionId: 's' })

  assert.equal(legacy.version, BLUEPRINT_VERSION)
  assert.equal(legacy.migratedFrom, 1)
  assert.deepEqual(legacy.layers, [{ id: 'A', letter: 'A', title: '总览', parentModuleId: null }])

  assert.equal(legacy.diagrams.length, 8)
  assert.deepEqual(legacy.diagrams.map(diagram => diagram.key), DIAGRAM_KEYS)
  for (const diagram of legacy.diagrams) {
    assert.equal(diagram.layerId, 'A')
    assert.equal(diagram.type, diagram.key)
  }
  assert.equal(legacy.diagrams[0].nodes[0].id, 'u1')

  assert.equal(legacy.modules[0].id, 'auth')
  assert.equal(legacy.modules[0].layerId, 'A')
  assert.equal(legacy.modules[0].code, 'A1')
  assert.equal(legacy.modules[0].parentId, null)

  const goals = legacy.sections.find(section => section.key === 'goals')
  assert.deepEqual(goals.items.map(item => [item.uid, item.code, item.text]), [
    ['goals:i1', 'R1', 'one'],
    ['goals:i2', 'R2', 'two'],
  ])

  // Re-normalizing a migrated blueprint must be a no-op and must not lose migratedFrom.
  const again = normalizeBlueprint(legacy, undefined, { sessionId: 's' })
  assert.equal(again.migratedFrom, 1)
  assert.deepEqual(withoutUpdatedAt(again), withoutUpdatedAt(legacy))

  // A brand-new v2 blueprint that already names layers is not stamped as migrated.
  const fresh = normalizeBlueprint({
    title: 'Fresh',
    layers: [{ letter: 'A' }],
    modules: [{ id: 'api', name: 'API' }],
  }, undefined, { sessionId: 's' })
  assert.equal(fresh.migratedFrom, undefined)
  assert.equal(fresh.layers[0].letter, 'A')
})

test('builds an A -> B -> C layer tree and resolves parentModuleId by module id or code', () => {
  const blueprint = normalizeBlueprint({
    title: 'Layers',
    layers: [
      { letter: 'A', title: '总览' },
      { letter: 'B', title: '认证', parentModuleId: 'A1' },
      { letter: 'C', title: '登录', parentModuleId: 'B1' },
    ],
    modules: [
      { id: 'api', name: 'API' },
      { id: 'auth', name: 'Auth', layerId: 'B' },
      { id: 'login', name: 'Login', layerId: 'C' },
    ],
  }, undefined, { sessionId: 's' })

  assert.deepEqual(blueprint.layers.map(layer => [layer.id, layer.letter, layer.parentModuleId]), [
    ['A', 'A', null],
    ['B', 'B', 'api'],
    ['C', 'C', 'auth'],
  ])
  assert.deepEqual(blueprint.modules.map(module => [module.id, module.layerId, module.code, module.parentId]), [
    ['api', 'A', 'A1', null],
    ['auth', 'B', 'B1', 'api'],
    ['login', 'C', 'C1', 'auth'],
  ])
})

test('module codes keep legal explicit codes, never collide globally, and append inside a layer', () => {
  const conflict = normalizeBlueprint({
    layers: [{ letter: 'A' }],
    modules: [
      { id: 'a', name: 'A', code: 'A1' },
      { id: 'b', name: 'B', code: 'A1' },
      { id: 'c', name: 'C' },
    ],
  }, undefined, { sessionId: 's' })
  assert.deepEqual(conflict.modules.map(module => [module.id, module.code]), [['a', 'A1'], ['b', 'A2'], ['c', 'A3']])
  assert.equal(new Set(conflict.modules.map(module => module.code)).size, 3)

  const layered = normalizeBlueprint({
    layers: [{ letter: 'A' }, { letter: 'B', parentModuleId: 'root' }],
    modules: [
      { id: 'root', name: 'Root', code: 'A5' },
      { id: 'other', name: 'Other' },
      { id: 'child', name: 'Child', layerId: 'B', code: 'B7' },
      { id: 'invalid', name: 'Invalid', layerId: 'B', code: 'A9' },
    ],
  }, undefined, { sessionId: 's' })
  assert.deepEqual(layered.modules.map(module => [module.id, module.layerId, module.code]), [
    ['root', 'A', 'A5'],
    ['other', 'A', 'A6'],
    ['child', 'B', 'B7'],
    ['invalid', 'B', 'B8'],
  ])

  // Adding a module later starts above the highest number currently used in its layer.
  const appended = normalizeBlueprint({
    layers: layered.layers,
    modules: [...layered.modules, { id: 'later', name: 'Later' }],
  }, layered, { sessionId: 's' })
  assert.equal(appended.modules.find(module => module.id === 'later').code, 'A7')
})

test('keeps child-layer diagrams out of the root eight and enforces layer+type uniqueness', () => {
  const blueprint = normalizeBlueprint({
    layers: [{ letter: 'A' }, { letter: 'B', parentModuleId: 'api' }],
    modules: [{ id: 'api', name: 'API' }],
    diagrams: [
      { key: 'usecase', nodes: [{ id: 'u1', type: 'actor', label: 'User' }], edges: [] },
      { key: 'B:dfd', nodes: [{ id: 'p1', type: 'process', label: 'Parse' }], edges: [] },
      { layerId: 'B', type: 'er', nodes: [{ id: 'e1', type: 'entity', label: 'Order' }], edges: [] },
      // Duplicate layer+type must not overwrite or duplicate the first slot.
      { key: 'B:dfd', nodes: [{ id: 'ignored', type: 'process', label: 'Ignored' }], edges: [] },
      // An explicit root type may also be written with layerId/type only.
      { layerId: 'A', type: 'class', nodes: [{ id: 'c1', type: 'class', label: 'Shape' }], edges: [] },
    ],
  }, undefined, { sessionId: 's' })

  const root = blueprint.diagrams.filter(diagram => diagram.layerId === 'A')
  assert.equal(root.length, 2)
  assert.deepEqual(root.map(diagram => diagram.key), ['usecase', 'class'])
  assert.ok(root.every(diagram => diagram.type === diagram.key))
  assert.equal(root.find(diagram => diagram.key === 'usecase').nodes[0].id, 'u1')
  assert.equal(root.find(diagram => diagram.key === 'class').nodes[0].id, 'c1')

  const children = blueprint.diagrams.filter(diagram => diagram.layerId === 'B')
  assert.deepEqual(children.map(diagram => [diagram.key, diagram.type]), [
    ['B:dfd', 'dfd'],
    ['B:er', 'er'],
  ])
  assert.equal(children[0].nodes[0].id, 'p1')

  // A child layer with only one explicit diagram gets exactly that one diagram.
  const minimal = normalizeBlueprint({
    layers: [{ letter: 'A' }, { letter: 'B', parentModuleId: 'api' }],
    modules: [{ id: 'api', name: 'API' }],
    diagrams: [{ key: 'B:state', nodes: [{ id: 's1', type: 'state', label: 'Idle' }], edges: [] }],
  }, undefined, { sessionId: 's' })
  assert.equal(minimal.diagrams.filter(diagram => diagram.layerId === 'B').length, 1)
  assert.equal(minimal.diagrams.length, 1)

  expectInvalid(
    () => normalizeBlueprint({ diagrams: [{ key: 'bogus', nodes: [], edges: [] }] }),
    /图解 type 无效/,
  )
})

test('requirement items get stable uid/code and require codes are append-only across updates', () => {
  const first = normalizeBlueprint({
    sections: [{
      key: 'goals',
      items: [
        { id: 'i1', text: 'one', code: 'R5' },
        { id: 'i2', text: 'two', moduleId: 'missing-module' },
        'three',
      ],
    }],
  }, undefined, { sessionId: 's' })

  const goals = first.sections.find(section => section.key === 'goals')
  assert.deepEqual(goals.items.map(item => [item.uid, item.code, item.moduleId]), [
    ['goals:i1', 'R5', undefined],
    ['goals:i2', 'R6', 'missing-module'],
    ['goals:i3', 'R7', undefined],
  ])

  const second = normalizeBlueprint({
    sections: [{
      key: 'goals',
      items: [
        { id: 'i1', text: 'one' },
        { id: 'i2', text: 'two' },
        { id: 'i3', text: 'three' },
        { id: 'i4', text: 'four' },
      ],
    }],
  }, first, { sessionId: 's' })

  assert.deepEqual(second.sections.find(section => section.key === 'goals').items.map(item => [item.uid, item.code]), [
    ['goals:i1', 'R5'],
    ['goals:i2', 'R6'],
    ['goals:i3', 'R7'],
    ['goals:i4', 'R8'],
  ])
  // The unknown moduleId survives normalization; a later self-check reports it.
  assert.equal(second.sections.find(section => section.key === 'goals').items[1].moduleId, 'missing-module')
})

test('rejects duplicate letters, missing parents, cycles and layers beyond the depth limit', () => {
  expectInvalid(
    () => normalizeBlueprint({
      layers: [{ letter: 'B', parentModuleId: 'a' }, { letter: 'B', parentModuleId: 'b' }],
    }),
    /layer|letter 重复|层 letter 重复/,
  )
  expectInvalid(
    () => normalizeBlueprint({ layers: [{ letter: 'B', parentModuleId: 'nope' }] }),
    /parentModuleId 不存在/,
  )
  expectInvalid(
    () => normalizeBlueprint({
      layers: [
        { letter: 'B', parentModuleId: 'c1' },
        { letter: 'C', parentModuleId: 'b1' },
      ],
      modules: [
        { id: 'b1', name: 'B', layerId: 'B' },
        { id: 'c1', name: 'C', layerId: 'C' },
      ],
    }),
    /存在环/,
  )
  expectInvalid(
    () => normalizeBlueprint({
      layers: [
        { letter: 'B', parentModuleId: 'a1' },
        { letter: 'C', parentModuleId: 'b1' },
        { letter: 'D', parentModuleId: 'c1' },
        { letter: 'E', parentModuleId: 'd1' },
      ],
      modules: [
        { id: 'a1', name: 'A' },
        { id: 'b1', name: 'B', layerId: 'B' },
        { id: 'c1', name: 'C', layerId: 'C' },
        { id: 'd1', name: 'D', layerId: 'D' },
      ],
    }),
    /深度超过 4 层/,
  )
})

test('enforces readable upper limits instead of silently truncating', () => {
  expectInvalid(
    () => normalizeBlueprint({
      layers: Array.from({ length: BLUEPRINT_LIMITS.layers }, () => ({ parentModuleId: 'root' })),
      modules: [{ id: 'root', name: 'Root' }],
    }),
    /层 .*64/,
  )
  expectInvalid(
    () => normalizeBlueprint({
      sections: [{ key: 'goals', items: Array.from({ length: BLUEPRINT_LIMITS.requirements + 1 }, (_, index) => `r${index}`) }],
    }),
    /需求条目 .*2000/,
  )
  expectInvalid(
    () => normalizeBlueprint({
      modules: Array.from({ length: BLUEPRINT_LIMITS.modules + 1 }, (_, index) => ({ id: `m${index}`, name: `M${index}` })),
    }),
    /模块 .*500/,
  )

  const childLayers = 33
  const layers = [{ letter: 'A' }]
  const diagrams = []
  for (let index = 0; index < childLayers; index += 1) {
    const letter = letterAt(index + 2)
    layers.push({ letter, title: letter, parentModuleId: 'root' })
    for (const type of DIAGRAM_KEYS) diagrams.push({ layerId: letter, type })
  }
  expectInvalid(
    () => normalizeBlueprint({ layers, modules: [{ id: 'root', name: 'Root' }], diagrams }),
    /图实例 .*256/,
  )
})

test('update merge keeps child-layer diagrams and merges by layerId+type', () => {
  const base = normalizeBlueprint({
    title: 'Merge',
    layers: [{ letter: 'A' }, { letter: 'B', parentModuleId: 'api' }],
    modules: [{ id: 'api', name: 'API' }],
    diagrams: [
      { key: 'usecase', nodes: [{ id: 'u1', type: 'actor', label: 'User' }], edges: [] },
      { key: 'B:dfd', nodes: [{ id: 'p1', type: 'process', label: 'Parse' }], edges: [] },
      { key: 'B:er', nodes: [{ id: 'e1', type: 'entity', label: 'Order' }], edges: [] },
    ],
  }, undefined, { sessionId: 's' })

  const merged = mergeBlueprintForUpdate(base, {
    diagrams: [
      { key: 'usecase', nodes: [{ id: 'u1', label: 'Buyer' }] },
      { key: 'B:dfd', nodes: [{ id: 'p1', label: 'Parser' }, { id: 'p2', type: 'store', label: 'Cache' }] },
    ],
  }, { sessionId: 's' })

  assert.equal(merged.diagrams.find(diagram => diagram.key === 'usecase').nodes[0].label, 'Buyer')
  const dfd = merged.diagrams.find(diagram => diagram.key === 'B:dfd')
  assert.deepEqual(dfd.nodes.map(node => [node.id, node.label]), [['p1', 'Parser'], ['p2', 'Cache']])
  assert.equal(dfd.layerId, 'B')
  assert.equal(dfd.type, 'dfd')
  // The untouched child diagram and the layers survive an update.
  assert.deepEqual(merged.diagrams.find(diagram => diagram.key === 'B:er').nodes.map(node => node.id), ['e1'])
  assert.deepEqual(merged.layers.map(layer => layer.letter), ['A', 'B'])

  const diff = semanticDiff(base, merged)
  assert.equal(diff.diagrams.find(diagram => diagram.key === 'B:dfd').addedNodes[0].id, 'p2')
  assert.equal(diff.diagrams.find(diagram => diagram.key === 'usecase').changedNodes[0].label, 'Buyer')
})

test('normalize is idempotent for layered blueprints', () => {
  const first = normalizeBlueprint({
    title: 'Idempotent',
    layers: [{ letter: 'A' }, { letter: 'B', parentModuleId: 'api' }],
    sections: [{ key: 'functional', items: ['one', { id: 'f2', text: 'two', code: 'R9' }] }],
    modules: [{ id: 'api', name: 'API', code: 'A3' }, { id: 'child', name: 'Child', layerId: 'B' }],
    diagrams: [
      { key: 'usecase', nodes: [{ id: 'u1', type: 'actor', label: 'User' }], edges: [] },
      { key: 'B:dfd', nodes: [{ id: 'p1', type: 'process', label: 'Parse' }], edges: [] },
    ],
  }, undefined, { sessionId: 's' })
  const second = normalizeBlueprint(first, undefined, { sessionId: 's' })
  assert.deepEqual(withoutUpdatedAt(second), withoutUpdatedAt(first))
  assert.deepEqual(
    second.modules.map(module => [module.id, module.code, module.parentId]),
    [['api', 'A3', null], ['child', 'B1', 'api']],
  )
})
