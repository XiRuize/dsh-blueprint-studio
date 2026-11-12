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

function nodeBoxes(svg) {
  const pattern = /<g class="node [^"]*" data-node-id="([^"]*)" data-node-type="([^"]*)" data-node-x="([\d.]+)" data-node-y="([\d.]+)" data-node-w="([\d.]+)" data-node-h="([\d.]+)"/gu
  const boxes = []
  for (const match of svg.matchAll(pattern)) {
    boxes.push({
      id: match[1],
      type: match[2],
      x: Number(match[3]),
      y: Number(match[4]),
      w: Number(match[5]),
      h: Number(match[6]),
    })
  }
  return boxes
}

function edgeRoutes(svg) {
  const starts = [...svg.matchAll(/<g class="edge" data-edge="([^"]+)">/gu)]
  const routes = []
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index]
    const end = index + 1 < starts.length ? starts[index + 1].index : svg.length
    const body = svg.slice(start.index, end)
    const routing = /data-routing="([^"]+)"/u.exec(body)
    const path = /<path d="([^"]+)"/u.exec(body)
    routes.push({
      id: start[1],
      routing: routing?.[1] ?? '',
      points: path === null
        ? []
        : [...path[1].matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/gu)].map(match => [Number(match[1]), Number(match[2])]),
    })
  }
  return routes
}

function pointInside(box, x, y, pad = 0.5) {
  return x > box.x + pad && x < box.x + box.w - pad && y > box.y + pad && y < box.y + box.h - pad
}

function segmentCrossesBox(from, to, box) {
  const [x1, y1] = from
  const [x2, y2] = to
  if (Math.abs(y1 - y2) < 0.01) {
    if (y1 <= box.y + 0.5 || y1 >= box.y + box.h - 0.5) return false
    return Math.max(x1, x2) > box.x + 0.5 && Math.min(x1, x2) < box.x + box.w - 0.5
  }
  if (Math.abs(x1 - x2) < 0.01) {
    if (x1 <= box.x + 0.5 || x1 >= box.x + box.w - 0.5) return false
    return Math.max(y1, y2) > box.y + 0.5 && Math.min(y1, y2) < box.y + box.h - 0.5
  }
  return pointInside(box, (x1 + x2) / 2, (y1 + y2) / 2)
}

test('orthogonal edge routing never cuts through an unrelated node', () => {
  const diagram = {
    key: 'routing',
    type: 'module',
    title: '路由',
    nodes: [
      { id: 'a', type: 'module', label: 'A 起点' },
      { id: 'b', type: 'module', label: '中间障碍' },
      { id: 'd', type: 'module', label: 'D 终点' },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'd', label: '跨越' },
      { id: 'e2', from: 'a', to: 'b' },
      { id: 'e3', from: 'b', to: 'd' },
    ],
  }
  const svg = renderDiagramSvg(diagram)
  assertLegalSvg(svg, 'routing diagram')
  const boxes = nodeBoxes(svg)
  assert.equal(boxes.length, 3)
  const byId = new Map(boxes.map(box => [box.id, box]))
  const routes = edgeRoutes(svg)
  assert.equal(routes.length, 3)
  assert.match(svg, /data-routing="orthogonal"/u)

  const endpoints = { e1: ['a', 'd'], e2: ['a', 'b'], e3: ['b', 'd'] }
  for (const route of routes) {
    assert.equal(route.routing, 'orthogonal', `${route.id} uses an orthogonal route`)
    assert.ok(route.points.length >= 2, `${route.id} has a real path`)
    const exclude = new Set(endpoints[route.id])
    for (let index = 1; index < route.points.length; index += 1) {
      for (const box of boxes) {
        if (exclude.has(box.id)) continue
        assert.ok(
          !segmentCrossesBox(route.points[index - 1], route.points[index], box),
          `${route.id} segment ${index} must not cross ${box.id}`,
        )
      }
    }
  }
  // The direct a -> d edge cannot be a straight line through b; it must detour.
  assert.ok(edgeRoutes(svg).find(route => route.id === 'e1').points.length > 2)
  assert.equal(renderDiagramSvg(diagram), svg)
})

test('long labels wrap and clip to the measured node width', () => {
  const label = '这是一个非常长的节点标签用于验证自动换行和截断'.repeat(4)
  const svg = renderDiagramSvg({
    key: 'long-label',
    type: 'module',
    title: '长标签',
    nodes: [{ id: 'wide', type: 'module', label }],
    edges: [],
  })
  assertLegalSvg(svg, 'long label')
  const box = nodeBoxes(svg).find(entry => entry.id === 'wide')
  assert.ok(box.w <= 300, 'node width respects the cap')
  assert.ok(box.h > 46, 'wrapped label grows the node height')
  const start = svg.indexOf('data-node-id="wide"')
  const fragment = svg.slice(start, svg.indexOf('</g>', start))
  const lines = [...fragment.matchAll(/<text[^>]*>([^<]*)<\/text>/gu)].map(match => match[1])
  assert.ok(lines.length >= 2, 'the label is split across text lines')
  for (const line of lines) {
    assert.ok([...line].length <= 18, `wrapped line stays within the card: ${line}`)
  }
  assert.match(fragment, /…/u, 'overlong text is explicitly elided')
  assert.ok(!svg.includes(label), 'the raw unwrapped label is not emitted')
})

