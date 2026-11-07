import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  archiveBlueprintVersion,
  blueprintRelativePath,
  blueprintVersionsRelativeDir,
  normalizeBlueprint,
  parseBlueprintSaveInput,
  readBlueprintFile,
  readBlueprintVersion,
  readVersionsIndex,
  saveBlueprintFromCommand,
  semanticDiff,
  mermaidFor,
} from '../lib/blueprint.js'

test('normalizes all eight diagram kinds and keeps typed fields, messages and cardinality', () => {
  const blueprint = normalizeBlueprint({
    title: 'Checkout',
    diagrams: [
      {
        key: 'sequence',
        nodes: [{ id: 'u', type: 'participant', label: 'User' }, { id: 'a', type: 'participant', label: 'API' }],
        edges: [{ from: 'u', to: 'a', label: 'POST /pay', kind: 'sync', order: 1 }],
      },
      {
        key: 'er',
        nodes: [
          { id: 'order', type: 'entity', label: 'Order', fields: [{ name: 'id', type: 'uuid', key: true }, { name: 'total', type: 'int' }] },
          { id: 'rel', type: 'relationship', label: 'contains' },
        ],
        edges: [{ from: 'order', to: 'rel', cardinality: '1..*' }],
      },
      {
        key: 'c4',
        nodes: [{ id: 'api', type: 'container', label: 'API', technology: 'Node.js', description: 'Payments' }],
        edges: [],
      },
    ],
  }, undefined, { sessionId: 'session-test' })

  assert.equal(blueprint.diagrams.length, 8)
  assert.deepEqual(blueprint.diagrams.map(diagram => diagram.key), ['usecase', 'dfd', 'module', 'sequence', 'er', 'c4', 'class', 'state'])
  const sequence = blueprint.diagrams.find(diagram => diagram.key === 'sequence')
  assert.equal(sequence.edges[0].order, 1)
  assert.equal(sequence.edges[0].kind, 'sync')
  const er = blueprint.diagrams.find(diagram => diagram.key === 'er')
  assert.deepEqual(er.nodes[0].fields, [{ name: 'id', type: 'uuid', key: true }, { name: 'total', type: 'int' }])
  assert.equal(er.edges[0].cardinality, '1..*')
  const c4 = blueprint.diagrams.find(diagram => diagram.key === 'c4')
  assert.equal(c4.nodes[0].technology, 'Node.js')
  assert.equal(c4.nodes[0].description, 'Payments')
})

test('adds new diagram kinds to older three-diagram blueprints', () => {
  const blueprint = normalizeBlueprint({
    title: 'Legacy',
    diagrams: [{ key: 'usecase', nodes: [{ id: 'u', type: 'actor', label: 'User' }], edges: [] }],
  }, undefined, { sessionId: 's' })
  assert.equal(blueprint.diagrams.length, 8)
  assert.equal(blueprint.diagrams.find(diagram => diagram.key === 'sequence').nodes.length, 0)
  assert.equal(blueprint.diagrams.find(diagram => diagram.key === 'class').nodes.length, 0)
  assert.equal(blueprint.diagrams.find(diagram => diagram.key === 'state').nodes.length, 0)
})

