// Blueprint Studio v0.13 project-level review.
//
// Cross-blueprint aggregation for every session blueprint stored in
// `<cwd>/.dsh/blueprints`. Reading and projection are read-only: nothing in this
// module writes, archives or sends a request. A malformed file degrades into an
// entry in `errors` instead of failing the whole project review; only an HTML
// page above the shared 5MB cap throws.

import fs from 'node:fs/promises'
import path from 'node:path'
import { normalizeBlueprint } from './blueprint.js'
import {
  REVIEW_MAX_BYTES,
  ReviewTooLargeError,
  buildReviewPacket,
} from './review.js'

// Re-export the shared cap so callers can document the project page limit with
// the same constant the single-blueprint review page uses.
export const PROJECT_REVIEW_MAX_BYTES = REVIEW_MAX_BYTES

export const PROJECT_GAP_CODES = Object.freeze([
  'project-mount-root-conflict',
  'project-module-code-duplicate',
  'project-mount-unbound',
  'project-run-failed',
  'project-run-blocked',
])

const BLUEPRINT_DIR = path.posix.join('.dsh', 'blueprints')
const SEVERITY_RANK = Object.freeze({ error: 0, warn: 1, info: 2 })

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function text(value, fallback = '') {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function trimmed(value, fallback = '') {
  return text(value).trim() || fallback
}

function finite(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringList(value) {
  const seen = new Set()
  const result = []
  for (const entry of list(value)) {
    const item = trimmed(entry)
    if (item === '' || seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  return result
}

function compareNatural(left, right) {
  const a = text(left)
  const b = text(right)
  if (a === b) return 0
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }) || (a < b ? -1 : 1)
}

function errorEntry(file, code, message) {
  return { file, code, message: trimmed(message, '未知错误') }
}

function blueprintFileName(name) {
  return path.posix.join(BLUEPRINT_DIR, name)
}

// A mount root is compared as a normalized, case-insensitive, slash-only string:
// the same directory declared as `src`, `./src/` or `SRC` is one conflict.
function normalizeMountRoot(root) {
  return trimmed(root)
    .replace(/\\/gu, '/')
    .replace(/\/+/gu, '/')
    .replace(/^\.\//u, '')
    .replace(/\/+$/u, '')
    .toLowerCase()
}

// Read only the top-level `*.json` files of `<cwd>/.dsh/blueprints`. Version
// archives live in `*.versions/` directories and are ignored; so are temp files,
// non-JSON files and every nested directory.
export async function readProjectBlueprints(cwd) {
  const root = path.resolve(trimmed(cwd, '.') || '.')
  const dir = path.join(root, '.dsh', 'blueprints')
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      return { blueprints: [], errors: [] }
    }
    return {
      blueprints: [],
      errors: [errorEntry(BLUEPRINT_DIR, 'project-read-failed', `读取蓝图目录失败：${error?.message ?? error}`)],
    }
  }

  const files = entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(name => name.endsWith('.json')
      && !name.endsWith('.versions')
      && !name.endsWith('.tmp'))
    .sort(compareNatural)

  const blueprints = []
  const errors = []
  for (const name of files) {
    const absolute = path.join(dir, name)
    const relative = blueprintFileName(name)
    const sessionId = name.slice(0, -'.json'.length)
    let raw
    try {
      raw = JSON.parse(await fs.readFile(absolute, 'utf8'))
    } catch (error) {
      errors.push(errorEntry(
        relative,
        error instanceof SyntaxError ? 'invalid-json' : 'project-read-failed',
        error instanceof SyntaxError ? `无法解析 JSON：${error.message}` : `读取蓝图失败：${error?.message ?? error}`,
      ))
      continue
    }
    if (object(raw) === undefined) {
      errors.push(errorEntry(relative, 'invalid-blueprint', '蓝图文件顶层必须是 JSON 对象。'))
      continue
    }
    let bp
    try {
      bp = normalizeBlueprint(raw, undefined, { sessionId })
    } catch (error) {
      errors.push(errorEntry(relative, 'invalid-blueprint', `蓝图数据无法规范化：${error?.message ?? error}`))
      continue
    }
    let updatedAt = finite(raw.updatedAt, undefined)
    if (updatedAt === undefined) {
      try {
        updatedAt = (await fs.stat(absolute)).mtimeMs
      } catch {
        updatedAt = 0
      }
    }
    blueprints.push({
      sessionId,
      file: relative,
      title: bp.title,
      status: bp.status,
      updatedAt,
      bp,
    })
  }

  blueprints.sort((left, right) => compareNatural(left.sessionId, right.sessionId))
  errors.sort((left, right) => compareNatural(left.file, right.file) || compareNatural(left.message, right.message))
  return { blueprints, errors }
}

function projectSources(project) {
  if (Array.isArray(project)) return { blueprints: project, errors: [] }
  const source = object(project) ?? {}
  return { blueprints: list(source.blueprints), errors: list(source.errors) }
}

function usableEntries(blueprints) {
  return blueprints.filter(entry => object(entry) !== undefined
    && (object(entry.bp) !== undefined || object(entry.blueprint) !== undefined))
}

function packetFor(entry) {
  const bp = object(entry?.bp) ?? object(entry?.blueprint)
  if (bp !== undefined) return buildReviewPacket(bp)
  return buildReviewPacket({})
}

function crossMountRootConflicts(reviews) {
  const byRoot = new Map()
  for (const review of reviews) {
    for (const mount of review.packet.mounts) {
      const root = normalizeMountRoot(mount.root)
      if (root === '') continue
      const bucket = byRoot.get(root) ?? []
      bucket.push({ sessionId: review.sessionId, mountId: mount.id, access: mount.access })
      byRoot.set(root, bucket)
    }
  }
  const gaps = []
  for (const [root, entries] of byRoot) {
    const sessionIds = [...new Set(entries.map(entry => entry.sessionId))].sort(compareNatural)
    if (sessionIds.length < 2) continue
    const mountIds = [...new Set(entries.map(entry => entry.mountId))].sort(compareNatural)
    const severity = entries.some(entry => entry.access !== 'ro') ? 'error' : 'warn'
    gaps.push({
      code: 'project-mount-root-conflict',
      severity,
      message: `蓝图 ${sessionIds.join('、')} 都声明了挂载根 ${root}（${mountIds.join('、')}），同一工作目录会被并行争用。`,
      root,
      mountIds,
      sessionIds,
    })
  }
  return gaps
}

function crossModuleCodeDuplicates(reviews) {
  const byCode = new Map()
  for (const review of reviews) {
    for (const module of review.packet.modules) {
      const code = trimmed(module.code)
      if (code === '') continue
      const key = code.toUpperCase()
      const bucket = byCode.get(key) ?? []
      bucket.push({ sessionId: review.sessionId, moduleCode: code, moduleId: module.id })
      byCode.set(key, bucket)
    }
  }
  const gaps = []
  for (const entries of byCode.values()) {
    const sessionIds = [...new Set(entries.map(entry => entry.sessionId))].sort(compareNatural)
    if (sessionIds.length < 2) continue
    const code = entries[0].moduleCode
    gaps.push({
      code: 'project-module-code-duplicate',
      severity: 'warn',
      message: `模块 code ${code} 同时出现在蓝图 ${sessionIds.join('、')}，跨蓝图引用时无法区分。`,
      moduleCode: code,
      sessionIds,
    })
  }
  return gaps
}

function crossUnboundMounts(reviews) {
  const gaps = []
  for (const review of reviews) {
    for (const mount of review.packet.mounts) {
      if (mount.boundModules.length > 0) continue
      gaps.push({
        code: 'project-mount-unbound',
        severity: 'warn',
        message: `蓝图 ${review.sessionId} 的挂载 ${mount.id}（${mount.root || '未设置 root'}）没有绑定任何模块。`,
        sessionId: review.sessionId,
        mountId: mount.id,
        root: mount.root,
      })
    }
  }
  return gaps
}

function crossFailedRuns(reviews) {
  const gaps = []
  for (const review of reviews) {
    for (const run of review.packet.runs) {
      const status = trimmed(run.status).toLowerCase()
      if (status !== 'failed' && status !== 'blocked') continue
      gaps.push({
        code: status === 'failed' ? 'project-run-failed' : 'project-run-blocked',
        severity: status === 'failed' ? 'error' : 'warn',
        message: status === 'failed'
          ? `蓝图 ${review.sessionId} 的运行 ${run.id}（模块 ${run.moduleCode || '未知'}）失败${run.error ? `：${run.error}` : '。'}`
          : `蓝图 ${review.sessionId} 的运行 ${run.id}（模块 ${run.moduleCode || '未知'}）处于阻塞状态。`,
        sessionId: review.sessionId,
        runId: run.id,
        moduleCode: run.moduleCode,
        status,
      })
    }
  }
  return gaps
}

function crossGapKey(gap) {
  return [
    gap.code,
    gap.sessionId ?? '',
    ...(gap.sessionIds ?? []),
    gap.moduleCode ?? '',
    gap.mountId ?? '',
    gap.root ?? '',
    gap.runId ?? '',
    gap.status ?? '',
    gap.message,
  ].join('\u0000')
}

function sortAndDedupeCrossGaps(gaps) {
  gaps.sort((left, right) =>
    (SEVERITY_RANK[left.severity] ?? 9) - (SEVERITY_RANK[right.severity] ?? 9)
    || compareNatural(left.code, right.code)
    || compareNatural((left.sessionIds ?? [left.sessionId ?? '']).join(','), (right.sessionIds ?? [right.sessionId ?? '']).join(','))
    || compareNatural(left.moduleCode ?? '', right.moduleCode ?? '')
    || compareNatural(left.mountId ?? '', right.mountId ?? '')
    || compareNatural(left.root ?? '', right.root ?? '')
    || compareNatural(left.runId ?? '', right.runId ?? '')
    || compareNatural(left.message, right.message))
  const seen = new Set()
  const result = []
  for (const gap of gaps) {
    const key = crossGapKey(gap)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(gap)
  }
  return result
}

function timestampOf(entry) {
  return finite(entry?.updatedAt, finite(entry?.bp?.updatedAt))
}

// Aggregate a project read into one review packet. Stable ordering and no clock
// reads: two calls on the same input produce deeply equal results, and an empty
// or malformed project never throws.
export function buildProjectReview(project) {
  const { blueprints, errors } = projectSources(project)
  const reviews = usableEntries(blueprints).map(entry => ({
    sessionId: trimmed(entry?.sessionId, 'session'),
    file: trimmed(entry?.file),
    updatedAt: timestampOf(entry),
    packet: packetFor(entry),
  }))

  const perBlueprint = reviews.map(review => {
    const summary = review.packet.summary
    const activeRuns = review.packet.runs
      .filter(run => trimmed(run.status).toLowerCase() === 'running')
      .map(run => ({
        id: run.id,
        moduleCode: run.moduleCode,
        nextAction: run.nextAction,
      }))
    return {
      sessionId: review.sessionId,
      file: review.file,
      title: review.packet.title,
      status: review.packet.status,
      updatedAt: review.updatedAt,
      counts: {
        layers: summary.layers,
        requirements: summary.requirements,
        modules: summary.modules,
        mounts: summary.mounts,
        diagrams: summary.diagrams,
        runs: summary.runs,
        activeRuns: summary.activeRuns,
        gaps: summary.openGaps,
      },
      activeRuns,
      gaps: review.packet.gaps,
      nextActions: review.packet.nextActions,
    }
  })

  const crossGaps = sortAndDedupeCrossGaps([
    ...crossMountRootConflicts(reviews),
    ...crossModuleCodeDuplicates(reviews),
    ...crossUnboundMounts(reviews),
    ...crossFailedRuns(reviews),
  ])

  const totals = {
    blueprints: perBlueprint.length,
    requirements: perBlueprint.reduce((sum, entry) => sum + entry.counts.requirements, 0),
    modules: perBlueprint.reduce((sum, entry) => sum + entry.counts.modules, 0),
    mounts: perBlueprint.reduce((sum, entry) => sum + entry.counts.mounts, 0),
    runs: perBlueprint.reduce((sum, entry) => sum + entry.counts.runs, 0),
    activeRuns: perBlueprint.reduce((sum, entry) => sum + entry.counts.activeRuns, 0),
    gaps: perBlueprint.reduce((sum, entry) => sum + entry.counts.gaps, 0) + crossGaps.length,
  }

  const cleanErrors = errors
    .map(entry => errorEntry(
      trimmed(entry?.file),
      trimmed(entry?.code, 'project-error'),
      entry?.message,
    ))
    .filter(entry => entry.file !== '' || entry.message !== '')

  return { totals, perBlueprint, crossGaps, errors: cleanErrors }
}

// ---------------------------------------------------------------------------
// Offline project review page. One file, no scripts, no CDN, no font or image
// URL: everything is escaped markup and inline CSS.
// ---------------------------------------------------------------------------

const ESCAPES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})

