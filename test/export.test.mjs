import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeBlueprint } from '../lib/blueprint.js'
import {
  EXPORT_MAX_BYTES,
  ExportTooLargeError,
  exportHtml,
  exportMarkdown,
  layerPath,
  moduleCode,
} from '../lib/export.js'

const NOW = '2026-11-08T07:30:00.000Z'
const MALICIOUS_TITLE = '支付平台 </script><script>alert("title")</script> & "Beta"'

function fixture() {
  return normalizeBlueprint({
    title: MALICIOUS_TITLE,
    status: 'confirmed',
    layers: [
      { letter: 'A', title: '总览' },
      { letter: 'B', title: '认证', parentModuleId: 'api' },
    ],
    modules: [
      {
        id: 'api',
        name: 'API 网关',
        status: 'confirmed',
        acceptance: ['响应时间小于 100ms', '覆盖 | 管道'],
        dependsOn: ['auth'],
      },
      {
        id: 'auth',
        name: '认证模块',
        status: 'draft',
        layerId: 'B',
        acceptance: ['登录成功'],
        dependsOn: [],
      },
    ],
    sections: [
      {
        key: 'goals',
        items: [
          { id: 'g1', text: '完成 <登录>', moduleId: 'auth', code: 'R10' },
          { id: 'g2', text: '未归属目标' },
        ],
      },
      {
        key: 'functional',
        items: [{ id: 'f1', text: '调用 API', moduleId: 'api' }],
      },
    ],
    diagrams: [
      {
        layerId: 'A',
        type: 'usecase',
        nodes: [
          { id: 'u1', type: 'actor', label: '用户 <script>alert(1)</script>', x: 11, y: 22, w: 120, h: 60 },
          { id: 'u2', type: 'usecase', label: '登录', x: 300, y: 400 },
        ],
        edges: [{ id: 'e1', from: 'u1', to: 'u2', label: '发起 | 登录', kind: 'association' }],
      },
      {
        layerId: 'B',
        type: 'dfd',
        nodes: [
          { id: 'p1', type: 'process', label: '校验', x: 1, y: 2 },
          { id: 'p2', type: 'store', label: '会话', x: 3, y: 4 },
        ],
        edges: [{ id: 'be1', from: 'p1', to: 'p2', label: '写入', kind: 'data' }],
      },
      {
        layerId: 'B',
        type: 'er',
        nodes: [],
        edges: [],
      },
    ],
  }, undefined, { sessionId: 'export-test' })
}

test('layerPath and moduleCode resolve readable paths and legacy modules without code', () => {
  const blueprint = fixture()
  assert.equal(layerPath(blueprint, 'A'), 'A')
  assert.equal(layerPath(blueprint, 'B'), 'A / A1 / B')
  assert.equal(moduleCode(blueprint, blueprint.modules.find(module => module.id === 'api')), 'A1')
  assert.equal(moduleCode(blueprint, blueprint.modules.find(module => module.id === 'auth')), 'B1')

  const legacy = {
    layers: [
      { id: 'A', letter: 'A', title: '总览' },
      { id: 'B', letter: 'B', title: '子层', parentModuleId: 'root' },
    ],
    modules: [
      { id: 'root', name: 'Root', layerId: 'A' },
      { id: 'legacy-child', name: 'Legacy child', layerId: 'B' },
    ],
  }
  assert.equal(moduleCode(legacy, legacy.modules[1]), 'B1')
  assert.equal(moduleCode(legacy, legacy.modules[0]), 'A1')
})

