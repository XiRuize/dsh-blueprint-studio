import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'
import { mermaidFor, normalizeBlueprint } from '../lib/blueprint.js'

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
const { parseMermaid, flowchartMermaidSource } = client.__test
const parse = input => JSON.parse(JSON.stringify(parseMermaid(input)))

function expectFailure(run, code) {
  assert.throws(run, failure => failure?.code === code)
}

function labelsById(parsed) {
  return new Map(parsed.nodes.map(node => [node.id, node.label]))
}

test('maps rectangles, diamonds and stadiums with start/end inference', () => {
  const parsed = parse(`flowchart LR
  A([开始]) --> B[打开页面]
  B --> C{是否已登录?}
  C --> D[进入首页]
  D --> E([完成])
  C -.->|失败| F([结束])
`)
  assert.equal(parsed.kind, 'flowchart')
  assert.equal(parsed.diagramKey, 'flowchart')
  const byLabel = new Map(parsed.nodes.map(node => [node.label, node]))
  assert.equal(byLabel.get('开始').type, 'start')
  assert.equal(byLabel.get('打开页面').type, 'process')
  assert.equal(byLabel.get('是否已登录?').type, 'decision')
  assert.equal(byLabel.get('是否已登录?').condition, '是否已登录?')
  assert.equal(byLabel.get('进入首页').type, 'process')
  assert.equal(byLabel.get('完成').type, 'end')
  assert.equal(byLabel.get('结束').type, 'end')
  const names = labelsById(parsed)
  assert.deepEqual(parsed.edges.map(edge => ({
    from: names.get(edge.from),
    to: names.get(edge.to),
    label: edge.label,
    kind: edge.kind,
  })), [
    { from: '开始', to: '打开页面', label: undefined, kind: 'flow' },
    { from: '打开页面', to: '是否已登录?', label: undefined, kind: 'flow' },
    { from: '是否已登录?', to: '进入首页', label: undefined, kind: 'flow' },
    { from: '进入首页', to: '完成', label: undefined, kind: 'flow' },
    { from: '是否已登录?', to: '结束', label: '失败', kind: 'dashed' },
  ])
})

test('maps solid, plain and dashed edges and keeps every label', () => {
  const parsed = parse(`flowchart TD
  A[One] --> B[Two]
  B --- C[Three]
  C -.-> D[Four]
  D -.->|retry| E[Five]
  E -- done --> F[Six]
  F -->|"with spaces"| G[Seven]
`)
  const names = labelsById(parsed)
  assert.deepEqual(parsed.edges.map(edge => ({
    from: names.get(edge.from),
    to: names.get(edge.to),
    label: edge.label,
    kind: edge.kind,
  })), [
    { from: 'One', to: 'Two', label: undefined, kind: 'flow' },
    { from: 'Two', to: 'Three', label: undefined, kind: 'flow' },
    { from: 'Three', to: 'Four', label: undefined, kind: 'dashed' },
    { from: 'Four', to: 'Five', label: 'retry', kind: 'dashed' },
    { from: 'Five', to: 'Six', label: 'done', kind: 'flow' },
    { from: 'Six', to: 'Seven', label: 'with spaces', kind: 'flow' },
  ])
})

test('creates a group node and parentGroup for each one-level subgraph', () => {
  const parsed = parse(`flowchart TD
  subgraph 前端[前端阶段]
    A[页面] --> B[路由]
  end
  subgraph backend[Backend stage]
    C[API]
  end
  B --> C
  D[验收]
`)
  const groups = parsed.nodes.filter(node => node.type === 'group')
  assert.deepEqual(groups.map(node => node.label).sort(), ['Backend stage', '前端阶段'])
  const front = groups.find(node => node.label === '前端阶段')
  const back = groups.find(node => node.label === 'Backend stage')
  const byLabel = new Map(parsed.nodes.map(node => [node.label, node]))
  assert.equal(byLabel.get('页面').parentGroup, front.id)
  assert.equal(byLabel.get('路由').parentGroup, front.id)
  assert.equal(byLabel.get('API').parentGroup, back.id)
  assert.equal(byLabel.get('验收').parentGroup, undefined)
  assert.equal(parsed.edges.length, 2)
})

test('rejects a second nested subgraph level and unclosed subgraphs', () => {
  expectFailure(() => parse(`flowchart TD
  subgraph outer[Outer]
    A[One]
    subgraph inner[Inner]
      B[Two]
    end
  end
`), 'nested-subgraph')
  expectFailure(() => parse(`flowchart TD
  subgraph outer[Outer]
    A[One]
`), 'unclosed-subgraph')
})

test('rejects unsupported Mermaid shapes with a readable error', () => {
  for (const shape of ['A{{Hexagon}}', 'A[(Cylinder)]', 'A[[Subroutine]]', 'A((Circle))', 'A[/Parallelogram/]']) {
    assert.throws(
      () => parseMermaid(`flowchart TD\n  ${shape}`),
      failure => failure?.code === 'unsupported-shape' && typeof failure.detail === 'string' && failure.detail !== '',
      shape,
    )
  }
})

test('keeps quoted, escaped and bracketed labels on import', () => {
  const parsed = parse(String.raw`flowchart TD
  A["带 \"引号\" 和 [括号] 的标签"] --> B["另一个 (标签)"]
`)
  assert.deepEqual(parsed.nodes.map(node => node.label).sort(), ['另一个 (标签)', '带 "引号" 和 [括号] 的标签'])
})

