// Lightweight scan snapshots for health trends.
//
// A snapshot intentionally stores only aggregate metrics and insights. It does
// not store file contents, environment variables or credentials.
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export const SCAN_HISTORY_VERSION = 1
export const SCAN_HISTORY_LIMIT = 20
const SAFE_SESSION = /^[A-Za-z0-9._-]+$/u

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function safeSession(sessionId) {
  const value = text(sessionId)
  return SAFE_SESSION.test(value) ? value : 'session'
}

export function scanHistoryRelative(sessionId) {
  return `.dsh/blueprints/${safeSession(sessionId)}.scan-history.json`
}

export function scanHistoryAbsolute(cwd, sessionId) {
  return path.resolve(String(cwd), scanHistoryRelative(sessionId))
}

export function buildScanSnapshot(scan, label = '') {
  const source = scan !== null && typeof scan === 'object' ? scan : {}
  const metrics = source.metrics !== null && typeof source.metrics === 'object' ? source.metrics : {}
  const totals = metrics.totals !== null && typeof metrics.totals === 'object' ? metrics.totals : {}
  const health = metrics.health !== null && typeof metrics.health === 'object' ? metrics.health : {}
  const imports = source.imports !== null && typeof source.imports === 'object' ? source.imports : {}
  const packages = Array.isArray(metrics.packages) ? metrics.packages : []
  const packageScores = packages.map(item => number(item?.health?.score)).filter(score => score > 0)
  const fallbackScore = packageScores.length === 0 ? 0 : Math.round(packageScores.reduce((sum, score) => sum + score, 0) / packageScores.length)
  const fallbackLevel = fallbackScore >= 80 ? 'good' : fallbackScore >= 60 ? 'watch' : 'risk'
  const at = Date.now()
  return {
    version: SCAN_HISTORY_VERSION,
    id: `scan-${at}-${randomUUID().slice(0, 8)}`,
    at,
    label: text(label).slice(0, 80),
    root: text(source.root),
    totals: {
      files: number(totals.totalFiles ?? totals.files),
      bytes: number(totals.totalBytes ?? totals.bytes),
      sourceFiles: number(totals.sourceFiles),
      sourceBytes: number(totals.sourceBytes),
      testFiles: number(totals.testFiles),
      testBytes: number(totals.testBytes),
      docsFiles: number(totals.docsFiles),
      docsBytes: number(totals.docsBytes),
    },
    languages: Array.isArray(metrics.languages)
      ? metrics.languages.slice(0, 20).map(item => ({
          name: text(item?.name), files: number(item?.files), bytes: number(item?.bytes), percent: number(item?.percent),
        }))
      : [],
    health: {
      score: number(health.score) || fallbackScore,
      level: text(health.level) || fallbackLevel,
      reasons: Array.isArray(health.reasons) ? health.reasons.map(reason => text(reason)).filter(Boolean).slice(0, 20) : [],
    },
    packages: packages.slice(0, 100).map(item => ({
      name: text(item?.name),
      path: text(item?.path),
      files: number(item?.files),
      bytes: number(item?.bytes),
      health: {
        score: number(item?.health?.score),
        level: text(item?.health?.level),
      },
    })),
    insights: Array.isArray(metrics.insights)
      ? metrics.insights.slice(0, 50).map(item => ({
          code: text(item?.code), severity: text(item?.severity), message: text(item?.message),
          subject: text(item?.subject), fix: text(item?.fix),
        }))
      : [],
    imports: {
      edges: number(imports.edges),
      external: Array.isArray(imports.external) ? imports.external.length : number(imports.external),
      unresolved: Array.isArray(imports.unresolved) ? imports.unresolved.length : number(imports.unresolved),
    },
  }
}

function normalizeSnapshot(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const id = text(value.id)
  if (id === '') return undefined
  return value
}

