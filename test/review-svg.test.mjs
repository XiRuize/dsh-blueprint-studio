import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeBlueprint } from '../lib/blueprint.js'
import { exportReviewHtml } from '../lib/review.js'
import { renderDiagramSvg, SVG_MAX_NODES } from '../lib/svg.js'

// One representative diagram per supported kind. Labels are intentionally
// mixed CJK/ASCII so the tests cover wrapping, measurement and escaping.
const FIXTURES = {
  usecase: {
    key: 'usecase',
    type: 'usecase',
    title: '登录用例',
    nodes: [
      { id: 'visitor', type: 'actor', label: '访客' },
      { id: 'login', type: 'usecase', label: '登录系统' },
      { id: 'boundary', type: 'system', label: '认证域' },
    ],
    edges: [{ from: 'visitor', to: 'login', label: '发起登录' }],
  },
  dfd: {
    key: 'dfd',
    type: 'dfd',
    title: '数据流',
    nodes: [
      { id: 'user', type: 'entity', label: '用户' },
      { id: 'verify', type: 'process', label: '校验凭据' },
      { id: 'store', type: 'store', label: '会话表 D1' },
    ],
    edges: [
      { from: 'user', to: 'verify', label: '凭据' },
      { from: 'verify', to: 'store', label: '写入会话' },
    ],
  },
  module: {
    key: 'module',
    type: 'module',
    title: '模块依赖',
    nodes: [
      { id: 'web', type: 'module', label: 'Web 模块' },
      { id: 'idp', type: 'external', label: '外部 IdP' },
    ],
    edges: [{ from: 'web', to: 'idp', kind: 'depends', label: 'OIDC' }],
  },
  sequence: {
    key: 'sequence',
    type: 'sequence',
    title: '登录时序',
    nodes: [
      { id: 'client', type: 'participant', label: '客户端' },
      { id: 'server', type: 'participant', label: '服务端' },
    ],
    edges: [
      { from: 'client', to: 'server', label: '提交凭据', order: 1 },
      { from: 'server', to: 'client', label: '返回令牌', kind: 'return', order: 2 },
    ],
  },
  er: {
    key: 'er',
    type: 'er',
    title: '实体关系',
    nodes: [
      {
        id: 'account',
        type: 'entity',
        label: '账户',
        fields: [
          { name: 'id', type: 'uuid', key: true },
          { name: 'email', type: 'text' },
        ],
      },
      { id: 'session', type: 'entity', label: '会话', fields: [{ name: 'token', type: 'text' }] },
      { id: 'owns', type: 'relationship', label: '拥有' },
    ],
    edges: [
      { from: 'account', to: 'owns', cardinality: '1..*' },
      { from: 'owns', to: 'session', cardinality: '1' },
    ],
  },
  c4: {
    key: 'c4',
    type: 'c4',
    title: 'C4 容器',
    nodes: [
      { id: 'person', type: 'person', label: '运维人员' },
      { id: 'app', type: 'container', label: 'Blueprint Studio', technology: 'Node.js' },
      { id: 'db', type: 'database', label: '蓝图库' },
    ],
    edges: [
      { from: 'person', to: 'app', label: '使用' },
      { from: 'app', to: 'db', label: '读写' },
    ],
  },
  class: {
    key: 'class',
    type: 'class',
    title: '类结构',
    nodes: [
      {
        id: 'user',
        type: 'class',
        label: 'User',
        fields: [
          { name: 'id', type: 'string', key: true },
          { name: 'save', type: 'void', kind: 'method' },
        ],
      },
      { id: 'repo', type: 'interface', label: 'UserRepo' },
    ],
    edges: [{ from: 'user', to: 'repo', kind: 'depends' }],
  },
  state: {
    key: 'state',
    type: 'state',
    title: '状态流转',
    nodes: [
      { id: 'start', type: 'initial', label: '开始' },
      { id: 'idle', type: 'state', label: '空闲' },
      { id: 'done', type: 'final', label: '结束' },
    ],
    edges: [
      { from: 'start', to: 'idle' },
      { from: 'idle', to: 'done', label: '完成' },
    ],
  },
  flowchart: {
    key: 'flowchart',
    type: 'flowchart',
    title: '实施计划',
    nodes: [
      { id: 'begin', type: 'start', label: '开始' },
      { id: 'phase', type: 'group', label: '阶段一' },
      { id: 'build', type: 'process', label: '实现', parentGroup: 'phase' },
      { id: 'gate', type: 'decision', label: '通过?', parentGroup: 'phase' },
      { id: 'end', type: 'end', label: '交付' },
      { id: 'memo', type: 'note', label: '回滚说明' },
    ],
    edges: [
      { from: 'begin', to: 'build' },
      { from: 'build', to: 'gate' },
      { from: 'gate', to: 'end', label: 'yes' },
    ],
  },
}