test('current-layer Markdown only contains that layer and includes codes, diagrams and empty slots', () => {
  const markdown = exportMarkdown(fixture(), { layerId: 'B', now: NOW })
  assert.match(markdown, /^# 支付平台/m)
  assert.match(markdown, /- 范围：当前层 B · 认证/)
  assert.match(markdown, /- 导出时间：2026-11-08T07:30:00\.000Z/)
  assert.match(markdown, /## 当前层：B · 认证/)
  assert.match(markdown, /### 目标与价值/)
  assert.match(markdown, /### 功能需求/)
  assert.match(markdown, /（模块：B1）完成 <登录>/)
  assert.match(markdown, /B1 · 认证模块/)
  assert.match(markdown, /- 状态：draft/)
  assert.match(markdown, /- 验收标准：/)
  assert.match(markdown, /### 数据流图（dfd）/)
  assert.match(markdown, /```mermaid/)
  assert.match(markdown, /\| p1 \| 校验 \| process \|/)
  assert.match(markdown, /\| p1 \| p2 \| 写入 \| data \|/)
  assert.match(markdown, /### ER 图（er）/)
  assert.match(markdown, /\n空\n/)
  assert.doesNotMatch(markdown, /API 网关/)
  assert.doesNotMatch(markdown, /调用 API/)
  assert.doesNotMatch(markdown, /未归属目标/)
  assert.doesNotMatch(markdown, /层路径：/)
  assert.doesNotMatch(markdown, /\b(?:11|22|300|400|1|2|3|4)\b.*(?:x|y)/)
})

test('global Markdown recurses through layers with paths, parents, all content and no coordinates', () => {
  const markdown = exportMarkdown(fixture(), { global: true, now: NOW })
  assert.match(markdown, /- 范围：全局（全部层）/)
  assert.match(markdown, /## 层 A · 总览/)
  assert.match(markdown, /## 层 B · 认证/)
  assert.match(markdown, /- 层路径：A/)
  assert.match(markdown, /- 层路径：A \/ A1 \/ B/)
  assert.match(markdown, /- 父层：无（根层）/)
  assert.match(markdown, /- 父层：A · 总览（通过模块 A1 · API 网关）/)
  assert.match(markdown, /（模块：A1）调用 API/)
  assert.match(markdown, /（模块：未归属）未归属目标/)
  assert.match(markdown, /A1 · API 网关/)
  assert.match(markdown, /- 依赖：B1 · 认证模块/)
  assert.match(markdown, /B1 · 认证模块/)
  assert.match(markdown, /用例图（usecase）/)
  for (const title of ['数据流图（dfd）', '模块图（module）', '时序图（sequence）', 'ER 图（er）', 'C4 图（c4）', '类图（class）', '状态图（state）']) {
    assert.ok(markdown.includes(title), `missing ${title}`)
  }
  assert.match(markdown, /\| u1 \| 用户 <script>alert\(1\)<\/script> \| actor \|/)
  assert.match(markdown, /\| u1 \| u2 \| 发起 \\?\| 登录 \| association \|/)
  assert.doesNotMatch(markdown, /\b(?:x|y|w|h):\s*\d/)
  assert.doesNotMatch(markdown, /\b11\b.*\b22\b/)
})

test('includeDescendants extends the selected layer without becoming global', () => {
  const markdown = exportMarkdown(fixture(), { layerId: 'A', includeDescendants: true, now: NOW })
  assert.match(markdown, /- 范围：当前层及子层 A · 总览/)
  assert.match(markdown, /## 层 A · 总览/)
  assert.match(markdown, /## 层 B · 认证/)
  assert.match(markdown, /API 网关/)
  assert.match(markdown, /认证模块/)
  assert.doesNotMatch(markdown, /- 范围：全局/)
})

test('HTML is a single self-contained document with TOC, layer navigation and search', () => {
  const html = exportHtml(fixture(), { global: true, now: NOW })
  assert.match(html, /^<!DOCTYPE html>/)
  assert.match(html, /<html lang="zh-CN">/)
  assert.match(html, /<title>.*蓝图导出<\/title>/)
  assert.match(html, /id="toc"/)
  assert.match(html, /class="[^"]*toc/)
  assert.match(html, /id="layer-nav"/)
  assert.match(html, /class="[^"]*layer-nav/)
  assert.match(html, /href="#layer-A"/)
  assert.match(html, /href="#layer-B"/)
  assert.match(html, /id="layer-A"/)
  assert.match(html, /id="layer-B"/)
  assert.match(html, /id="search"/)
  assert.match(html, /addEventListener\('input'/)
  assert.match(html, /id="requirements"/)
  assert.match(html, /id="modules"/)
  assert.match(html, /id="diagrams"/)
  assert.match(html, /层路径：<code>A \/ A1 \/ B<\/code>/)
  assert.match(html, /父层：A · 总览（通过模块 A1 · API 网关）/)
  assert.match(html, /class="data-table requirement-table"/)
  assert.match(html, /class="data-table module-table"/)
  assert.match(html, /class="data-table node-table"/)
  assert.match(html, /class="data-table edge-table"/)
  assert.match(html, /<p class="empty">空<\/p>/)
  assert.doesNotMatch(html, /<script[^>]+src=/i)
  assert.doesNotMatch(html, /<link\b/i)
  assert.doesNotMatch(html, /@import/i)
  assert.doesNotMatch(html, /https?:\/\//i)
})

test('HTML escapes user text and JSON, including </script> inside the inline payload', () => {
  const html = exportHtml(fixture(), { global: true, now: NOW })
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(html, /支付平台 &lt;\/script&gt;&lt;script&gt;alert\(&quot;title&quot;\)&lt;\/script&gt; &amp; &quot;Beta&quot;/)
  assert.match(html, /\\u003c\/script\\u003e/)
  assert.doesNotMatch(html, /<script>alert\(1\)/)
  assert.doesNotMatch(html, /<\/script><script>alert/)
  assert.doesNotMatch(html, /用户 <script>/)
})

test('current-scope HTML omits other layers and global-only relation metadata', () => {
  const html = exportHtml(fixture(), { layerId: 'B', now: NOW })
  assert.match(html, /范围：当前层 B · 认证/)
  assert.match(html, /id="layer-B"/)
  assert.match(html, /认证模块/)
  assert.doesNotMatch(html, /href="#layer-A"/)
  assert.doesNotMatch(html, /API 网关/)
  assert.doesNotMatch(html, /调用 API/)
  assert.doesNotMatch(html, /未归属目标/)
  assert.doesNotMatch(html, /层路径：/)
  assert.doesNotMatch(html, /父层：/)
})

test('rejects HTML exports larger than 5MB with a readable typed error', () => {
  const blueprint = normalizeBlueprint({
    title: 'X'.repeat(EXPORT_MAX_BYTES + 1),
  }, undefined, { sessionId: 'huge' })
  assert.throws(
    () => exportHtml(blueprint, { global: true, now: NOW }),
    error => {
      assert.ok(error instanceof ExportTooLargeError)
      assert.equal(error.code, 'export-too-large')
      assert.ok(error.size > EXPORT_MAX_BYTES)
      assert.equal(error.limit, EXPORT_MAX_BYTES)
      assert.match(error.message, /5MB/)
      assert.match(error.message, /缩小导出范围/)
      return true
    },
  )
})
