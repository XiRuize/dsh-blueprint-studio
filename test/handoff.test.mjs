import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  BlueprintValidationError,
  applyRunResult,
  blueprintAbsolutePath,
  blueprintRunDirAbsolute,
  blueprintRunDirRelative,
  blueprintRunHandoffAbsolute,
  blueprintRunHandoffRelative,
  blueprintRunResultAbsolute,
  blueprintRunResultRelative,
  buildHandoffJob,
  isSafeRunId,
  normalizeBlueprint,
  readBlueprintFile,
  readRunResult,
  writeBlueprintFile,
  writeHandoffJob,
} from '../lib/blueprint.js'
import { apply, parseRunHeartbeatArgs } from '../index.js'

const NOW = 1_700_000_000_000
const SESSION = 'handoff-session'

function normalized(input) {
  return normalizeBlueprint(input, undefined, { sessionId: SESSION })
}

function baseBlueprint(extra = {}) {
  return normalized({
    title: 'Handoff protocol',
    mounts: [
      { id: 'main', label: 'Main', root: 'src', vcs: 'git', ref: 'main-ref' },
      { id: 'snap', label: 'Snapshot', root: '../snapshots/a', kind: 'snapshot', access: 'ro', ref: 'snap-ref' },
    ],
    modules: [
      {
        id: 'api',
        name: 'API',
        code: 'A1',
        layerId: 'A',
        summary: 'Build the API endpoints.',
        mountIds: ['main', 'snap'],
        execution: {
          adapter: 'cli',
          cwd: 'src',
          allow: ['read'],
          commands: ['npm test'],
          agentProfile: 'fast',
          storage: { kind: 'fs', ref: 'evidence' },
        },
        acceptance: ['tests pass'],
        dependsOn: ['db'],
      },
      { id: 'db', name: 'DB', code: 'A2', layerId: 'A', mountIds: ['snap'], acceptance: ['schema ok'] },
    ],
    sections: [
      { key: 'functional', title: '功能', items: [{ id: 'i1', uid: 'functional:i1', text: 'API returns JSON', moduleId: 'api' }] },
    ],
    runs: [
      {
        id: 'run-cli',
        moduleId: 'api',
        mountIds: ['main', 'snap'],
        adapter: 'cli',
        status: 'running',
        startedAt: NOW,
        leaseUntil: NOW + 60_000,
        evidence: [{ at: NOW, text: 'started' }],
      },
    ],
    ...extra,
  })
}

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
  const agent = { id: 'session-run', session: { header: { cwd, id: 'session-run' } } }
  return { tools, commands, agent, dispose: () => { for (const dispose of disposers) dispose() } }
}

async function seedBlueprint(cwd, sessionId, input) {
  const file = blueprintAbsolutePath(cwd, sessionId)
  const blueprint = normalizeBlueprint(input, undefined, { sessionId })
  await writeBlueprintFile(file, blueprint)
  return { file, blueprint }
}

async function writeResult(cwd, sessionId, runId, value) {
  const file = blueprintRunResultAbsolute(cwd, sessionId, runId)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, typeof value === 'string' ? value : JSON.stringify(value), 'utf8')
}