function assertLegalSvg(svg, label) {
  assert.match(svg, /^<svg /u, `${label} starts with an svg element`)
  assert.match(svg, /<\/svg>$/u, `${label} ends with an svg close tag`)
  assert.match(svg, /viewBox="0 0 \d+ \d+"/u, `${label} has an adaptive viewBox`)
  assert.match(svg, /role="img"/u, `${label} is exposed as an image`)
  assert.doesNotMatch(svg, /<script/iu, `${label} has no script`)
  assert.doesNotMatch(svg, /<foreignObject/iu, `${label} has no foreignObject`)
  assert.doesNotMatch(svg, /https?:\/\//iu, `${label} has no external URL`)
  assert.doesNotMatch(svg, /(?:href|src)\s*=/iu, `${label} has no href/src attribute`)
}

test('all nine diagram kinds render legal, deterministic inline SVG', () => {
  for (const [type, diagram] of Object.entries(FIXTURES)) {
    const svg = renderDiagramSvg(diagram)
    assertLegalSvg(svg, type)
    assert.equal(renderDiagramSvg(diagram), svg, `${type} is deterministic`)
    assert.match(svg, /class="diagram-svg"/u, `${type} carries the svg marker class`)

    const expected = {
      usecase: '登录系统',
      dfd: '校验凭据',
      module: 'Web 模块',
      sequence: '提交凭据',
      er: '账户',
      c4: 'Blueprint Studio',
      class: 'User',
      state: '空闲',
      flowchart: '实现',
    }[type]
    assert.ok(svg.includes(expected), `${type} keeps its key label: ${expected}`)
  }
})

test('special shapes: decisions, groups, notes, sequence messages, ER fields', () => {
  const flow = renderDiagramSvg(FIXTURES.flowchart)
  assert.match(flow, /<polygon points="[^"]*"/u, 'decision is a diamond polygon')
  assert.match(flow, /stroke-dasharray="7 5"/u, 'group is a dashed container')
  assert.match(flow, /阶段一/u)
  assert.match(flow, /回滚说明/u)
  assert.match(flow, /marker-end="url\(#svg-arrow-flowchart-/u, 'flow arrows use a diagram-scoped marker')

  const sequence = renderDiagramSvg(FIXTURES.sequence)
  assert.match(sequence, /stroke-dasharray="5 5"/u, 'participants have lifelines')
  assert.ok(sequence.indexOf('提交凭据') < sequence.indexOf('返回令牌'), 'messages follow order')
  assert.match(sequence, /class="sequence-message" data-order="1"/u)
  assert.match(sequence, /marker-end="url\(#svg-arrow-sequence-/u)

  const er = renderDiagramSvg(FIXTURES.er)
  assert.match(er, /id/u)
  assert.match(er, /uuid/u)
  assert.match(er, /1\.\.\*/u)
  assert.match(er, /账户/u)

  const klass = renderDiagramSvg(FIXTURES.class)
  assert.match(klass, /save\(\)/u, 'methods are rendered in their own section')

  const state = renderDiagramSvg(FIXTURES.state)
  assert.match(state, /<circle /u, 'initial/final states use circles')

  const usecase = renderDiagramSvg(FIXTURES.usecase)
  assert.match(usecase, /<ellipse /u, 'usecase is an ellipse')
  assert.match(usecase, /<circle /u, 'actor has a stick-figure head')
})

test('labels and attributes are escaped, never executable', () => {
  const svg = renderDiagramSvg({
    key: 'x"><script>alert(1)</script>',
    type: 'module',
    title: '</script><script>alert("title")</script> & Beta',
    nodes: [
      {
        id: 'n"><script>',
        type: 'module',
        label: '</script><script>alert("node")</script> & <foreignObject>',
      },
    ],
    edges: [],
  })
  assertLegalSvg(svg, 'injected module')
  assert.match(svg, /&lt;\/script&gt;/u)
  assert.match(svg, /&amp;/u)
  assert.doesNotMatch(svg, /<script/iu)
  assert.doesNotMatch(svg, /foreignObject/iu)
  assert.match(svg, /data-diagram="x&quot;&gt;&lt;script&gt;/u)
})

test('empty and malformed diagrams degrade to an empty state', () => {
  for (const input of [null, undefined, {}, { key: 'x', type: 'module' }, { key: 'x', type: 'bogus', nodes: [] }]) {
    const svg = renderDiagramSvg(input)
    assertLegalSvg(svg, 'empty diagram')
    assert.match(svg, /（空图）|不支持的图解类型/u)
    assert.match(svg, /<text /u)
  }
})

test('node count is capped deterministically', () => {
  const nodes = Array.from({ length: SVG_MAX_NODES + 25 }, (_, index) => ({
    id: `n${index}`,
    type: 'module',
    label: `模块 ${index}`,
  }))
  const svg = renderDiagramSvg({ key: 'module', type: 'module', nodes, edges: [] })
  assertLegalSvg(svg, 'capped diagram')
  assert.match(svg, /已省略 25 个节点（上限 300）/u)
  assert.equal(renderDiagramSvg({ key: 'module', type: 'module', nodes, edges: [] }), svg)
})

test('review HTML embeds inline SVG and keeps Mermaid source as a closed detail', () => {
  const blueprint = normalizeBlueprint({
    title: '评审 SVG',
    layers: [{ letter: 'A', title: '总览' }],
    diagrams: [
      {
        key: 'usecase',
        layerId: 'A',
        type: 'usecase',
        title: '登录用例',
        nodes: [
          { id: 'actor', type: 'actor', label: '访客' },
          { id: 'login', type: 'usecase', label: '登录' },
        ],
        edges: [{ from: 'actor', to: 'login', label: '发起' }],
      },
    ],
  }, undefined, { sessionId: 'review-svg-session' })

  const html = exportReviewHtml(blueprint)
  assert.match(html, /^<!DOCTYPE html>/u)
  assert.match(html, /<figure class="diagram">/u)
  assert.match(html, /<svg viewBox="0 0 \d+ \d+"/u)
  assert.match(html, /<figcaption>/u)
  assert.match(html, /<details class="mermaid-source">/u)
  assert.match(html, /<summary>Mermaid 源码（可选）<\/summary>/u)
  assert.match(html, /<pre class="mermaid-source"><code>/u)
  assert.ok(html.indexOf('<svg') < html.indexOf('<pre class="mermaid-source">'), 'SVG comes before the source detail')

  assert.doesNotMatch(html, /<script/iu)
  assert.doesNotMatch(html, /<foreignObject/iu)
  assert.doesNotMatch(html, /<link\b|<img\b|\bsrc\s*=/iu)
  assert.doesNotMatch(html, /https?:\/\//iu)
  assert.doesNotMatch(html, /<iframe\b|<object\b|<embed\b/iu)
})
