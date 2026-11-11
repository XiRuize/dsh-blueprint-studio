import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  blueprintAbsolutePath,
  normalizeBlueprint,
  readBlueprintFile,
  writeBlueprintFile,
} from '../lib/blueprint.js'
import {
  PROJECT_GAP_CODES,
  PROJECT_REVIEW_MAX_BYTES,
  buildProjectReview,
  exportProjectReviewHtml,
  readProjectBlueprints,
} from '../lib/project-review.js'
import { ReviewTooLargeError } from '../lib/review.js'
import { apply } from '../index.js'

const MALICIOUS_TITLE = '项目评审 </script><script>alert("title")</script> & "Beta"'

function normalize(input, sessionId = 'bp-a') {
  return normalizeBlueprint(input, undefined, { sessionId })
}

async function seed(cwd, sessionId, input, raw) {
  const file = blueprintAbsolutePath(cwd, sessionId)
  await fs.mkdir(path.dirname(file), { recursive: true })
  if (raw !== undefined) {
    await fs.writeFile(file, raw, 'utf8')
    return file
  }
  await writeBlueprintFile(file, normalize(input, sessionId))
  return file
}

async function makeProject() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-project-review-'))
  await seed(cwd, 'bp-alpha', {
    title: 'Alpha',
    status: 'confirmed',
    mounts: [
      { id: 'main', label: 'Main', root: 'src' },
      { id: 'loose', label: 'Loose', root: 'loose' },
    ],
    modules: [
      { id: 'api', name: 'API', mountIds: ['main'], acceptance: ['ok'], execution: { adapter: 'cli' } },
      { id: 'unused', name: 'Unused', mountIds: [] },
    ],
    sections: [{ key: 'goals', items: [{ id: 'g1', text: '目标', moduleId: 'api' }] }],
    runs: [
      { id: 'run-fail', moduleId: 'api', mountIds: ['main'], adapter: 'cli', status: 'failed', startedAt: 1, evidence: [], error: 'tests failed' },
      { id: 'run-block', moduleId: 'api', mountIds: ['main'], adapter: 'http', status: 'blocked', startedAt: 2, evidence: [] },
    ],
  })
  await seed(cwd, 'bp-beta', {
    title: 'Beta',
    mounts: [{ id: 'main', label: 'Main', root: './SRC/' }],
    modules: [{ id: 'api', name: 'API', mountIds: ['main'], acceptance: ['ok'], execution: { adapter: 'cli' } }],
    runs: [
      { id: 'run-live', moduleId: 'api', mountIds: ['main'], adapter: 'cli', status: 'running', startedAt: 3, leaseUntil: Date.now() + 60_000, evidence: [] },
    ],
  })
  return cwd
}