test('light, dark and adaptive themes produce different legal documents', () => {
  const light = renderDiagramSvg(FIXTURES.c4, { theme: 'light' })
  const dark = renderDiagramSvg(FIXTURES.c4, { theme: 'dark' })
  const adaptive = renderDiagramSvg(FIXTURES.c4)
  assertLegalSvg(light, 'light theme')
  assertLegalSvg(dark, 'dark theme')
  assertLegalSvg(adaptive, 'adaptive theme')
  assert.notEqual(light, dark)
  assert.match(light, /data-theme="light"/u)
  assert.match(dark, /data-theme="dark"/u)
  assert.match(dark, /#1c2029/u, 'dark theme carries a dark surface token')
  assert.doesNotMatch(dark, /prefers-color-scheme/u, 'an explicit theme is pinned')
  assert.match(adaptive, /@media \(prefers-color-scheme: dark\)/u, 'default follows the host scheme')
  assert.match(adaptive, /@media print\{/u, 'print always falls back to the light palette')
  assert.equal(renderDiagramSvg(FIXTURES.c4, { theme: 'dark' }), dark)
})

test('dense layouts keep node rectangles from overlapping', () => {
  const nodes = Array.from({ length: 12 }, (_, index) => ({
    id: `n${index}`,
    type: 'module',
    label: `${'模块'.repeat(index % 4 + 1)} ${index}`,
  }))
  const svg = renderDiagramSvg({ key: 'dense', type: 'module', nodes, edges: [] })
  assertLegalSvg(svg, 'dense diagram')
  const boxes = nodeBoxes(svg).filter(box => box.type !== 'group' && box.type !== 'note')
  assert.equal(boxes.length, nodes.length)
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const overlapX = Math.min(boxes[i].x + boxes[i].w, boxes[j].x + boxes[j].w) - Math.max(boxes[i].x, boxes[j].x)
      const overlapY = Math.min(boxes[i].y + boxes[i].h, boxes[j].y + boxes[j].h) - Math.max(boxes[i].y, boxes[j].y)
      assert.ok(overlapX <= 0 || overlapY <= 0, `nodes ${boxes[i].id} and ${boxes[j].id} overlap`)
    }
  }
  assert.equal(renderDiagramSvg({ key: 'dense', type: 'module', nodes, edges: [] }), svg)
})

test('sequence rows grow with wrapped messages', () => {
  const base = {
    key: 'sequence-spacing',
    type: 'sequence',
    title: '消息行距',
    nodes: [
      { id: 'client', type: 'participant', label: '客户端' },
      { id: 'server', type: 'participant', label: '服务端' },
    ],
  }
  const short = renderDiagramSvg({
    ...base,
    edges: [{ from: 'client', to: 'server', label: 'ok', order: 1 }],
  })
  const long = renderDiagramSvg({
    ...base,
    edges: [{
      from: 'client',
      to: 'server',
      label: '这是一条需要换行显示的非常长的时序消息标签'.repeat(2),
      order: 1,
    }],
  })
  const heightOf = value => Number(/viewBox="0 0 \d+ (\d+)"/u.exec(value)[1])
  assert.ok(heightOf(long) > heightOf(short), 'a wrapped message increases its row height')
  assertLegalSvg(long, 'long sequence message')
  assert.equal(renderDiagramSvg({
    ...base,
    edges: [{
      from: 'client',
      to: 'server',
      label: '这是一条需要换行显示的非常长的时序消息标签'.repeat(2),
      order: 1,
    }],
  }), long)
})

test('review HTML numbers figures, keeps order stable and flags oversized diagrams', () => {
  const bigNodes = Array.from({ length: 61 }, (_, index) => ({
    id: `big${index}`,
    type: 'module',
    label: `大图节点 ${index}`,
  }))
  const blueprint = {
    title: '图形评审',
    layers: [{ letter: 'A', title: '总览' }],
    sections: [],
    modules: [],
    diagrams: [
      {
        key: 'z-small',
        layerId: 'A',
        type: 'module',
        title: '小图',
        nodes: [
          { id: 's1', type: 'module', label: '小一' },
          { id: 's2', type: 'module', label: '小二' },
        ],
        edges: [{ from: 's1', to: 's2' }],
      },
      {
        key: 'a-large',
        layerId: 'A',
        type: 'module',
        title: '大图',
        nodes: bigNodes,
        edges: [],
      },
    ],
  }
  const html = exportReviewHtml(blueprint)
  assert.match(html, /<figure class="diagram diagram-large">/u)
  assert.match(html, /<p class="figure-index"><span class="badge">图 1\/2<\/span>/u)
  assert.match(html, /<span class="badge">图 2\/2<\/span>/u)
  assert.ok(html.indexOf('大图') < html.indexOf('小图'), 'diagrams keep the packet ordering')
  assert.match(html, /该图较大（61 个节点/u)
  assert.match(html, /@page \{ margin: 12mm; \}/u)
  assert.match(html, /\.diagram-large \{ break-inside: auto; \}/u)
  assert.match(html, /\.diagram-canvas \{ overflow: visible; border-color: #bbb; \}/u)
  assert.doesNotMatch(html, /<script/iu)
  assert.doesNotMatch(html, /<foreignObject/iu)
  assert.doesNotMatch(html, /<link\b|<img\b|\bsrc\s*=/iu)
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
