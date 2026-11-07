import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'

const source = await fs.readFile(new URL('../client.js', import.meta.url), 'utf8')
let captured
const window = { __ModuleLoader__: { load(definition) { captured = definition } } }
vm.runInNewContext(source, { window, console }, { filename: 'client.js' })
assert.ok(captured, 'client.js should register a module factory')
const React = {
  Component: class Component {
    constructor(props) { this.props = props; this.state = {} }
    setState(patch) { this.state = { ...this.state, ...patch } }
  },
  Fragment: Symbol('Fragment'),
  createElement() { return null },
  useState() { return [undefined, () => {}] },
  useEffect() {},
  useRef() { return { current: null } },
  useMemo(callback) { return callback() },
  useSyncExternalStore() { return undefined },
}
const client = captured.factory(name => {
  if (name === 'react') return React
  throw new Error(`unexpected require: ${name}`)
})
const { parseMermaid, detectImportSource, ensureLayout, layoutDiagram, MAX_IMPORT_BYTES, MAX_IMPORT_NODES } = client.__test
const parse = input => JSON.parse(JSON.stringify(parseMermaid(input)))

function expectFailure(run, code) {
  assert.throws(run, failure => failure?.code === code)
}

test('detects draw.io XML and Mermaid from pasted text', () => {
  assert.equal(detectImportSource('  <mxfile host="x">'), 'drawio')
  assert.equal(detectImportSource('<?xml version="1.0"?>\n<mxGraphModel/>'), 'drawio')
  assert.equal(detectImportSource('classDiagram\n class A'), 'mermaid')
  assert.equal(detectImportSource('<mxfile>', 'mermaid'), 'mermaid')
  assert.equal(detectImportSource('classDiagram', 'drawio'), 'drawio')
})

test('maps class diagrams, members and relations', () => {
  const parsed = parse(`classDiagram
  %% a comment that must be ignored
  class Animal {
    +String name
    +int age
    +move() void
    +
  }
  class Flyable {
    <<interface>>
    +fly() void
  }
  class Bird
  Animal <|-- Bird
  Flyable <|.. Bird
  Bird --> Nest : builds
  Bird ..> Food
  classDef hot fill:#f00
`)
  assert.equal(parsed.kind, 'class')
  assert.equal(parsed.diagramKey, 'class')
  assert.deepEqual(parsed.nodes.map(node => node.label).sort(), ['Animal', 'Bird', 'Flyable', 'Food', 'Nest'])
  const animal = parsed.nodes.find(node => node.label === 'Animal')
  assert.deepEqual(animal.fields, [
    { name: 'name', type: 'String', kind: 'field' },
    { name: 'age', type: 'int', kind: 'field' },
    { name: 'move', type: 'void', kind: 'method' },
    { name: '+', note: 'unparsed member' },
  ])
  const flyable = parsed.nodes.find(node => node.label === 'Flyable')
  assert.equal(flyable.type, 'interface')
  const kinds = new Map(parsed.edges.map(edge => [`${edge.from}->${edge.to}`, edge.kind]))
  assert.equal(kinds.get('Bird->Animal'), 'extends')
  assert.equal(kinds.get('Bird->Flyable'), 'implements')
  assert.equal(kinds.get('Bird->Nest'), 'association')
  assert.equal(kinds.get('Bird->Food'), 'dependency')
  assert.equal(parsed.edges.find(edge => edge.label === 'builds').label, 'builds')
})