test('exports a flowchart TD with subgraphs, stadiums, diamonds, labels and dashes', () => {
  const blueprint = normalizeBlueprint({
    diagrams: [{
      type: 'flowchart',
      nodes: [
        { id: 'start', type: 'start', label: '开始' },
        { id: 'open', type: 'process', label: '打开 "页面" [入口]', parentGroup: 'delivery' },
        { id: 'check', type: 'decision', label: '是否通过?', condition: '所有测试通过', parentGroup: 'delivery' },
        { id: 'delivery', type: 'group', label: '交付阶段' },
        { id: 'note1', type: 'note', label: '发布前冻结变更' },
        { id: 'end', type: 'end', label: '完成' },
      ],
      edges: [
        { from: 'start', to: 'open', label: '开工' },
        { from: 'open', to: 'check', kind: 'dashed', label: '提交' },
        { from: 'check', to: 'end', label: '通过' },
      ],
    }],
  }, undefined, { sessionId: 's' })

  const exported = mermaidFor(blueprint, 'flowchart')
  assert.match(exported, /^flowchart TD/m)
  assert.match(exported, /subgraph delivery\["交付阶段"\]/)
  assert.match(exported, /start\(\["开始"\]\)/)
  assert.match(exported, /check\{"是否通过\?"\}/)
  assert.match(exported, /% note 发布前冻结变更/)
  assert.match(exported, /#34;页面#34; #91;入口#93;/)
  assert.match(exported, /-.->\|提交\|/)
  assert.match(exported, /-->\|开工\|/)
})

test('round-trips an exported flowchart back into the plan flowchart', () => {
  const blueprint = normalizeBlueprint({
    diagrams: [{
      type: 'flowchart',
      nodes: [
        { id: 'start', type: 'start', label: '开始' },
        { id: 'build', type: 'process', label: '实现 "接口" [v1]', parentGroup: 'delivery' },
        { id: 'check', type: 'decision', label: '验收通过?', condition: '全部测试通过', parentGroup: 'delivery' },
        { id: 'delivery', type: 'group', label: '交付阶段' },
        { id: 'end', type: 'end', label: '结束' },
      ],
      edges: [
        { from: 'start', to: 'build', label: '开工' },
        { from: 'build', to: 'check', kind: 'dashed', label: '提交' },
        { from: 'check', to: 'end', label: '通过' },
      ],
    }],
  }, undefined, { sessionId: 's' })

  const parsed = parse(mermaidFor(blueprint, 'flowchart'))
  assert.equal(parsed.diagramKey, 'flowchart')
  const byLabel = new Map(parsed.nodes.map(node => [node.label, node]))
  assert.equal(byLabel.get('开始').type, 'start')
  assert.equal(byLabel.get('实现 "接口" [v1]').type, 'process')
  assert.equal(byLabel.get('验收通过?').type, 'decision')
  assert.equal(byLabel.get('结束').type, 'end')
  const group = parsed.nodes.find(node => node.type === 'group')
  assert.equal(group.label, '交付阶段')
  assert.equal(byLabel.get('实现 "接口" [v1]').parentGroup, group.id)
  assert.equal(byLabel.get('验收通过?').parentGroup, group.id)
  const names = labelsById(parsed)
  assert.deepEqual(parsed.edges.map(edge => ({
    from: names.get(edge.from),
    to: names.get(edge.to),
    label: edge.label,
    kind: edge.kind,
  })), [
    { from: '开始', to: '实现 "接口" [v1]', label: '开工', kind: 'flow' },
    { from: '实现 "接口" [v1]', to: '验收通过?', label: '提交', kind: 'dashed' },
    { from: '验收通过?', to: '结束', label: '通过', kind: 'flow' },
  ])
})

test('client export helper produces the same flowchart source for the current diagram', () => {
  const diagram = {
    key: 'flowchart',
    type: 'flowchart',
    nodes: [
      { id: 'start', type: 'start', label: '开始' },
      { id: 'check', type: 'decision', label: '继续?', condition: '还有步骤' },
      { id: 'end', type: 'end', label: '完成' },
    ],
    edges: [{ from: 'start', to: 'check' }, { from: 'check', to: 'end', kind: 'dashed', label: '否' }],
  }
  const exported = flowchartMermaidSource(diagram)
  assert.match(exported, /^flowchart TD/)
  assert.match(exported, /start\(\["开始"\]\)/)
  assert.match(exported, /check\{"继续\?"\}/)
  assert.match(exported, /end\(\["完成"\]\)/)
  assert.match(exported, /-.->\|否\|/)
})

test('a flowchart no longer imports into the legacy usecase diagram', () => {
  const legacy = normalizeBlueprint({
    diagrams: [{ key: 'usecase', nodes: [{ id: 'u1', type: 'actor', label: '用户' }], edges: [] }],
  }, undefined, { sessionId: 's' })
  assert.equal(legacy.diagrams.some(diagram => diagram.key === 'flowchart'), false)

  const parsed = parse('flowchart TD\n A[步骤] --> B([完成])')
  assert.equal(parsed.diagramKey, 'flowchart')
  assert.notEqual(parsed.diagramKey, 'usecase')
  assert.deepEqual(parsed.nodes.map(node => node.type).sort(), ['end', 'process'])

  const merged = normalizeBlueprint({
    layers: [{ letter: 'A' }],
    diagrams: [{ layerId: 'A', type: 'flowchart', nodes: parsed.nodes, edges: parsed.edges }],
  }, undefined, { sessionId: 's' })
  const saved = merged.diagrams.find(diagram => diagram.key === 'flowchart')
  assert.equal(saved.type, 'flowchart')
  assert.deepEqual(saved.nodes.map(node => node.type).sort(), ['end', 'process'])
})