test('readProjectBlueprints reads top-level JSON only and isolates broken files', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-project-read-'))
  try {
    await seed(cwd, 'bp-a', { title: 'A', status: 'confirmed' })
    await seed(cwd, 'bp-b', { title: 'B' })
    await seed(cwd, 'broken', {}, '{ this is not json')
    await seed(cwd, 'array', {}, '[]')
    const dir = path.join(cwd, '.dsh', 'blueprints')
    await fs.writeFile(path.join(dir, 'notes.txt'), 'ignore me', 'utf8')
    await fs.mkdir(path.join(dir, 'bp-a.versions'), { recursive: true })
    await fs.writeFile(path.join(dir, 'bp-a.versions', 'v1.json'), '{}', 'utf8')
    await fs.mkdir(path.join(dir, 'bp-a.runs'), { recursive: true })
    await fs.writeFile(path.join(dir, 'bp-a.runs', 'run.json'), '{}', 'utf8')

    const project = await readProjectBlueprints(cwd)
    assert.deepEqual(project.blueprints.map(entry => entry.sessionId), ['bp-a', 'bp-b'])
    assert.deepEqual(project.blueprints.map(entry => entry.file), [
      '.dsh/blueprints/bp-a.json',
      '.dsh/blueprints/bp-b.json',
    ])
    for (const entry of project.blueprints) {
      assert.equal(typeof entry.title, 'string')
      assert.equal(typeof entry.status, 'string')
      assert.ok(Number.isFinite(entry.updatedAt))
      assert.equal(entry.bp.version, 2)
    }
    assert.equal(project.blueprints[0].title, 'A')
    assert.equal(project.blueprints[0].status, 'confirmed')
    assert.deepEqual(project.errors.map(entry => entry.file), [
      '.dsh/blueprints/array.json',
      '.dsh/blueprints/broken.json',
    ])
    assert.equal(project.errors[0].code, 'invalid-blueprint')
    assert.equal(project.errors[1].code, 'invalid-json')
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('readProjectBlueprints returns an empty project when the directory is missing', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-project-empty-'))
  try {
    const project = await readProjectBlueprints(cwd)
    assert.deepEqual(project, { blueprints: [], errors: [] })
    assert.doesNotThrow(() => buildProjectReview(project))
    assert.doesNotThrow(() => exportProjectReviewHtml(project))
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('buildProjectReview aggregates totals, per-blueprint counts and actions', async () => {
  const cwd = await makeProject()
  try {
    const project = await readProjectBlueprints(cwd)
    const review = buildProjectReview(project)

    assert.equal(review.totals.blueprints, 2)
    assert.equal(review.totals.requirements, 1)
    assert.equal(review.totals.modules, 3)
    assert.equal(review.totals.mounts, 3)
    assert.equal(review.totals.runs, 3)
    assert.equal(review.totals.activeRuns, 1)
    assert.ok(review.totals.gaps >= review.crossGaps.length)

    assert.deepEqual(review.perBlueprint.map(entry => entry.sessionId), ['bp-alpha', 'bp-beta'])
    const alpha = review.perBlueprint[0]
    assert.equal(alpha.title, 'Alpha')
    assert.equal(alpha.status, 'confirmed')
    assert.deepEqual(alpha.counts, {
      layers: 1,
      requirements: 1,
      modules: 2,
      mounts: 2,
      diagrams: 8,
      runs: 2,
      activeRuns: 0,
      gaps: alpha.counts.gaps,
    })
    assert.deepEqual(alpha.activeRuns, [])
    assert.ok(alpha.nextActions.length > 0)
    assert.ok(alpha.gaps.length >= 0)

    const beta = review.perBlueprint[1]
    assert.deepEqual(beta.activeRuns.map(run => run.id), ['run-live'])
    assert.equal(beta.counts.activeRuns, 1)
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('buildProjectReview reports mount conflicts, duplicate codes, unbound mounts and failed runs', async () => {
  const cwd = await makeProject()
  try {
    const project = await readProjectBlueprints(cwd)
    const review = buildProjectReview(project)
    const codes = review.crossGaps.map(gap => gap.code)

    assert.ok(codes.includes('project-mount-root-conflict'))
    assert.ok(codes.includes('project-module-code-duplicate'))
    assert.ok(codes.includes('project-mount-unbound'))
    assert.ok(codes.includes('project-run-failed'))
    assert.ok(codes.includes('project-run-blocked'))
    assert.equal(codes.every(code => PROJECT_GAP_CODES.includes(code)), true)

    const conflict = review.crossGaps.find(gap => gap.code === 'project-mount-root-conflict')
    assert.equal(conflict.severity, 'error')
    assert.equal(conflict.root, 'src')
    assert.deepEqual(conflict.sessionIds, ['bp-alpha', 'bp-beta'])
    assert.deepEqual(conflict.mountIds, ['main'])

    const duplicate = review.crossGaps.find(gap => gap.code === 'project-module-code-duplicate')
    assert.equal(duplicate.severity, 'warn')
    assert.equal(duplicate.moduleCode, 'A1')
    assert.deepEqual(duplicate.sessionIds, ['bp-alpha', 'bp-beta'])

    const unbound = review.crossGaps.find(gap => gap.code === 'project-mount-unbound')
    assert.equal(unbound.sessionId, 'bp-alpha')
    assert.equal(unbound.mountId, 'loose')

    assert.deepEqual(
      review.crossGaps.filter(gap => gap.code.startsWith('project-run-')).map(gap => gap.status),
      ['failed', 'blocked'],
    )
    assert.equal(review.totals.gaps, review.perBlueprint.reduce((sum, entry) => sum + entry.counts.gaps, 0) + review.crossGaps.length)

    // Stable ordering and deduplication: the same project aggregates identically.
    const again = buildProjectReview(project)
    assert.deepEqual(again, review)
    assert.equal(new Set(review.crossGaps.map(gap => `${gap.code}:${gap.message}`)).size, review.crossGaps.length)
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('buildProjectReview tolerates empty, missing and malformed project input', () => {
  for (const input of [undefined, null, {}, { blueprints: [null, {}] }, []]) {
    const review = buildProjectReview(input)
    assert.deepEqual(review.totals, {
      blueprints: 0,
      requirements: 0,
      modules: 0,
      mounts: 0,
      runs: 0,
      activeRuns: 0,
      gaps: 0,
    })
    assert.deepEqual(review.perBlueprint, [])
    assert.deepEqual(review.crossGaps, [])
    assert.deepEqual(review.errors, [])
  }
})

test('project review HTML is a single offline document with escaping, cards and print CSS', async () => {
  const cwd = await makeProject()
  try {
    await seed(cwd, 'bp-malicious', {
      title: MALICIOUS_TITLE,
      modules: [{ id: 'api', name: '模块 <script>alert(2)</script> & 边界', mountIds: [] }],
    })
    await seed(cwd, 'broken', {}, '{ nope')
    const project = await readProjectBlueprints(cwd)
    const html = exportProjectReviewHtml(project)

    assert.match(html, /^<!DOCTYPE html>/)
    assert.match(html, /<html lang="zh-CN">/)
    assert.match(html, /<meta name="viewport"/)
    assert.match(html, /id="project-gaps"/)
    assert.match(html, /id="errors"/)
    assert.match(html, /id="blueprints"/)
    assert.match(html, /class="stat"/)
    assert.match(html, /class="card blueprint"/)
    assert.match(html, /@media print/)
    assert.match(html, /项目级缺口/)
    assert.match(html, /bp-alpha/)
    assert.match(html, /broken\.json/)
    assert.match(html, /项目评审 &lt;\/script&gt;&lt;script&gt;alert\(&quot;title&quot;\)&lt;\/script&gt; &amp; &quot;Beta&quot;/)
    assert.match(html, /模块 &lt;script&gt;alert\(2\)&lt;\/script&gt; &amp; 边界/)

    assert.doesNotMatch(html, /<script/i)
    assert.doesNotMatch(html, /<link\b/i)
    assert.doesNotMatch(html, /<img\b/i)
    assert.doesNotMatch(html, /https?:\/\//i)
    assert.doesNotMatch(html, /\bsrc=/i)
    assert.doesNotMatch(html, /@import/i)
    assert.doesNotMatch(html, /<script>alert/)
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('project review HTML rejects pages above the shared 5MB cap', () => {
  const project = {
    blueprints: [{ sessionId: 'big', file: '.dsh/blueprints/big.json', updatedAt: 0, bp: normalize({ title: 'X'.repeat(PROJECT_REVIEW_MAX_BYTES + 1) }, 'big') }],
    errors: [],
  }
  assert.throws(
    () => exportProjectReviewHtml(project),
    error => {
      assert.ok(error instanceof ReviewTooLargeError)
      assert.equal(error.name, 'ReviewTooLargeError')
      assert.equal(error.code, 'review-too-large')
      assert.ok(error.size > PROJECT_REVIEW_MAX_BYTES)
      assert.equal(error.limit, PROJECT_REVIEW_MAX_BYTES)
      assert.match(error.message, /5MB/u)
      return true
    },
  )
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
      if (name === 'commands') {
        return { register(command) { commands.push(command); return () => {} } }
      }
      return undefined
    },
    effect(fn) {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
      return () => {}
    },
    logger: { warn() {} },
  }
  apply(ctx, { promptSection: false })
  const agent = { id: 'session-project', session: { header: { cwd, id: 'session-project' } } }
  return { tools, commands, agent, dispose: () => { for (const dispose of disposers) dispose() } }
}

test('/blueprint review project and review project html are read-only end-to-end', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-project-command-'))
  try {
    const plugin = setupPlugin(cwd)
    const handler = plugin.commands[0].handler
    const hint = plugin.commands[0].input.hint
    assert.match(hint, /review project \[html\]/u)

    const currentFile = await seed(cwd, 'session-project', {
      title: 'Current session',
      modules: [{ id: 'api', name: 'API', acceptance: ['ok'] }],
    })
    await seed(cwd, 'session-other', {
      title: 'Other session',
      mounts: [{ id: 'main', root: 'src' }],
      modules: [{ id: 'api', name: 'API', mountIds: ['main'], acceptance: ['ok'] }],
    })
    await seed(cwd, 'broken', {}, '{ bad json')

    const before = await readBlueprintFile(currentFile)
    const otherBefore = await readBlueprintFile(blueprintAbsolutePath(cwd, 'session-other'))

    const projectResult = await handler({ rawInput: 'review project', agent: plugin.agent })
    assert.equal(projectResult.kind, 'success')
    const review = JSON.parse(projectResult.text)
    assert.equal(review.totals.blueprints, 2)
    assert.deepEqual(review.perBlueprint.map(entry => entry.sessionId), ['session-other', 'session-project'])
    assert.equal(review.errors.length, 1)
    assert.equal(review.errors[0].file, '.dsh/blueprints/broken.json')

    const htmlResult = await handler({ rawInput: 'review project html', agent: plugin.agent })
    assert.equal(htmlResult.kind, 'success')
    assert.match(htmlResult.text, /^<!DOCTYPE html>/)
    assert.match(htmlResult.text, /id="project-gaps"/)
    assert.match(htmlResult.text, /Other session/)
    assert.doesNotMatch(htmlResult.text, /<script/i)

    // read-only: JSON stays byte-identical and no version archive appears.
    assert.deepEqual(await readBlueprintFile(currentFile), before)
    assert.deepEqual(await readBlueprintFile(blueprintAbsolutePath(cwd, 'session-other')), otherBefore)
    await assert.rejects(
      fs.access(path.join(cwd, '.dsh', 'blueprints', 'session-project.versions')),
      error => error.code === 'ENOENT',
    )

    // A session without its own blueprint can still review the project.
    const noOwnBlueprint = { id: 'session-none', session: { header: { cwd, id: 'session-none' } } }
    const stillWorks = await handler({ rawInput: 'review project', agent: noOwnBlueprint })
    assert.equal(stillWorks.kind, 'success')
    assert.equal(JSON.parse(stillWorks.text).totals.blueprints, 2)

    // Empty project: no throw, zero totals, offline page.
    const emptyCwd = path.join(cwd, 'no-blueprints-here')
    const emptyAgent = { id: 'session-empty', session: { header: { cwd: emptyCwd, id: 'session-empty' } } }
    const empty = await handler({ rawInput: 'review project', agent: emptyAgent })
    assert.equal(empty.kind, 'success')
    assert.equal(JSON.parse(empty.text).totals.blueprints, 0)
    const emptyHtml = await handler({ rawInput: 'review project html', agent: emptyAgent })
    assert.equal(emptyHtml.kind, 'success')
    assert.match(emptyHtml.text, /项目内没有可评审的蓝图/)

    for (const line of ['review project nope', 'review project html extra']) {
      const failed = await handler({ rawInput: line, agent: plugin.agent })
      assert.equal(failed.kind, 'error', line)
      assert.match(failed.text, /用法/u, line)
    }

    const fallback = await handler({ rawInput: 'unknown-command', agent: plugin.agent })
    assert.equal(fallback.kind, 'error')
    assert.match(fallback.text, /review project \[html\]/u)

    plugin.dispose()
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})