test('maps state diagrams including initial, final and labels', () => {
  const parsed = parse(`stateDiagram-v2
  %% comment
  [*] --> Idle
  state "Waiting for input" as Wait
  Idle --> Wait : start
  Wait --> [*] : cancel
  note right of Idle : not modeled
  direction LR
  classDef hot fill:#f00
`)
  assert.equal(parsed.kind, 'state')
  assert.equal(parsed.diagramKey, 'state')
  const initial = parsed.nodes.find(node => node.type === 'initial')
  const final = parsed.nodes.find(node => node.type === 'final')
  const wait = parsed.nodes.find(node => node.label === 'Waiting for input')
  assert.ok(initial)
  assert.ok(final)
  assert.equal(wait.id, 'Wait')
  const byId = new Map(parsed.nodes.map(node => [node.id, node]))
  const transitions = parsed.edges.map(edge => ({ from: byId.get(edge.from).label, to: byId.get(edge.to).label, label: edge.label, kind: edge.kind }))
  assert.deepEqual(transitions, [
    { from: 'Initial', to: 'Idle', label: undefined, kind: 'transition' },
    { from: 'Idle', to: 'Waiting for input', label: 'start', kind: 'transition' },
    { from: 'Waiting for input', to: 'Final', label: 'cancel', kind: 'transition' },
  ])
})

test('maps flowcharts to usecase nodes and keeps edge labels', () => {
  const parsed = parse(`flowchart TD
  %% comment
  A[User opens page] --> B{Logged in?}
  B -- yes --> C(Dashboard)
  B -- no --> D(Login)
  A -->|optional| E
  classDef hot fill:#f00
  style A fill:#fff
  click C href "https://example.com"
`)
  assert.equal(parsed.kind, 'flowchart')
  assert.equal(parsed.diagramKey, 'usecase')
  assert.deepEqual(parsed.nodes.map(node => node.label).sort(), ['Dashboard', 'E', 'Logged in?', 'Login', 'User opens page'])
  assert.ok(parsed.nodes.every(node => node.type === 'usecase'))
  const byId = new Map(parsed.nodes.map(node => [node.id, node]))
  const edges = parsed.edges.map(edge => ({
    from: byId.get(edge.from).label,
    to: byId.get(edge.to).label,
    label: edge.label,
  }))
  assert.deepEqual(edges, [
    { from: 'User opens page', to: 'Logged in?', label: undefined },
    { from: 'Logged in?', to: 'Dashboard', label: 'yes' },
    { from: 'Logged in?', to: 'Login', label: 'no' },
    { from: 'User opens page', to: 'E', label: 'optional' },
  ])
})

test('ensureLayout only positions nodes missing coordinates and keeps edges', () => {
  const blueprint = {
    diagrams: [
      {
        key: 'usecase',
        nodes: [
          { id: 'a', type: 'actor', label: 'Actor', x: 11, y: 22, w: 90, h: 104 },
          { id: 'u', type: 'usecase', label: 'Use' },
        ],
        edges: [{ id: 'e1', from: 'a', to: 'u' }],
      },
      { key: 'dfd', nodes: [], edges: [] },
    ],
  }

  ensureLayout(blueprint)
  const diagram = blueprint.diagrams[0]
  const actor = diagram.nodes.find(node => node.id === 'a')
  const usecase = diagram.nodes.find(node => node.id === 'u')
  assert.deepEqual([actor.x, actor.y, actor.w, actor.h], [11, 22, 90, 104])
  assert.equal(typeof usecase.x, 'number')
  assert.equal(typeof usecase.y, 'number')
  assert.equal(typeof usecase.w, 'number')
  assert.equal(typeof usecase.h, 'number')
  assert.equal(diagram.edges.length, 1)
  assert.equal(diagram.edges[0].id, 'e1')

  // A second load must be a no-op: no node gets re-laid out once it has coords.
  const snapshot = JSON.stringify(diagram)
  ensureLayout(blueprint)
  assert.equal(JSON.stringify(diagram), snapshot)
})