test('keeps class/state nodes, member kinds and relation kinds', () => {
  const blueprint = normalizeBlueprint({
    title: 'Model',
    diagrams: [
      {
        key: 'class',
        nodes: [
          { id: 'shape', type: 'interface', label: 'Shape', fields: [{ name: 'area', type: 'number', kind: 'method' }] },
          {
            id: 'circle',
            type: 'class',
            label: 'Circle',
            fields: [
              { name: 'radius', type: 'number', key: true },
              { name: 'resize', type: 'void', kind: 'method', note: 'mutates' },
            ],
          },
        ],
        edges: [{ from: 'circle', to: 'shape', kind: 'implements', label: 'contract' }],
      },
      {
        key: 'state',
        nodes: [
          { id: 'start', type: 'initial', label: 'Start' },
          { id: 'idle', type: 'state', label: 'Idle' },
          { id: 'done', type: 'final', label: 'Done' },
        ],
        edges: [{ from: 'start', to: 'idle', kind: 'transition', label: 'boot' }, { from: 'idle', to: 'done', kind: 'transition', label: 'stop' }],
      },
    ],
  }, undefined, { sessionId: 's' })

  const cls = blueprint.diagrams.find(diagram => diagram.key === 'class')
  assert.deepEqual(cls.nodes[0].fields, [{ name: 'area', type: 'number', kind: 'method' }])
  assert.deepEqual(cls.nodes[1].fields, [
    { name: 'radius', type: 'number', key: true },
    { name: 'resize', type: 'void', note: 'mutates', kind: 'method' },
  ])
  assert.equal(cls.edges[0].kind, 'implements')
  assert.equal(cls.edges[0].label, 'contract')

  const state = blueprint.diagrams.find(diagram => diagram.key === 'state')
  assert.deepEqual(state.nodes.map(node => node.type), ['initial', 'state', 'final'])
  assert.equal(state.edges[0].kind, 'transition')
  assert.equal(state.edges[0].label, 'boot')

  const classMermaid = mermaidFor(blueprint, 'class')
  assert.match(classMermaid, /classDiagram/)
  assert.match(classMermaid, /<<interface>>/)
  assert.match(classMermaid, /<\|\.\./)
  const stateMermaid = mermaidFor(blueprint, 'state')
  assert.match(stateMermaid, /stateDiagram-v2/)
  assert.match(stateMermaid, /\[\*\] --> idle/)
})

test('semantic diff reports requirement, diagram and module changes', () => {
  const before = normalizeBlueprint({
    title: 'A',
    sections: [{ key: 'goals', title: 'Goals', items: ['one', 'two'] }],
    diagrams: [{ key: 'usecase', nodes: [{ id: 'u', type: 'actor', label: 'User' }], edges: [] }],
    modules: [{ id: 'api', name: 'API', summary: 'old', dependsOn: [] }],
  }, undefined, { sessionId: 's' })
  const after = normalizeBlueprint({
    title: 'A',
    sections: [{ key: 'goals', title: 'Goals', items: ['one', 'three'] }],
    diagrams: [{
      key: 'usecase',
      nodes: [{ id: 'u', type: 'actor', label: 'User' }, { id: 'b', type: 'usecase', label: 'Browse' }],
      edges: [{ from: 'u', to: 'b', label: 'uses' }],
    }],
    modules: [
      { id: 'api', name: 'API', summary: 'new', dependsOn: [] },
      { id: 'ui', name: 'UI', dependsOn: ['api'] },
    ],
  }, undefined, { sessionId: 's' })

  const diff = semanticDiff(before, after)
  assert.equal(diff.sections[0].added[0], 'three')
  assert.equal(diff.sections[0].removed[0], 'two')
  assert.equal(diff.diagrams[0].addedNodes[0].label, 'Browse')
  assert.equal(diff.diagrams[0].addedEdges.length, 1)
  assert.equal(diff.modules.added[0].name, 'UI')
  assert.equal(diff.modules.changed[0].changes[0].field, 'summary')
  assert.ok(diff.totals.added >= 3)
})

