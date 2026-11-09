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
  createElement(type, props, ...children) { return { type, props: props ?? {}, children } },
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
const {
  parseMermaid, detectImportSource, ensureLayout, layoutDiagram, Edge, NodeShape, flowchartHiddenIds,
  DIAGRAM_TYPE_ORDER, TEMPLATES, defaultEdgeKind, edgeKindsFor, typesFor,
  MAX_IMPORT_BYTES, MAX_IMPORT_NODES,
} = client.__test
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

test('maps flowcharts to plan-flowchart node types and keeps edge labels', () => {
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
  assert.equal(parsed.diagramKey, 'flowchart')
  assert.deepEqual(parsed.nodes.map(node => node.label).sort(), ['Dashboard', 'E', 'Logged in?', 'Login', 'User opens page'])
  const byLabel = new Map(parsed.nodes.map(node => [node.label, node]))
  assert.equal(byLabel.get('User opens page').type, 'process')
  assert.equal(byLabel.get('Logged in?').type, 'decision')
  assert.equal(byLabel.get('Logged in?').condition, 'Logged in?')
  assert.equal(byLabel.get('Dashboard').type, 'process')
  assert.equal(byLabel.get('Login').type, 'process')
  assert.equal(byLabel.get('E').type, 'process')
  const byId = new Map(parsed.nodes.map(node => [node.id, node]))
  const edges = parsed.edges.map(edge => ({
    from: byId.get(edge.from).label,
    to: byId.get(edge.to).label,
    label: edge.label,
    kind: edge.kind,
  }))
  assert.deepEqual(edges, [
    { from: 'User opens page', to: 'Logged in?', label: undefined, kind: 'flow' },
    { from: 'Logged in?', to: 'Dashboard', label: 'yes', kind: 'flow' },
    { from: 'Logged in?', to: 'Login', label: 'no', kind: 'flow' },
    { from: 'User opens page', to: 'E', label: 'optional', kind: 'flow' },
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

function planDiagram() {
  return {
    key: 'flowchart',
    type: 'flowchart',
    nodes: [
      { id: 'start', type: 'start', label: '开始' },
      { id: 'build', type: 'process', label: '实现', parentGroup: 'delivery' },
      { id: 'check', type: 'decision', label: '通过？', condition: '测试全部通过', parentGroup: 'delivery' },
      { id: 'fix', type: 'process', label: '修复', parentGroup: 'delivery' },
      { id: 'ship', type: 'process', label: '交付' },
      { id: 'delivery', type: 'group', label: '交付阶段', collapsed: false },
      { id: 'hint', type: 'note', label: '冻结变更' },
      { id: 'end', type: 'end', label: '结束' },
    ],
    edges: [
      { id: 'e1', from: 'start', to: 'build', kind: 'flow' },
      { id: 'e2', from: 'build', to: 'check', label: '提交', kind: 'flow' },
      { id: 'e3', from: 'check', to: 'fix', label: '否', kind: 'dashed' },
      { id: 'e4', from: 'check', to: 'ship', label: '是', kind: 'flow' },
      { id: 'e5', from: 'fix', to: 'check', label: '再验', kind: 'dashed' },
      { id: 'e6', from: 'ship', to: 'end', kind: 'flow' },
    ],
  }
}

function walkElements(element, visit) {
  if (element === null || element === undefined || element === false) return
  if (Array.isArray(element)) {
    for (const item of element) walkElements(item, visit)
    return
  }
  if (typeof element !== 'object') return
  visit(element)
  for (const child of element.children ?? []) walkElements(child, visit)
}

function findElement(element, predicate) {
  let found = null
  walkElements(element, item => { if (found === null && predicate(item)) found = item })
  return found
}

function elementText(element) {
  if (element === null || element === undefined || element === false) return ''
  if (typeof element === 'string' || typeof element === 'number') return String(element)
  if (Array.isArray(element)) return element.map(elementText).join('')
  return (element.children ?? []).map(elementText).join('')
}

test('flowchart is the ninth tab and every template carries an empty plan slot', () => {
  assert.deepEqual([...DIAGRAM_TYPE_ORDER], ['usecase', 'dfd', 'module', 'sequence', 'er', 'c4', 'class', 'state', 'flowchart'])
  assert.deepEqual([...typesFor('flowchart')], ['start', 'end', 'process', 'decision', 'group', 'note'])
  assert.equal(defaultEdgeKind('flowchart'), 'flow')
  assert.deepEqual([...edgeKindsFor('flowchart')], ['flow', 'dashed'])
  for (const template of TEMPLATES) {
    const blueprint = template.build()
    const diagram = blueprint.diagrams.find(item => item.key === 'flowchart' || item.type === 'flowchart')
    assert.ok(diagram, `${template.key} template has a flowchart slot`)
    if (template.key === 'plan') {
      assert.ok(diagram.nodes.length > 0)
      continue
    }
    assert.equal(diagram.nodes.length, 0)
    assert.equal(diagram.edges.length, 0)
    assert.equal(blueprint.diagrams.length, 9)
  }
})

test('flowchart layout is deterministic, top-down and branches decisions', () => {
  const diagram = planDiagram()
  layoutDiagram(diagram)
  const byId = new Map(diagram.nodes.map(node => [node.id, node]))
  const start = byId.get('start')
  const build = byId.get('build')
  const check = byId.get('check')
  const fix = byId.get('fix')
  const ship = byId.get('ship')
  const end = byId.get('end')
  assert.ok(start.y < build.y && build.y < check.y, 'ranks flow top-down')
  assert.ok(check.y < fix.y, 'decision child sits below the decision')
  assert.ok((fix.x - check.x) * (ship.x - check.x) < 0, 'decision successors fan out to opposite sides')
  assert.ok(end.y > check.y, 'end is below the merge')

  const delivery = byId.get('delivery')
  const children = ['build', 'check', 'fix'].map(id => byId.get(id))
  const minX = Math.min(...children.map(node => node.x))
  const maxX = Math.max(...children.map(node => node.x + node.w))
  assert.ok(delivery.x <= minX && delivery.x + delivery.w >= maxX, 'group wraps its children')
  assert.ok(delivery.y < Math.min(...children.map(node => node.y)), 'group header sits above children')
  assert.ok(byId.get('hint').x > Math.max(...children.map(node => node.x + node.w)), 'note sits beside the flow')

  const snapshot = diagram.nodes.map(node => [node.id, node.x, node.y, node.w, node.h])
  layoutDiagram(diagram)
  assert.deepEqual(diagram.nodes.map(node => [node.id, node.x, node.y, node.w, node.h]), snapshot)
})

test('flowchart layout survives cycles and keeps existing coordinates', () => {
  const cycle = {
    key: 'flowchart', type: 'flowchart',
    nodes: [
      { id: 'a', type: 'process', label: 'A' },
      { id: 'b', type: 'process', label: 'B' },
      { id: 'c', type: 'process', label: 'C' },
    ],
    edges: [
      { id: '1', from: 'a', to: 'b' },
      { id: '2', from: 'b', to: 'c' },
      { id: '3', from: 'c', to: 'a' },
    ],
  }
  layoutDiagram(cycle)
  assert.ok(cycle.nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y)))
  assert.equal(new Set(cycle.nodes.map(node => node.y)).size, 3, 'a cycle still yields three ranks')

  const blueprint = { diagrams: [{
    key: 'flowchart', type: 'flowchart',
    nodes: [
      { id: 's', type: 'start', label: 'S', x: 5, y: 6, w: 140, h: 48 },
      { id: 'p', type: 'process', label: 'P' },
      { id: 'g', type: 'group', label: 'G' },
    ],
    edges: [{ id: 'e', from: 's', to: 'p' }],
  }] }
  ensureLayout(blueprint)
  const placed = blueprint.diagrams[0].nodes.find(node => node.id === 's')
  assert.deepEqual([placed.x, placed.y, placed.w, placed.h], [5, 6, 140, 48])
  assert.ok(Number.isFinite(blueprint.diagrams[0].nodes.find(node => node.id === 'p').x))
  assert.ok(Number.isFinite(blueprint.diagrams[0].nodes.find(node => node.id === 'g').w))
})

test('flowchart group collapse hides descendants only in its own diagram', () => {
  const nodes = planDiagram().nodes
  assert.deepEqual([...flowchartHiddenIds(nodes)], [])
  nodes.find(node => node.id === 'delivery').collapsed = true
  assert.deepEqual([...flowchartHiddenIds(nodes)].sort(), ['build', 'check', 'fix'])
})

test('flowchart NodeShape renders capsules, diamonds, groups and notes', () => {
  const decision = NodeShape({
    node: { id: 'd', type: 'decision', label: '通过？', condition: '测试全部通过', x: 0, y: 0, w: 180, h: 110 },
    diagramType: 'flowchart', index: 0,
  })
  assert.equal(findElement(decision, item => item.type === 'polygon')?.type, 'polygon')
  assert.match(elementText(decision), /测试全部通过/)

  const start = NodeShape({ node: { id: 's', type: 'start', label: '开始', x: 0, y: 0, w: 140, h: 48 }, diagramType: 'flowchart', index: 0 })
  const capsule = findElement(start, item => item.type === 'rect' && item.props.height === 48 && item.props.rx === 24)
  assert.ok(capsule, 'start node is a capsule')

  const note = NodeShape({ node: { id: 'n', type: 'note', label: '备注', x: 0, y: 0, w: 200, h: 96 }, diagramType: 'flowchart', index: 0 })
  assert.ok(findElement(note, item => item.type === 'path' && String(item.props.d).includes('L')), 'note has a folded corner path')

  const collapsed = NodeShape({
    node: { id: 'g', type: 'group', label: '阶段', collapsed: true, x: 0, y: 0, w: 400, h: 300 },
    diagramType: 'flowchart', index: 0, onToggleGroup: () => {},
  })
  assert.ok(findElement(collapsed, item => item.type === 'text' && String(elementText(item)).includes('阶段')))
  assert.ok(!findElement(collapsed, item => item.type === 'rect' && item.props.height === 300), 'collapsed group only renders its header')

  const expanded = NodeShape({
    node: { id: 'g', type: 'group', label: '阶段', collapsed: false, x: 0, y: 0, w: 400, h: 300 },
    diagramType: 'flowchart', index: 0, onToggleGroup: () => {},
  })
  assert.ok(findElement(expanded, item => item.type === 'rect' && item.props.height === 300), 'expanded group renders its container')
})

test('flowchart Edge renders orthogonal paths, labels and dashed kinds', () => {
  const diagram = {
    key: 'flowchart', type: 'flowchart',
    nodes: [
      { id: 'a', type: 'process', label: 'A', x: 100, y: 100 },
      { id: 'b', type: 'process', label: 'B', x: 100, y: 300 },
    ],
    edges: [],
  }
  const flow = Edge({ diagram, edge: { id: 'e1', from: 'a', to: 'b', label: '通过', kind: 'flow' }, selected: false, onSelect: () => {} })
  const path = findElement(flow, item => item.type === 'path' && String(item.props.d).includes('L') && item.props.markerEnd !== undefined)
  assert.ok(path, 'flow edge uses a polyline path')
  assert.equal(path.props.strokeDasharray, undefined)
  assert.equal(path.props.markerEnd, 'url(#bp-arrow)')
  assert.match(elementText(flow), /通过/)

  const dashed = Edge({ diagram, edge: { id: 'e2', from: 'a', to: 'b', label: '否', kind: 'dashed' }, selected: false, onSelect: () => {} })
  assert.equal(findElement(dashed, item => item.type === 'path' && String(item.props.d).includes('L') && item.props.markerEnd !== undefined).props.strokeDasharray, '6 4')
})