function escapeHtml(value) {
  return text(value).replace(/[&<>"']/gu, character => ESCAPES[character])
}

function formatTimestamp(value) {
  if (!Number.isFinite(value) || value <= 0) return '未记录'
  try {
    return new Date(value).toISOString()
  } catch {
    return String(value)
  }
}

function statusClass(value) {
  return text(value).replace(/[^a-z0-9_-]/giu, '').toLowerCase() || 'unknown'
}

function statCard(label, value) {
  return `<div class="stat"><span class="stat-value">${escapeHtml(value)}</span><span class="stat-label">${escapeHtml(label)}</span></div>`
}

function gapsTable(gaps, emptyText) {
  const rows = ['<table class="data"><thead><tr><th>Severity</th><th>Code</th><th>Message</th><th>引用</th></tr></thead><tbody>']
  if (gaps.length === 0) {
    rows.push(`<tr class="empty"><td colspan="4">${escapeHtml(emptyText)}</td></tr>`)
  } else {
    for (const gap of gaps) {
      const refs = [
        ...(gap.sessionIds ?? []),
        gap.sessionId,
        gap.moduleCode,
        gap.mountId,
        gap.root,
        gap.runId,
      ].filter(value => value !== undefined && value !== '')
      rows.push('<tr>')
      rows.push(`<td><span class="severity severity-${escapeHtml(statusClass(gap.severity))}">${escapeHtml(gap.severity)}</span></td>`)
      rows.push(`<td class="code">${escapeHtml(gap.code)}</td>`)
      rows.push(`<td>${escapeHtml(gap.message)}</td>`)
      rows.push(`<td class="code">${escapeHtml([...new Set(refs)].join(' · '))}</td>`)
      rows.push('</tr>')
    }
  }
  rows.push('</tbody></table>')
  return rows.join('\n')
}

function errorsTable(errors) {
  if (errors.length === 0) return '<p class="empty">（无读取错误）</p>'
  const rows = ['<table class="data"><thead><tr><th>文件</th><th>Code</th><th>错误</th></tr></thead><tbody>']
  for (const error of errors) {
    rows.push(`<tr><td class="code">${escapeHtml(error.file || '—')}</td><td class="code">${escapeHtml(error.code)}</td><td>${escapeHtml(error.message)}</td></tr>`)
  }
  rows.push('</tbody></table>')
  return rows.join('\n')
}

function nextActionsHtml(actions) {
  if (actions.length === 0) return '<p class="empty">（无待办）</p>'
  const items = actions.map(action => {
    const refs = [action.runId, action.moduleCode].filter(value => value !== undefined && value !== '')
    const prefix = refs.length === 0 ? '' : `<span class="code">${escapeHtml(refs.join(' / '))}</span> `
    return `<li>${prefix}${escapeHtml(action.text)}</li>`
  })
  return `<ol class="actions">\n${items.join('\n')}\n</ol>`
}

function blueprintCard(entry, index) {
  const counts = entry.counts
  const rows = []
  rows.push(`<section class="card blueprint" id="blueprint-${index + 1}">`)
  rows.push(`<h2><span class="index">${index + 1}.</span> ${escapeHtml(entry.title)} <span class="status status-${escapeHtml(statusClass(entry.status))}">${escapeHtml(entry.status)}</span></h2>`)
  rows.push(`<p class="meta"><span class="code">${escapeHtml(entry.sessionId)}</span> <span>${escapeHtml(entry.file || '—')}</span> <span>更新时间：${escapeHtml(formatTimestamp(entry.updatedAt))}</span></p>`)
  rows.push('<div class="stats">')
  rows.push(statCard('需求', counts.requirements))
  rows.push(statCard('模块', counts.modules))
  rows.push(statCard('挂载', counts.mounts))
  rows.push(statCard('图解', counts.diagrams))
  rows.push(statCard('运行', counts.runs))
  rows.push(statCard('进行中', counts.activeRuns))
  rows.push(statCard('缺口', counts.gaps))
  rows.push('</div>')
  rows.push('<h3>评审缺口</h3>')
  rows.push(gapsTable(entry.gaps, '（无评审缺口）'))
  rows.push('<h3>下一步</h3>')
  rows.push(nextActionsHtml(entry.nextActions))
  rows.push('</section>')
  return rows.join('\n')
}

const PROJECT_REVIEW_STYLE = `
:root {
  color-scheme: light dark;
  --bg: #f6f7fb;
  --surface: #ffffff;
  --ink: #1f2430;
  --muted: #5f6878;
  --line: #dde2ec;
  --accent: #2f55d4;
  --code: #f0f2f7;
  --error: #b3261e;
  --warn: #8a5a00;
  --info: #31558a;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 24px;
  background: var(--bg);
  color: var(--ink);
  font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}
main { max-width: 1180px; margin: 0 auto; }
h1 { margin: 0 0 8px; font-size: 26px; line-height: 1.25; overflow-wrap: anywhere; }
h2 { margin: 0 0 10px; font-size: 19px; overflow-wrap: anywhere; }
h3 { margin: 20px 0 8px; font-size: 15px; }
p { margin: 6px 0; }
header.review-header {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 22px;
  margin-bottom: 20px;
}
.eyebrow { margin: 0 0 6px; color: var(--muted); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
.meta { display: flex; flex-wrap: wrap; gap: 6px 18px; color: var(--muted); font-size: 13px; margin: 8px 0; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(105px, 1fr)); gap: 10px; margin: 14px 0 0; }
.stat { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; }
.stat-value { font-size: 21px; font-weight: 700; }
.stat-label { color: var(--muted); font-size: 12px; }
section.card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px; margin: 16px 0; overflow-x: auto; }
section.blueprint h2 { border-bottom: 2px solid var(--accent); padding-bottom: 6px; }
.index { color: var(--muted); }
table.data { width: 100%; border-collapse: collapse; font-size: 13px; }
table.data th, table.data td { border-bottom: 1px solid var(--line); padding: 7px 8px; text-align: left; vertical-align: top; }
table.data th { background: var(--code); font-weight: 600; white-space: nowrap; }
tr.empty td { color: var(--muted); text-align: center; }
.code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; overflow-wrap: anywhere; }
.muted { color: var(--muted); }
.empty { color: var(--muted); }
.status, .severity { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 12px; background: var(--code); font-weight: 400; vertical-align: middle; }
.status-done { color: #1b6b3a; }
.status-needs-rework, .severity-error { color: var(--error); }
.status-running, .status-blocked { color: var(--accent); }
.severity-warn { color: var(--warn); }
.severity-info { color: var(--info); }
ol.actions { padding-left: 22px; }
ol.actions li { margin: 4px 0; }
footer { max-width: 1180px; margin: 28px auto 0; color: var(--muted); font-size: 12px; text-align: center; }
@media (max-width: 760px) {
  body { padding: 12px; }
  header.review-header, section.card { padding: 14px; }
  h1 { font-size: 21px; }
  table.data { font-size: 12px; }
}
@media print {
  :root { color-scheme: light; --bg: #ffffff; --surface: #ffffff; }
  body { padding: 0; background: #ffffff; }
  section.card, header.review-header { break-inside: avoid-page; border-color: #bbb; }
  table.data th { background: #eee; }
  h2 { break-after: avoid-page; }
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14171d;
    --surface: #1c2029;
    --ink: #e6e9f0;
    --muted: #9aa4b5;
    --line: #303746;
    --accent: #7f9cff;
    --code: #232936;
    --error: #ff8f86;
    --warn: #f0c070;
    --info: #9db9e8;
  }
}
`

// Build the single-file offline project review page. A page above the shared
// 5MB cap throws ReviewTooLargeError so the command layer can report a readable
// error instead of returning a truncated document.
export function exportProjectReviewHtml(project) {
  const review = buildProjectReview(project)
  const title = `项目级蓝图评审 · ${review.totals.blueprints} 个蓝图`
  const blueprintCards = review.perBlueprint.length === 0
    ? '<section class="card"><p class="empty">（项目内没有可评审的蓝图）</p></section>'
    : review.perBlueprint.map(blueprintCard).join('\n')
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Blueprint Studio project review">
<title>${escapeHtml(title)}</title>
<style>${PROJECT_REVIEW_STYLE}</style>
</head>
<body>
<main>
<header class="review-header">
<p class="eyebrow">Blueprint Studio · Project Review</p>
<h1>项目级蓝图评审</h1>
<div class="meta">
<span>蓝图：${escapeHtml(review.totals.blueprints)}</span>
<span>读取错误：${escapeHtml(review.errors.length)}</span>
<span>项目级缺口：${escapeHtml(review.crossGaps.length)}</span>
</div>
<div class="stats">
${statCard('蓝图', review.totals.blueprints)}
${statCard('需求', review.totals.requirements)}
${statCard('模块', review.totals.modules)}
${statCard('挂载', review.totals.mounts)}
${statCard('运行', review.totals.runs)}
${statCard('进行中', review.totals.activeRuns)}
${statCard('评审缺口', review.totals.gaps)}
</div>
</header>

<section class="card" id="project-gaps">
<h2>项目级缺口</h2>
${gapsTable(review.crossGaps, '（无项目级缺口）')}
</section>

<section class="card" id="errors">
<h2>读取错误</h2>
${errorsTable(review.errors)}
</section>

<h2 id="blueprints">蓝图（${escapeHtml(review.perBlueprint.length)}）</h2>
${blueprintCards}
</main>
<footer>由 Blueprint Studio 离线生成 · 单文件，无外部依赖</footer>
</body>
</html>
`
  const size = new TextEncoder().encode(html).byteLength
  if (size > PROJECT_REVIEW_MAX_BYTES) throw new ReviewTooLargeError(size, PROJECT_REVIEW_MAX_BYTES)
  return html
}
