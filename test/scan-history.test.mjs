import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { apply as applyPlugin } from '../index.js'
import {
  SCAN_HISTORY_LIMIT,
  appendScanSnapshot,
  buildScanSnapshot,
  diffScanSnapshots,
  readScanHistory,
  scanHistoryRelative,
} from '../lib/scan-history.js'

function fakeScan(overrides = {}) {
  return {
    root: '/repo',
    metrics: {
      totals: {
        totalFiles: 10, totalBytes: 1000, sourceFiles: 6, sourceBytes: 700,
        testFiles: 2, testBytes: 100, docsFiles: 1, docsBytes: 50,
      },
      languages: [{ name: 'js', files: 8, bytes: 800, percent: 80 }],
      health: { score: 70, level: 'watch', reasons: ['coverage'] },
      packages: [
        { name: 'app', path: 'app', files: 8, bytes: 800, health: { score: 70, level: 'watch' } },
      ],
      insights: [
        { code: 'no-tests', severity: 'warn', message: 'No tests', subject: 'app', fix: 'Add tests' },
      ],
    },
    imports: { edges: 5, external: ['react'], unresolved: [] },
    ...overrides,
  }
}

test('buildScanSnapshot keeps only aggregate health data', () => {
  const snapshot = buildScanSnapshot(fakeScan(), 'baseline')
  assert.match(snapshot.id, /^scan-/u)
  assert.equal(snapshot.label, 'baseline')
  assert.equal(snapshot.totals.files, 10)
  assert.equal(snapshot.health.score, 70)
  assert.equal(snapshot.packages[0].name, 'app')
  assert.equal(snapshot.insights[0].code, 'no-tests')
  assert.equal(snapshot.imports.edges, 5)
  assert.ok(!JSON.stringify(snapshot).includes('process.env'))
})

test('snapshot health falls back to package scores', () => {
  const scan = fakeScan()
  delete scan.metrics.health
  const snapshot = buildScanSnapshot(scan)
  assert.equal(snapshot.health.score, 70)
  assert.equal(snapshot.health.level, 'watch')
})

test('appendScanSnapshot keeps the newest snapshots and reads them back', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-scan-history-'))
  try {
    let last
    for (let index = 0; index < SCAN_HISTORY_LIMIT + 3; index += 1) {
      last = await appendScanSnapshot(cwd, 'session-a', buildScanSnapshot(fakeScan(), `run-${index}`))
    }
    assert.equal(last.snapshots.length, SCAN_HISTORY_LIMIT)
    assert.equal(last.snapshots.at(-1).label, `run-${SCAN_HISTORY_LIMIT + 2}`)
    const history = await readScanHistory(cwd, 'session-a')
    assert.equal(history.snapshots.length, SCAN_HISTORY_LIMIT)
    assert.equal(history.path, scanHistoryRelative('session-a'))
    await fs.access(path.join(cwd, '.dsh', 'blueprints', 'session-a.scan-history.json'))
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('diffScanSnapshots reports deltas, package health and insight changes', () => {
  const before = buildScanSnapshot(fakeScan(), 'before')
  const afterScan = fakeScan()
  afterScan.metrics.totals.testFiles = 5
  afterScan.metrics.totals.docsFiles = 3
  afterScan.metrics.health.score = 84
  afterScan.metrics.packages[0].health.score = 84
  afterScan.metrics.insights = [
    { code: 'large-files', severity: 'warn', message: 'Big file', subject: 'app', fix: 'Split' },
  ]
  const after = buildScanSnapshot(afterScan, 'after')
  const diff = diffScanSnapshots(before, after)
  assert.equal(diff.delta.testFiles, 3)
  assert.equal(diff.delta.docsFiles, 2)
  assert.equal(diff.delta.healthScore, 14)
  assert.equal(diff.health.from, 70)
  assert.equal(diff.health.to, 84)
  assert.deepEqual(diff.resolvedInsights.map(item => item.code), ['no-tests'])
  assert.deepEqual(diff.newInsights.map(item => item.code), ['large-files'])
  assert.ok(diff.packageChanges.some(item => item.path === 'app' && item.change === 'health' && item.to === 84))
})

test('malformed history is tolerated and rewritten on append', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-scan-history-bad-'))
  try {
    const dir = path.join(cwd, '.dsh', 'blueprints')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'session-b.scan-history.json'), '{not json', 'utf8')
    const history = await readScanHistory(cwd, 'session-b')
    assert.deepEqual(history.snapshots, [])
    assert.ok(history.warning)
    const saved = await appendScanSnapshot(cwd, 'session-b', buildScanSnapshot(fakeScan(), 'recovered'))
    assert.equal(saved.snapshots.length, 1)
    const reread = await readScanHistory(cwd, 'session-b')
    assert.equal(reread.snapshots.length, 1)
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

function setupPlugin(cwd) {
  const tools = []
  const commands = []
  const disposers = []
  const toolService = { register(definition) { tools.push(definition); return () => {} } }
  const ctx = {
    tools: toolService,
    get(name) {
      if (name === 'tools') return toolService
      if (name === 'commands') return { register(command) { commands.push(command); return () => {} } }
      return undefined
    },
    effect(fn) {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
      return () => {}
    },
    logger: { warn() {} },
  }
  applyPlugin(ctx, { promptSection: false })
  const agent = { id: 'session-scan-history', session: { header: { cwd, id: 'session-scan-history' } } }
  return { commands, agent, dispose: () => { for (const dispose of disposers) dispose() } }
}

test('scan snapshot/history/diff commands work end to end', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-scan-cmd-'))
  const plugin = setupPlugin(cwd)
  try {
    await fs.writeFile(path.join(cwd, 'package.json'), JSON.stringify({ name: 'history-fixture', scripts: { test: 'node --test' } }), 'utf8')
    await fs.mkdir(path.join(cwd, 'src'), { recursive: true })
    await fs.writeFile(path.join(cwd, 'src', 'index.js'), 'export const value = 1\n', 'utf8')
    const first = await plugin.commands[0].handler({ rawInput: 'scan snapshot baseline', agent: plugin.agent })
    assert.equal(first.kind, 'success')
    const firstPayload = JSON.parse(first.text)
    assert.equal(firstPayload.ok, true)
    assert.equal(firstPayload.snapshot.label, 'baseline')
    await fs.writeFile(path.join(cwd, 'src', 'index.js'), 'export const value = 2\nexport const extra = 3\n', 'utf8')
    const second = await plugin.commands[0].handler({ rawInput: 'scan snapshot after', agent: plugin.agent })
    assert.equal(second.kind, 'success')
    const history = await plugin.commands[0].handler({ rawInput: 'scan history', agent: plugin.agent })
    assert.equal(history.kind, 'success')
    const historyPayload = JSON.parse(history.text)
    assert.equal(historyPayload.snapshots.length, 2)
    assert.deepEqual(historyPayload.snapshots.map(item => item.label), ['baseline', 'after'])
    const diff = await plugin.commands[0].handler({ rawInput: 'scan diff baseline after', agent: plugin.agent })
    assert.equal(diff.kind, 'success')
    const diffPayload = JSON.parse(diff.text)
    assert.equal(diffPayload.from.label, 'baseline')
    assert.equal(diffPayload.to.label, 'after')
    assert.ok(Number.isFinite(diffPayload.delta.bytes))
  } finally {
    plugin.dispose()
    await fs.rm(cwd, { recursive: true, force: true })
  }
})