test('ensureLayout keeps hand-placed coordinates across all eight diagram kinds', () => {
  const existing = (id, type, label, x, y) => ({ id, type, label, x, y, w: 120, h: 60 })
  const missing = (id, type, label) => ({ id, type, label })
  const diagrams = [
    { key: 'usecase', nodes: [existing('a', 'actor', 'Actor', 5, 6), missing('u', 'usecase', 'Use')], edges: [{ id: 'e1', from: 'a', to: 'u' }] },
    { key: 'dfd', nodes: [existing('p', 'process', 'P', 7, 8), missing('s', 'store', 'S')], edges: [{ id: 'e2', from: 'p', to: 's' }] },
    { key: 'module', nodes: [existing('m', 'module', 'M', 9, 10), missing('x', 'external', 'X')], edges: [{ id: 'e3', from: 'm', to: 'x' }] },
    { key: 'sequence', nodes: [existing('s1', 'participant', 'S1', 11, 12), missing('s2', 'participant', 'S2')], edges: [{ id: 'e4', from: 's1', to: 's2' }] },
    { key: 'er', nodes: [existing('r', 'entity', 'R', 13, 14), missing('rel', 'relationship', 'Rel')], edges: [{ id: 'e5', from: 'r', to: 'rel' }] },
    { key: 'c4', nodes: [existing('c', 'container', 'C', 15, 16), missing('person', 'person', 'P')], edges: [{ id: 'e6', from: 'person', to: 'c' }] },
    { key: 'class', nodes: [existing('k', 'class', 'K', 17, 18), missing('i', 'interface', 'I')], edges: [{ id: 'e7', from: 'k', to: 'i' }] },
    { key: 'state', nodes: [existing('st', 'state', 'St', 19, 20), missing('f', 'final', 'F')], edges: [{ id: 'e8', from: 'st', to: 'f' }] },
  ]

  ensureLayout({ diagrams })
  const expected = {
    usecase: [5, 6], dfd: [7, 8], module: [9, 10], sequence: [11, 12],
    er: [13, 14], c4: [15, 16], class: [17, 18], state: [19, 20],
  }
  for (const diagram of diagrams) {
    const placed = diagram.nodes[0]
    assert.deepEqual([placed.x, placed.y, placed.w, placed.h], [...expected[diagram.key], 120, 60], diagram.key)
    const added = diagram.nodes[1]
    assert.ok(Number.isFinite(added.x) && Number.isFinite(added.y), `${diagram.key} new node got coordinates`)
    assert.equal(diagram.edges.length, 1, `${diagram.key} edge preserved`)
  }
})

test('ensureLayout keeps an existing single coordinate when only the other is missing', () => {
  const blueprint = { diagrams: [{ key: 'usecase', nodes: [{ id: 'a', type: 'actor', label: 'Actor', x: 5 }, { id: 'u', type: 'usecase', label: 'Use' }], edges: [] }] }
  ensureLayout(blueprint)
  assert.equal(blueprint.diagrams[0].nodes[0].x, 5)
  assert.equal(typeof blueprint.diagrams[0].nodes[0].y, 'number')
})

test('explicit auto layout still reflows every node', () => {
  const diagram = {
    key: 'usecase',
    nodes: [
      { id: 'a', type: 'actor', label: 'Actor', x: 11, y: 22 },
      { id: 'u', type: 'usecase', label: 'Use', x: 33, y: 44 },
    ],
    edges: [{ id: 'e1', from: 'a', to: 'u' }],
  }
  layoutDiagram(diagram)
  assert.equal(diagram.nodes[0].x, 70)
  assert.equal(diagram.nodes[0].y, 110)
  assert.equal(diagram.nodes[1].x, 300)
  assert.equal(diagram.nodes[1].y, 92)
  assert.equal(diagram.edges.length, 1)
})

test('rejects oversized, over-limit and unsupported input with typed errors', () => {
  expectFailure(() => parseMermaid(`flowchart TD\n${'x'.repeat(MAX_IMPORT_BYTES + 1)}`), 'too-large')
  const tooMany = Array.from({ length: MAX_IMPORT_NODES + 1 }, (_, index) => `n${index}[Node ${index}]`).join('\n')
  expectFailure(() => parseMermaid(`flowchart TD\n${tooMany}`), 'too-many-nodes')
  expectFailure(() => parseMermaid('sequenceDiagram\n A->>B: hi'), 'unsupported')
  expectFailure(() => parseMermaid('not a diagram at all'), 'unsupported')
  expectFailure(() => parseMermaid('classDiagram\n%% only comments'), 'empty')
})