export async function readScanHistory(cwd, sessionId) {
  const file = scanHistoryAbsolute(cwd, sessionId)
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'))
    const snapshots = Array.isArray(parsed?.snapshots) ? parsed.snapshots.map(normalizeSnapshot).filter(Boolean) : []
    return { version: SCAN_HISTORY_VERSION, snapshots, path: scanHistoryRelative(sessionId) }
  } catch (error) {
    if (error?.code === 'ENOENT') return { version: SCAN_HISTORY_VERSION, snapshots: [], path: scanHistoryRelative(sessionId) }
    return {
      version: SCAN_HISTORY_VERSION,
      snapshots: [],
      path: scanHistoryRelative(sessionId),
      warning: `扫描历史无法读取：${String(error?.message ?? error)}`,
    }
  }
}

async function writeHistory(file, snapshots) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = path.join(path.dirname(file), `.tmp-${randomUUID()}.json`)
  await fs.writeFile(temp, `${JSON.stringify({ version: SCAN_HISTORY_VERSION, snapshots }, null, 2)}\n`, 'utf8')
  await fs.rename(temp, file)
}

export async function appendScanSnapshot(cwd, sessionId, snapshot, options = {}) {
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Math.floor(options.limit) : SCAN_HISTORY_LIMIT
  const history = await readScanHistory(cwd, sessionId)
  const snapshots = [...history.snapshots, snapshot].slice(-limit)
  await writeHistory(scanHistoryAbsolute(cwd, sessionId), snapshots)
  return { snapshot, snapshots, path: scanHistoryRelative(sessionId), limit }
}

function insightKey(insight) {
  return `${text(insight?.code)}|${text(insight?.subject)}|${text(insight?.message)}`
}

export function diffScanSnapshots(previous, next) {
  const before = previous !== null && typeof previous === 'object' ? previous : {}
  const after = next !== null && typeof next === 'object' ? next : {}
  const delta = (key, sub) => number(after?.[key]?.[sub]) - number(before?.[key]?.[sub])
  const beforeInsights = new Set((Array.isArray(before.insights) ? before.insights : []).map(insightKey))
  const afterInsights = new Set((Array.isArray(after.insights) ? after.insights : []).map(insightKey))
  const beforePackages = new Map((Array.isArray(before.packages) ? before.packages : []).map(item => [text(item?.path) || text(item?.name), item]))
  const afterPackages = new Map((Array.isArray(after.packages) ? after.packages : []).map(item => [text(item?.path) || text(item?.name), item]))
  const packageChanges = []
  for (const [key, item] of afterPackages) {
    const old = beforePackages.get(key)
    if (old === undefined) {
      packageChanges.push({ path: key, change: 'added', score: number(item?.health?.score) })
      continue
    }
    const oldScore = number(old?.health?.score)
    const newScore = number(item?.health?.score)
    if (oldScore !== newScore) packageChanges.push({ path: key, change: 'health', from: oldScore, to: newScore })
  }
  for (const key of beforePackages.keys()) {
    if (!afterPackages.has(key)) packageChanges.push({ path: key, change: 'removed' })
  }
  return {
    from: { id: text(before.id), at: number(before.at), label: text(before.label) },
    to: { id: text(after.id), at: number(after.at), label: text(after.label) },
    delta: {
      files: delta('totals', 'files'),
      bytes: delta('totals', 'bytes'),
      sourceFiles: delta('totals', 'sourceFiles'),
      testFiles: delta('totals', 'testFiles'),
      docsFiles: delta('totals', 'docsFiles'),
      healthScore: number(after?.health?.score) - number(before?.health?.score),
    },
    health: { from: number(before?.health?.score), to: number(after?.health?.score) },
    resolvedInsights: [...beforeInsights].filter(key => !afterInsights.has(key)).map(key => {
      const insight = before.insights.find(item => insightKey(item) === key)
      return { code: text(insight?.code), subject: text(insight?.subject), message: text(insight?.message) }
    }),
    newInsights: [...afterInsights].filter(key => !beforeInsights.has(key)).map(key => {
      const insight = after.insights.find(item => insightKey(item) === key)
      return { code: text(insight?.code), subject: text(insight?.subject), message: text(insight?.message) }
    }),
    packageChanges: packageChanges.sort((left, right) => left.path.localeCompare(right.path)),
  }
}