test('semantic diff lists concrete node and edge changes', () => {
  const before = normalizeBlueprint({
    title: 'A',
    diagrams: [{
      key: 'usecase',
      nodes: [
        { id: 'u', type: 'actor', label: 'User' },
        { id: 'b', type: 'usecase', label: 'Browse' },
        { id: 'c', type: 'usecase', label: 'Checkout' },
      ],
      edges: [
        { from: 'u', to: 'b', label: 'uses' },
        { from: 'u', to: 'c', label: 'uses' },
      ],
    }, { key: 'dfd', nodes: [{ id: 'p', type: 'process', label: 'Parse' }], edges: [] }],
  }, undefined, { sessionId: 's' })
  const after = normalizeBlueprint({
    title: 'A',
    diagrams: [{
      key: 'usecase',
      nodes: [
        { id: 'u', type: 'actor', label: 'Buyer' },
        { id: 'b', type: 'usecase', label: 'Browse' },
        { id: 'p', type: 'usecase', label: 'Pay' },
      ],
      edges: [
        { from: 'u', to: 'b', label: 'opens' },
        { from: 'b', to: 'p', label: 'uses' },
      ],
    }, { key: 'dfd', nodes: [{ id: 'p', type: 'process', label: 'Parse' }], edges: [] }],
  }, undefined, { sessionId: 's' })

  const diff = semanticDiff(before, after)
  assert.equal(diff.diagrams.length, 1)
  const diagram = diff.diagrams[0]
  assert.equal(diagram.key, 'usecase')
  assert.deepEqual(diagram.addedNodes.map(node => [node.id, node.type, node.label]), [['p', 'usecase', 'Pay']])
  assert.deepEqual(diagram.removedNodes.map(node => [node.id, node.type, node.label]), [['c', 'usecase', 'Checkout']])
  assert.equal(diagram.changedNodes.length, 1)
  assert.equal(diagram.changedNodes[0].id, 'u')
  assert.equal(diagram.changedNodes[0].label, 'Buyer')
  assert.deepEqual(diagram.changedNodes[0].changes, [{ field: 'label', before: 'User', after: 'Buyer' }])
  assert.deepEqual(diagram.addedEdges.map(edge => [edge.from, edge.to, edge.label, edge.kind]), [
    ['u', 'b', 'opens', ''],
    ['b', 'p', 'uses', ''],
  ])
  assert.deepEqual(diagram.removedEdges.map(edge => [edge.from, edge.to, edge.label, edge.kind]), [
    ['u', 'b', 'uses', ''],
    ['u', 'c', 'uses', ''],
  ])
  assert.equal(diff.totals.addedNodes, 1)
  assert.equal(diff.totals.removedNodes, 1)
  assert.equal(diff.totals.changedNodes, 1)
  assert.equal(diff.totals.addedEdges, 2)
  assert.equal(diff.totals.removedEdges, 2)
})

test('semantic diff reports type and requirementIds changes on nodes', () => {
  const before = {
    diagrams: [{
      key: 'dfd',
      nodes: [{ id: 'p', type: 'process', label: 'Parse', requirementIds: ['functional-1'] }],
      edges: [],
    }],
  }
  const after = {
    diagrams: [{
      key: 'dfd',
      nodes: [{ id: 'p', type: 'store', label: 'Parse', requirementIds: ['functional-1', 'functional-2'] }],
      edges: [],
    }],
  }
  const diff = semanticDiff(before, after)
  assert.deepEqual(diff.diagrams[0].changedNodes[0].changes, [
    { field: 'type', before: 'process', after: 'store' },
    { field: 'requirementIds', before: ['functional-1'], after: ['functional-1', 'functional-2'] },
  ])
})