async function readVersions(cwd, sessionId) {
  try {
    return JSON.parse(await fs.readFile(
      path.join(cwd, '.dsh', 'blueprints', `${sessionId}.versions`, 'index.json'),
      'utf8',
    )).versions
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

test('run path helpers are session-scoped, validated and refuse traversal', () => {
  assert.deepEqual(blueprintRunDirRelative('session 1', 'run-abc'), '.dsh/blueprints/session_1.runs/run-abc')
  assert.equal(
    blueprintRunDirAbsolute('C:\\ws', 'session 1', 'run-abc'),
    path.join('C:\\ws', '.dsh', 'blueprints', 'session_1.runs', 'run-abc'),
  )
  assert.equal(
    blueprintRunHandoffRelative('session 1', 'run-abc'),
    '.dsh/blueprints/session_1.runs/run-abc/handoff.json',
  )
  assert.equal(
    blueprintRunResultRelative('session 1', 'run-abc'),
    '.dsh/blueprints/session_1.runs/run-abc/result.json',
  )
  assert.equal(
    blueprintRunHandoffAbsolute('C:\\ws', 'session 1', 'run-abc'),
    path.join('C:\\ws', '.dsh', 'blueprints', 'session_1.runs', 'run-abc', 'handoff.json'),
  )
  assert.equal(
    blueprintRunResultAbsolute('C:\\ws', 'session 1', 'run-abc'),
    path.join('C:\\ws', '.dsh', 'blueprints', 'session_1.runs', 'run-abc', 'result.json'),
  )

  assert.equal(isSafeRunId('run-a1'), true)
  assert.equal(isSafeRunId(' run-a1 '), true)
  for (const value of ['', 'run-', 'run-ABC', 'run-a/b', 'run-a\\b', '../run-a', 'x-run-a', 'run-a b', 'run-中文']) {
    assert.equal(isSafeRunId(value), false, value)
  }
  for (const helper of [blueprintRunDirRelative, blueprintRunHandoffRelative, blueprintRunResultRelative]) {
    assert.throws(() => helper(SESSION, '../escape'), error => error instanceof BlueprintValidationError && /run-\[a-z0-9-\]/u.test(error.message))
    assert.throws(() => helper(SESSION, 'run-ABC'), BlueprintValidationError)
  }
  assert.throws(() => blueprintRunDirAbsolute('C:\\ws', SESSION, 'run-a/b'), BlueprintValidationError)
})

test('buildHandoffJob projects a complete, secret-free job for running and blocked runs', () => {
  const blueprint = baseBlueprint()
  // Raw execution extras are never copied into the handoff, even if present on an
  // unnormalized object; add one after normalization to prove the projection filters.
  blueprint.modules[0].execution.apiKey = 'SECRET-TOKEN'
  const handoff = buildHandoffJob(blueprint, 'run-cli')

  assert.equal(handoff.kind, 'blueprint-handoff')
  assert.equal(handoff.runId, 'run-cli')
  assert.equal(handoff.moduleId, 'api')
  assert.equal(handoff.moduleCode, 'A1')
  assert.equal(handoff.adapter, 'cli')
  assert.equal(handoff.cwd, 'src')
  assert.equal(handoff.auto, false)
  assert.deepEqual(handoff.mounts.map(mount => mount.id), ['main', 'snap'])
  assert.deepEqual(handoff.allow, ['read'])
  assert.deepEqual(handoff.commands, ['npm test'])
  assert.equal(handoff.agentProfile, 'fast')
  assert.deepEqual(handoff.storage, { kind: 'fs', ref: 'evidence' })
  assert.deepEqual(handoff.requirements, [{ uid: 'functional:i1', text: 'API returns JSON' }])
  assert.deepEqual(handoff.acceptance, ['tests pass'])
  assert.deepEqual(handoff.dependsOn, ['db'])
  assert.equal(handoff.createdAt, NOW)
  assert.equal(handoff.expiresAt, NOW + 60_000)
  assert.equal(handoff.resultPath, '.dsh/blueprints/handoff-session.runs/run-cli/result.json')
  assert.equal(handoff.handoffPath, '.dsh/blueprints/handoff-session.runs/run-cli/handoff.json')
  assert.equal(handoff.resultSchema.type, 'object')
  assert.deepEqual(handoff.resultSchema.required, ['runId', 'status'])
  assert.deepEqual(handoff.resultSchema.properties.status.enum, ['done', 'failed', 'blocked'])
  assert.equal(handoff.resultSchema.properties.evidence.maxItems, 50)
  assert.equal(handoff.resultSchema.additionalProperties, false)
  assert.ok(Array.isArray(handoff.instructions) && handoff.instructions.length >= 4)

  assert.match(handoff.prompt, /Build the API endpoints\./u)
  assert.match(handoff.prompt, /tests pass/u)
  assert.match(handoff.prompt, /main/u)
  assert.match(handoff.prompt, /run-cli/u)
  assert.match(handoff.prompt, /result\.json/u)
  assert.match(handoff.prompt, /handoff-session\.runs/u)
  assert.match(handoff.prompt, /evidence/u)
  assert.match(handoff.prompt, /auto=false/u)
  assert.doesNotMatch(JSON.stringify(handoff), /SECRET-TOKEN/u)

  // Only running/blocked runs can be prepared; terminal and orphan runs cannot.
  assert.equal(buildHandoffJob(blueprint, 'run-missing'), undefined)
  assert.equal(buildHandoffJob(blueprint, 'run-ABC'), undefined)
  assert.equal(buildHandoffJob(null, 'run-cli'), undefined)
  const done = baseBlueprint({
    runs: [{ id: 'run-done', moduleId: 'api', status: 'done', startedAt: NOW, endedAt: NOW + 1, evidence: [] }],
  })
  assert.equal(buildHandoffJob(done, 'run-done'), undefined)
  const blocked = baseBlueprint({
    runs: [{
      id: 'run-blocked',
      moduleId: 'api',
      mountIds: ['main'],
      adapter: 'cli',
      status: 'blocked',
      startedAt: NOW,
      leaseUntil: NOW + 30_000,
      evidence: [],
    }],
  })
  const blockedJob = buildHandoffJob(blocked, 'run-blocked')
  assert.equal(blockedJob.runId, 'run-blocked')
  assert.equal(blockedJob.expiresAt, NOW + 30_000)
  const orphan = baseBlueprint({
    runs: [{ id: 'run-orphan', moduleId: 'ghost', status: 'running', startedAt: NOW, leaseUntil: NOW + 1, evidence: [] }],
  })
  assert.equal(buildHandoffJob(orphan, 'run-orphan'), undefined)
})

test('writeHandoffJob writes an atomic handoff without touching the blueprint runs', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-handoff-write-'))
  try {
    const blueprint = baseBlueprint()
    const before = JSON.stringify(blueprint)
    const written = await writeHandoffJob(cwd, SESSION, blueprint, 'run-cli')

    assert.equal(written.relativePath, blueprintRunHandoffRelative(SESSION, 'run-cli'))
    assert.equal(written.absolutePath, blueprintRunHandoffAbsolute(cwd, SESSION, 'run-cli'))
    const disk = JSON.parse(await fs.readFile(written.absolutePath, 'utf8'))
    assert.deepEqual(disk, written.handoff)
    assert.equal(disk.resultPath, blueprintRunResultRelative(SESSION, 'run-cli'))
    assert.equal(JSON.stringify(blueprint), before, 'the pure blueprint is not mutated')

    await assert.rejects(
      () => writeHandoffJob(cwd, SESSION, blueprint, 'run-done'),
      error => error instanceof BlueprintValidationError && /不存在/u.test(error.message),
    )
    assert.equal(await fs.readFile(written.absolutePath, 'utf8').then(Boolean), true)
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('readRunResult distinguishes missing, malformed JSON and schema errors', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-handoff-read-'))
  try {
    const missing = await readRunResult(cwd, SESSION, 'run-cli')
    assert.equal(missing.ok, false)
    assert.equal(missing.code, 'missing')
    assert.match(missing.error, /结果文件不存在/u)

    await writeResult(cwd, SESSION, 'run-cli', '{not json')
    const malformed = await readRunResult(cwd, SESSION, 'run-cli')
    assert.equal(malformed.ok, false)
    assert.equal(malformed.code, 'invalid-json')
    assert.match(malformed.error, /合法 JSON/u)

    await writeResult(cwd, SESSION, 'run-cli', { runId: 'run-other', status: 'done' })
    const wrongRun = await readRunResult(cwd, SESSION, 'run-cli')
    assert.equal(wrongRun.code, 'invalid-result')
    assert.match(wrongRun.error, /runId 必须是 run-cli/u)

    await writeResult(cwd, SESSION, 'run-cli', { runId: 'run-cli', status: 'ok' })
    const badStatus = await readRunResult(cwd, SESSION, 'run-cli')
    assert.equal(badStatus.code, 'invalid-result')
    assert.match(badStatus.error, /status 必须是 done\/failed\/blocked/u)

    await writeResult(cwd, SESSION, 'run-cli', { runId: 'run-cli', status: 'done', evidence: 'npm test' })
    assert.equal((await readRunResult(cwd, SESSION, 'run-cli')).code, 'invalid-result')

    await writeResult(cwd, SESSION, 'run-cli', {
      runId: 'run-cli',
      status: 'done',
      evidence: Array.from({ length: 51 }, (_, index) => ({ text: `e${index}` })),
    })
    const tooMany = await readRunResult(cwd, SESSION, 'run-cli')
    assert.equal(tooMany.code, 'invalid-result')
    assert.match(tooMany.error, /最多 50 条/u)

    await writeResult(cwd, SESSION, 'run-cli', { runId: 'run-cli', status: 'done', evidence: [{ kind: 1, text: 'x' }] })
    assert.equal((await readRunResult(cwd, SESSION, 'run-cli')).code, 'invalid-result')

    await writeResult(cwd, SESSION, 'run-cli', {
      runId: 'run-cli',
      status: 'blocked',
      summary: 'waiting',
      nextAction: 'retry',
      evidence: ['tests passed', { kind: 'log', text: 'npm test' }],
      changedPaths: [' src/a.js ', 'src/a.js', ''],
      at: NOW,
    })
    const valid = await readRunResult(cwd, SESSION, 'run-cli')
    assert.equal(valid.ok, true)
    assert.deepEqual(valid.result, {
      runId: 'run-cli',
      status: 'blocked',
      summary: 'waiting',
      nextAction: 'retry',
      evidence: [{ text: 'tests passed' }, { kind: 'log', text: 'npm test' }],
      changedPaths: ['src/a.js'],
      at: NOW,
    })
    assert.equal(valid.relativePath, blueprintRunResultRelative(SESSION, 'run-cli'))

    const unsafe = await readRunResult(cwd, SESSION, '../run-cli')
    assert.equal(unsafe.ok, false)
    assert.equal(unsafe.code, 'invalid-run-id')
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('applyRunResult finishes done/failed runs and keeps blocked runs open', () => {
  const blueprint = baseBlueprint()

  const done = applyRunResult(blueprint, {
    runId: 'run-cli',
    status: 'done',
    summary: 'shipped',
    evidence: [{ text: 'npm test' }],
    changedPaths: ['lib/api.js'],
  })
  assert.equal(done.ok, true)
  assert.equal(done.run.status, 'done')
  assert.equal(typeof done.run.endedAt, 'number')
  assert.equal('leaseUntil' in done.run, false)
  assert.deepEqual(done.run.evidence.map(item => item.text), ['started', 'npm test', 'shipped'])
  assert.equal(done.run.evidence.at(-1).kind, 'summary')
  assert.deepEqual(done.run.changedPaths, ['lib/api.js'])
  assert.deepEqual(done.warnings, [])
  assert.equal(blueprint.runs[0].status, 'running', 'input is not mutated')
  assert.equal(done.blueprint.runs[0].status, 'done')

  const failed = applyRunResult(baseBlueprint(), {
    runId: 'run-cli',
    status: 'failed',
    error: 'build broke',
    nextAction: 'fix build',
    evidence: ['npm test failed'],
  })
  assert.equal(failed.ok, true)
  assert.equal(failed.run.status, 'failed')
  assert.equal(failed.run.error, 'build broke')
  assert.equal(failed.run.nextAction, 'fix build')
  assert.equal(typeof failed.run.endedAt, 'number')

  const blocked = applyRunResult(baseBlueprint(), {
    runId: 'run-cli',
    status: 'blocked',
    summary: 'waiting on review',
    nextAction: 'ask reviewer',
    evidence: ['blocked by review'],
  })
  assert.equal(blocked.ok, true)
  assert.equal(blocked.run.status, 'blocked')
  assert.equal(blocked.run.leaseUntil, NOW + 60_000, 'blocked keeps the existing lease')
  assert.equal('endedAt' in blocked.run, false)
  assert.equal(blocked.run.nextAction, 'ask reviewer')
  assert.deepEqual(blocked.run.evidence.map(item => item.text), ['started', 'blocked by review', 'waiting on review'])
  assert.ok(buildHandoffJob(blocked.blueprint, 'run-cli') !== undefined, 'blocked can be prepared again')

  const defaultBlocked = applyRunResult(baseBlueprint(), { runId: 'run-cli', status: 'blocked' })
  assert.match(defaultBlocked.run.nextAction, /prepare 或 collect/u)
  assert.ok(defaultBlocked.warnings.some(warning => /没有 evidence/u.test(warning)))

  const noEvidence = applyRunResult(baseBlueprint(), { runId: 'run-cli', status: 'done' })
  assert.ok(noEvidence.warnings.some(warning => /没有 evidence/u.test(warning)))

  const terminal = applyRunResult(baseBlueprint({
    runs: [{ id: 'run-done', moduleId: 'api', status: 'done', startedAt: NOW, endedAt: NOW, evidence: [] }],
  }), { runId: 'run-done', status: 'done' })
  assert.equal(terminal.ok, false)
  assert.match(terminal.error, /已结束/u)

  assert.match(applyRunResult(baseBlueprint(), { runId: 'run-missing', status: 'done' }).error, /不存在/u)
  assert.match(applyRunResult(baseBlueprint(), { runId: 'run-cli', status: 'ok' }).error, /格式无效/u)
  assert.match(applyRunResult(null, { runId: 'run-cli', status: 'done' }).error, /还没有工程蓝图/u)
})

test('parseRunHeartbeatArgs validates the runId and ttl', () => {
  assert.deepEqual(parseRunHeartbeatArgs('run-a1'), { ok: true, runId: 'run-a1', ttlMs: undefined })
  assert.deepEqual(parseRunHeartbeatArgs(['run-a1', '--ttl', '5']), { ok: true, runId: 'run-a1', ttlMs: 300_000 })
  assert.deepEqual(parseRunHeartbeatArgs('run-a1 --ttl=1.5'), { ok: true, runId: 'run-a1', ttlMs: 90_000 })
  for (const [args, pattern] of [
    ['', /用法/u],
    ['run-a1 extra', /用法/u],
    ['run-a1 --ttl', /缺少取值/u],
    ['run-a1 --ttl 0', /--ttl/u],
    ['run-a1 --ttl nope', /--ttl/u],
    ['run-a1 --wat', /未知参数/u],
  ]) {
    const parsed = parseRunHeartbeatArgs(args)
    assert.equal(parsed.ok, false, args)
    assert.match(parsed.message, pattern, args)
  }
})

test('writeHandoffJob refuses terminal, orphan and unsafe runs without writing', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-handoff-refuse-'))
  try {
    const terminal = baseBlueprint({
      runs: [{ id: 'run-done', moduleId: 'api', status: 'done', startedAt: NOW, endedAt: NOW, evidence: [] }],
    })
    await assert.rejects(
      () => writeHandoffJob(cwd, SESSION, terminal, 'run-done'),
      error => error instanceof BlueprintValidationError && /已结束/u.test(error.message),
    )
    const orphan = baseBlueprint({
      runs: [{ id: 'run-orphan', moduleId: 'ghost', status: 'running', startedAt: NOW, leaseUntil: NOW + 1, evidence: [] }],
    })
    await assert.rejects(
      () => writeHandoffJob(cwd, SESSION, orphan, 'run-orphan'),
      error => error instanceof BlueprintValidationError && /模块不存在/u.test(error.message),
    )
    await assert.rejects(
      () => writeHandoffJob(cwd, SESSION, baseBlueprint(), '../run-cli'),
      error => error instanceof BlueprintValidationError && /运行 id 无效/u.test(error.message),
    )
    await assert.rejects(
      () => writeHandoffJob(cwd, SESSION, baseBlueprint(), 'run-missing'),
      error => error instanceof BlueprintValidationError && /不存在/u.test(error.message),
    )
    await assert.rejects(
      () => fs.stat(blueprintRunHandoffAbsolute(cwd, SESSION, 'run-cli')),
      error => error?.code === 'ENOENT',
    )
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('applyRunResult rejects malformed results before touching the ledger', () => {
  const blueprint = baseBlueprint()
  const cases = [
    [{ runId: 'run-cli' }, /status 必须是/u],
    [{ runId: 'run-cli', status: 'done', evidence: [{ text: '' }] }, /text 必须是非空字符串/u],
    [{ runId: 'run-cli', status: 'done', evidence: Array.from({ length: 51 }, (_, index) => ({ text: `e${index}` })) }, /最多 50 条/u],
    [{ runId: 'run-cli', status: 'done', changedPaths: [1] }, /changedPaths/u],
    [{ runId: 'run-cli', status: 'done', at: 'now' }, /at 必须是有限数字/u],
    [{ runId: 'run-cli', status: 'done', summary: 42 }, /summary 必须是字符串/u],
  ]
  for (const [result, pattern] of cases) {
    const applied = applyRunResult(blueprint, result)
    assert.equal(applied.ok, false, JSON.stringify(result))
    assert.match(applied.error, pattern)
  }
  assert.equal(blueprint.runs[0].status, 'running')
  assert.deepEqual(blueprint.runs[0].evidence.map(item => item.text), ['started'])
})

test('/blueprint run prepare/collect/heartbeat are end-to-end and never write on failure', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-handoff-command-'))
  try {
    const plugin = setupPlugin(cwd)
    const handler = plugin.commands[0].handler
    const { file } = await seedBlueprint(cwd, plugin.agent.id, {
      title: 'Handoff command',
      mounts: [{ id: 'main', label: 'Main', root: 'src', vcs: 'git', ref: 'main-ref' }],
      modules: [
        { id: 'api', name: 'API', code: 'A1', layerId: 'A', mountIds: ['main'], execution: { adapter: 'cli', cwd: 'src' }, acceptance: ['ok'] },
        { id: 'db', name: 'DB', code: 'A2', layerId: 'A', acceptance: ['ok'] },
      ],
    })

    const start = JSON.parse((await handler({ rawInput: 'run start api', agent: plugin.agent })).text)
    const runId = start.run.id

    const beforePrepare = JSON.stringify(await readBlueprintFile(file))
    const versionsBeforePrepare = await readVersions(cwd, plugin.agent.id)
    const prepare = await handler({ rawInput: `run prepare ${runId}`, agent: plugin.agent })
    assert.equal(prepare.kind, 'success')
    const prepared = JSON.parse(prepare.text)
    assert.equal(prepared.ok, true)
    assert.equal(prepared.auto, false)
    assert.equal(prepared.handoff.runId, runId)
    assert.equal(prepared.path, blueprintRunHandoffRelative(plugin.agent.id, runId))
    const handoffDisk = JSON.parse(await fs.readFile(prepared.absolutePath, 'utf8'))
    assert.deepEqual(handoffDisk, prepared.handoff)
    assert.equal(JSON.stringify(await readBlueprintFile(file)), beforePrepare, 'prepare never writes the blueprint')
    assert.deepEqual(await readVersions(cwd, plugin.agent.id), versionsBeforePrepare, 'prepare never archives')

    const beforeMissingCollect = JSON.stringify(await readBlueprintFile(file))
    const missing = await handler({ rawInput: `run collect ${runId}`, agent: plugin.agent })
    assert.equal(missing.kind, 'error')
    assert.match(missing.text, /结果文件不存在/u)
    assert.equal(JSON.stringify(await readBlueprintFile(file)), beforeMissingCollect, 'missing result never writes')
    assert.deepEqual(await readVersions(cwd, plugin.agent.id), versionsBeforePrepare)

    await writeResult(cwd, plugin.agent.id, runId, {
      runId,
      status: 'done',
      summary: 'shipped',
      evidence: [{ kind: 'test', text: 'npm test passed' }],
      changedPaths: ['src/api.js'],
    })
    const collect = await handler({ rawInput: `run collect ${runId}`, agent: plugin.agent })
    assert.equal(collect.kind, 'success')
    const collected = JSON.parse(collect.text)
    assert.equal(collected.run.status, 'done')
    assert.deepEqual(collected.warnings, [])
    const disk = await readBlueprintFile(file)
    assert.equal(disk.runs[0].status, 'done')
    assert.deepEqual(disk.runs[0].evidence.map(item => item.text), ['npm test passed', 'shipped'])
    assert.deepEqual(disk.runs[0].changedPaths, ['src/api.js'])
    const versions = await readVersions(cwd, plugin.agent.id)
    assert.ok(versions.some(entry => entry.label === 'run collect done'))

    const beforeRejected = JSON.stringify(await readBlueprintFile(file))
    const again = await handler({ rawInput: `run collect ${runId}`, agent: plugin.agent })
    assert.equal(again.kind, 'error')
    assert.match(again.text, /已结束/u)
    assert.equal(JSON.stringify(await readBlueprintFile(file)), beforeRejected)
    const heartbeatDone = await handler({ rawInput: `run heartbeat ${runId}`, agent: plugin.agent })
    assert.equal(heartbeatDone.kind, 'error')
    assert.match(heartbeatDone.text, /已结束/u)

    // Heartbeat renews a running lease and archives the new ledger.
    const secondStart = JSON.parse((await handler({ rawInput: 'run start api', agent: plugin.agent })).text)
    const secondId = secondStart.run.id
    const beforeHeartbeat = Date.now()
    const heartbeat = await handler({ rawInput: `run heartbeat ${secondId} --ttl 5`, agent: plugin.agent })
    assert.equal(heartbeat.kind, 'success')
    const beating = JSON.parse(heartbeat.text)
    assert.equal(beating.run.status, 'running')
    assert.ok(beating.run.leaseUntil >= beforeHeartbeat + 4 * 60_000)
    const heartbeatDisk = await readBlueprintFile(file)
    assert.equal(heartbeatDisk.runs.find(run => run.id === secondId).leaseUntil, beating.run.leaseUntil)
    assert.ok((await readVersions(cwd, plugin.agent.id)).some(entry => entry.label === 'run heartbeat'))

    // Blocked results keep the run open; prepare and heartbeat remain available.
    await writeResult(cwd, plugin.agent.id, secondId, {
      runId: secondId,
      status: 'blocked',
      summary: 'waiting',
      nextAction: 'retry later',
      evidence: ['blocked'],
    })
    const blocked = JSON.parse((await handler({ rawInput: `run collect ${secondId}`, agent: plugin.agent })).text)
    assert.equal(blocked.run.status, 'blocked')
    assert.equal(blocked.run.nextAction, 'retry later')
    assert.equal('endedAt' in blocked.run, false)
    assert.equal(typeof blocked.run.leaseUntil, 'number')
    const blockedPrepare = await handler({ rawInput: `run prepare ${secondId}`, agent: plugin.agent })
    assert.equal(blockedPrepare.kind, 'success')
    const blockedHeartbeat = await handler({ rawInput: `run heartbeat ${secondId} --ttl 1`, agent: plugin.agent })
    assert.equal(blockedHeartbeat.kind, 'success')
    assert.equal(JSON.parse(blockedHeartbeat.text).run.status, 'blocked')

    const beforeInvalid = JSON.stringify(await readBlueprintFile(file))
    await writeResult(cwd, plugin.agent.id, secondId, { runId: secondId, status: 'nope' })
    const invalid = await handler({ rawInput: `run collect ${secondId}`, agent: plugin.agent })
    assert.equal(invalid.kind, 'error')
    assert.match(invalid.text, /status 必须是/u)
    assert.equal(JSON.stringify(await readBlueprintFile(file)), beforeInvalid, 'invalid result never writes')

    for (const [line, pattern] of [
      ['run prepare run-missing', /不存在/u],
      ['run prepare', /用法/u],
      ['run collect', /用法/u],
      ['run heartbeat', /用法/u],
      ['run nope', /用法/u],
    ]) {
      const result = await handler({ rawInput: line, agent: plugin.agent })
      assert.equal(result.kind, 'error', line)
      assert.match(result.text, pattern, line)
    }
    const fallback = await handler({ rawInput: 'run nope', agent: plugin.agent })
    assert.match(fallback.text, /prepare/u)
    assert.match(fallback.text, /collect/u)
    assert.match(fallback.text, /heartbeat/u)
    assert.match(plugin.commands[0].input.hint, /run prepare <runId>/u)
    assert.match(plugin.commands[0].input.hint, /run heartbeat <runId>/u)

    plugin.dispose()
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})