test('archives versions, refuses duplicates and restores a version file', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-blueprint-'))
  try {
    const first = normalizeBlueprint({ title: 'v1' }, undefined, { sessionId: 'session-x' })
    const archived = await archiveBlueprintVersion(cwd, 'session-x', first, { source: 'agent' })
    assert.ok(archived.entry.id.startsWith('v-'))
    const duplicate = await archiveBlueprintVersion(cwd, 'session-x', first, { source: 'agent' })
    assert.equal(duplicate.skipped, true)

    const second = normalizeBlueprint({ ...first, title: 'v2' }, first, { sessionId: 'session-x' })
    await archiveBlueprintVersion(cwd, 'session-x', second, { source: 'ui', label: 'hand edit' })
    const index = await readVersionsIndex(cwd, 'session-x')
    assert.equal(index.versions.length, 2)
    assert.equal(index.versions[0].title, 'v2')
    assert.equal(index.versions[0].label, 'hand edit')

    const restored = await readBlueprintVersion(cwd, 'session-x', index.versions[1].id)
    assert.equal(restored.title, 'v1')
    const files = await fs.readdir(path.join(cwd, blueprintVersionsRelativeDir('session-x')))
    assert.ok(files.includes('index.json'))
    assert.ok(files.some(file => file.endsWith('.json') && file !== 'index.json'))
    assert.ok((await fs.stat(path.join(cwd, blueprintRelativePath('session-x'))).catch(() => null)) === null)
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('parses the optional --draft flag for /blueprint save', () => {
  assert.deepEqual(parseBlueprintSaveInput('eyJ0aXRsZSI6IkEifQ=='), {
    encoded: 'eyJ0aXRsZSI6IkEifQ==',
    draft: false,
    mode: 'archived',
  })
  assert.deepEqual(parseBlueprintSaveInput('eyJ0aXRsZSI6IkEifQ== --draft'), {
    encoded: 'eyJ0aXRsZSI6IkEifQ==',
    draft: true,
    mode: 'draft',
  })
  assert.deepEqual(parseBlueprintSaveInput('--draft eyJ0aXRsZSI6IkEifQ=='), {
    encoded: 'eyJ0aXRsZSI6IkEifQ==',
    draft: true,
    mode: 'draft',
  })
  assert.equal(parseBlueprintSaveInput('').encoded, '')
})

test('draft save writes the file without creating version history', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-blueprint-draft-'))
  try {
    const saved = await saveBlueprintFromCommand({
      cwd,
      sessionId: 'session-draft',
      input: { title: 'Draft only' },
      draft: true,
    })
    assert.equal(saved.mode, 'draft')
    assert.equal(saved.archived, false)
    assert.deepEqual(saved.archiveErrors, [])
    const onDisk = await readBlueprintFile(path.join(cwd, blueprintRelativePath('session-draft')))
    assert.equal(onDisk.title, 'Draft only')
    const index = await readVersionsIndex(cwd, 'session-draft')
    assert.equal(index.versions.length, 0)
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('archived save writes the file and creates the version snapshot', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-blueprint-archive-'))
  try {
    const first = await saveBlueprintFromCommand({
      cwd,
      sessionId: 'session-archive',
      input: { title: 'v1' },
    })
    assert.equal(first.mode, 'archived')
    assert.equal(first.archived, true)
    assert.deepEqual(first.archiveErrors, [])
    assert.equal((await readVersionsIndex(cwd, 'session-archive')).versions.length, 1)

    const second = await saveBlueprintFromCommand({
      cwd,
      sessionId: 'session-archive',
      input: { title: 'v2' },
      previous: first.blueprint,
    })
    assert.equal(second.archived, true)
    // Archiving the previous version is skipped when it is identical to the last snapshot.
    assert.equal((await readVersionsIndex(cwd, 'session-archive')).versions.length, 1)
    const onDisk = await readBlueprintFile(path.join(cwd, blueprintRelativePath('session-archive')))
    assert.equal(onDisk.title, 'v2')

    const third = await saveBlueprintFromCommand({
      cwd,
      sessionId: 'session-archive',
      input: { title: 'v3' },
      previous: second.blueprint,
    })
    assert.equal(third.archived, true)
    const index = await readVersionsIndex(cwd, 'session-archive')
    assert.equal(index.versions.length, 2)
    assert.equal(index.versions[0].title, 'v2')
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('archive failure still writes the blueprint and reports a readable warning', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-blueprint-broken-'))
  try {
    const versionsDir = path.join(cwd, blueprintVersionsRelativeDir('session-broken'))
    await fs.mkdir(path.dirname(versionsDir), { recursive: true })
    await fs.writeFile(versionsDir, 'not a directory', 'utf8')

    const saved = await saveBlueprintFromCommand({
      cwd,
      sessionId: 'session-broken',
      input: { title: 'survives archive failure' },
    })
    assert.equal(saved.archived, false)
    assert.ok(saved.archiveErrors.length > 0)
    const onDisk = await readBlueprintFile(path.join(cwd, blueprintRelativePath('session-broken')))
    assert.equal(onDisk.title, 'survives archive failure')
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})
