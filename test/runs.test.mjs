import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  BLUEPRINT_LIMITS,
  BlueprintValidationError,
  blueprintAbsolutePath,
  claimConflicts,
  expireRunLeases,
  finishRun,
  mergeBlueprintForUpdate,
  normalizeBlueprint,
  readBlueprintFile,
  rollbackPlanForRun,
  runEvidence,
  startRun,
  writeBlueprintFile,
} from '../lib/blueprint.js'
import { CHECK_RULES, analyzeBlueprint } from '../lib/checks.js'
import { apply, parseRunStartArgs } from '../index.js'

const NOW = 1_700_000_000_000

function normalized(input, previous) {
  return normalizeBlueprint(input, previous, { sessionId: 'runs-session' })
}

function issuesWithCode(result, code) {
  return result.issues.filter(issue => issue.code === code)
}

function hasCode(result, code) {
  return result.issues.some(issue => issue.code === code)
}

function baseBlueprint(extra = {}) {
  return normalized({
    title: 'Run ledger',
    mounts: [
      { id: 'main', label: 'Main', root: 'src', vcs: 'git', ref: 'main-ref' },
      { id: 'snap', label: 'Snapshot', root: '../snapshots/a', kind: 'snapshot', ref: 'snap-ref' },
      { id: 'hash', label: 'Archive', root: '../archives/a', kind: 'archive', checksum: 'sha:hash' },
      { id: 'docs', label: 'Docs', root: 'docs' },
    ],
    workspaceSnapshot: { main: ' sha:main-base ', blank: '   ' },
    modules: [
      {
        id: 'api',
        name: 'API',
        mountIds: ['main', 'snap', 'hash'],
        execution: { adapter: 'cli' },
        acceptance: ['login works'],
      },
      { id: 'db', name: 'DB', mountIds: ['snap'], acceptance: ['ok'] },
      { id: 'worker', name: 'Worker', mountIds: ['main'], acceptance: ['ok'] },
      { id: 'docs', name: 'Docs', mountIds: ['docs'], acceptance: ['ok'] },
    ],
    ...extra,
  })
}

test('normalizeRuns keeps stable ids, caps evidence and preserves dangling references and extras', () => {
  const blueprint = normalized({
    runs: [
      {
        id: 'run-1',
        moduleId: 'ghost',
        mountIds: ['main', 'main', '', 'snap'],
        adapter: 'CLI',
        status: 'RUNNING',
        claimedBy: ' bot ',
        leaseUntil: NOW + 1_000,
        startedAt: NOW,
        evidence: [
          { at: NOW, text: ' one ', kind: 'log' },
          { at: NOW + 1, text: '   ' },
          'bare string',
        ],
        baseSnapshot: { main: ' sha:base ', blank: '   ' },
        decisions: [' keep ', 'keep', '', 42],
        nextAction: ' go ',
        error: ' boom ',
        rollback: { instructions: [' revert '], auto: true },
        extraField: { ticket: 'T-1' },
      },
      { id: 'run-1', moduleId: 'api', adapter: 'weird', status: 'weird', mountIds: ['snap'] },
      {
        id: '',
        moduleId: 'api',
        adapter: 'cli',
        status: 'done',
        startedAt: 'not-a-time',
        evidence: Array.from({ length: 60 }, (_, index) => ({ at: index, text: `e${index}` })),
      },
    ],
  })

  assert.equal(blueprint.runs.length, 3)
  const [first, second, generated] = blueprint.runs
  assert.equal(first.id, 'run-1')
  assert.equal(first.moduleId, 'ghost')
  assert.deepEqual(first.mountIds, ['main', 'snap'])
  assert.equal(first.adapter, 'cli')
  assert.equal(first.status, 'running')
  assert.equal(first.claimedBy, 'bot')
  assert.equal(first.leaseUntil, NOW + 1_000)
  assert.equal(first.startedAt, NOW)
  assert.deepEqual(first.evidence, [{ at: NOW, text: 'one', kind: 'log' }])
  assert.deepEqual(first.baseSnapshot, { main: 'sha:base' })
  assert.deepEqual(first.decisions, ['keep'])
  assert.equal(first.nextAction, 'go')
  assert.equal(first.error, 'boom')
  assert.deepEqual(first.rollback, { instructions: ['revert'], auto: false })
  assert.deepEqual(first.extraField, { ticket: 'T-1' })

  // Invalid enums degrade to safe defaults; a duplicate id is renamed, not dropped.
  assert.equal(second.id, 'run-1-2')
  assert.equal(second.adapter, 'manual')
  assert.equal(second.status, 'running')

  // Missing ids/timestamps are generated; evidence keeps only the newest 50 entries.
  assert.match(generated.id, /^run-[a-z0-9]+$/u)
  assert.equal(typeof generated.startedAt, 'number')
  assert.equal(generated.evidence.length, BLUEPRINT_LIMITS.runEvidence)
  assert.equal(generated.evidence[0].text, 'e10')
  assert.equal(generated.evidence.at(-1).text, 'e59')

  // A second normalization is stable (ids and timestamps are not rewritten).
  const again = normalized(blueprint)
  assert.deepEqual(again.runs, blueprint.runs)

  // Old blueprints gain an empty ledger without warnings.
  assert.deepEqual(normalized({ title: 'Legacy' }).runs, [])

  const tooMany = Array.from({ length: BLUEPRINT_LIMITS.runs + 1 }, (_, index) => ({
    id: `run-${index}`,
    moduleId: 'api',
    mountIds: [],
    status: 'done',
    evidence: [{ at: index, text: 'ok' }],
  }))
  assert.throws(
    () => normalized({ runs: tooMany }),
    error => error instanceof BlueprintValidationError && /执行记录 201 > 200/u.test(error.message),
  )
})

test('the agent update merge can never seed, forge, clear or delete runs', () => {
  const base = normalized({
    modules: [{ id: 'api', name: 'API', acceptance: ['ok'] }],
    runs: [{
      id: 'run-keep',
      moduleId: 'api',
      mountIds: [],
      adapter: 'cli',
      status: 'running',
      startedAt: NOW,
      leaseUntil: NOW + 10_000,
      evidence: [{ at: NOW, text: 'started' }],
    }],
  })

  const forged = mergeBlueprintForUpdate(base, {
    runs: [{
      id: 'run-evil',
      moduleId: 'api',
      mountIds: [],
      adapter: 'cli',
      status: 'done',
      evidence: [{ at: NOW, text: 'forged pass' }],
    }],
    modules: [{ id: 'api', summary: 'changed' }],
  })
  assert.deepEqual(forged.runs.map(run => run.id), ['run-keep'])
  assert.deepEqual(forged.runs[0].evidence, [{ at: NOW, text: 'started' }])
  assert.equal(forged.modules[0].summary, 'changed')

  // Even an explicit empty list or omitted field cannot erase the Host ledger.
  assert.deepEqual(mergeBlueprintForUpdate(base, { runs: [] }).runs.map(run => run.id), ['run-keep'])
  assert.deepEqual(mergeBlueprintForUpdate(base, { title: 'Renamed' }).runs.map(run => run.id), ['run-keep'])

  // An update without a previous blueprint cannot invent a ledger either.
  assert.deepEqual(mergeBlueprintForUpdate(undefined, {
    runs: [{ id: 'run-evil', moduleId: 'api', status: 'done', evidence: [] }],
  }).runs, [])
})

test('startRun validates the module/adapter and captures lease, mounts and baseSnapshot', () => {
  const blueprint = baseBlueprint()
  const started = startRun(blueprint, {
    moduleId: 'api',
    adapter: 'cli',
    claimedBy: 'alice',
    ttlMs: 5_000,
    now: NOW,
  })

  assert.equal(started.ok, true)
  assert.match(started.run.id, /^run-[a-z0-9]+-[a-z0-9]+$/u)
  assert.equal(started.run.moduleId, 'api')
  assert.deepEqual(started.run.mountIds, ['main', 'snap', 'hash'])
  assert.equal(started.run.adapter, 'cli')
  assert.equal(started.run.status, 'running')
  assert.equal(started.run.claimedBy, 'alice')
  assert.equal(started.run.startedAt, NOW)
  assert.equal(started.run.leaseUntil, NOW + 5_000)
  assert.deepEqual(started.run.evidence, [])
  assert.deepEqual(started.run.baseSnapshot, {
    main: 'sha:main-base',
    snap: 'snap-ref',
    hash: 'sha:hash',
  })

  // The helper appends to a copy and never mutates the input blueprint.
  assert.equal(blueprint.runs.length, 0)
  assert.equal(started.blueprint.runs.length, 1)

  // Adapter defaults to the module execution adapter, then to dsh-subagent.
  assert.equal(startRun(blueprint, { moduleId: 'api', now: NOW }).run.adapter, 'cli')
  assert.equal(startRun(blueprint, { moduleId: 'docs', now: NOW }).run.adapter, 'dsh-subagent')
  assert.equal(startRun(blueprint, { moduleId: 'api', now: NOW }).run.leaseUntil, NOW + 30 * 60 * 1000)

  for (const [input, pattern] of [
    [{ moduleId: 'ghost', now: NOW }, /模块不存在/u],
    [{ moduleId: '', now: NOW }, /缺少模块 id/u],
    [{ moduleId: 'api', adapter: 'magic', now: NOW }, /适配器无效/u],
  ]) {
    const rejected = startRun(blueprint, input)
    assert.equal(rejected.ok, false)
    assert.match(rejected.error, pattern)
  }

  const full = normalized({
    modules: [{ id: 'api', name: 'API', acceptance: ['ok'] }],
    runs: Array.from({ length: BLUEPRINT_LIMITS.runs }, (_, index) => ({
      id: `run-${index}`,
      moduleId: 'api',
      mountIds: [],
      adapter: 'cli',
      status: 'done',
      startedAt: index,
      evidence: [{ at: index, text: 'ok' }],
    })),
  })
  assert.match(startRun(full, { moduleId: 'api', now: NOW }).error, /上限/u)
})

test('startRun rejects an active working-rw lease conflict and allows expiry or read-only sharing', () => {
  const blueprint = baseBlueprint()
  const first = startRun(blueprint, { moduleId: 'api', ttlMs: 10_000, now: NOW })
  assert.equal(first.ok, true)

  const conflict = startRun(first.blueprint, { moduleId: 'worker', now: NOW + 1_000 })
  assert.equal(conflict.ok, false)
  assert.match(conflict.error, /挂载 main/u)
  assert.deepEqual(conflict.conflicts.map(item => item.mountId), ['main'])
  assert.deepEqual(conflict.conflicts[0].runIds, [first.run.id])
  assert.equal(conflict.blueprint, undefined)

  // A module that only claims the read-only snapshot mount can run in parallel.
  assert.equal(startRun(first.blueprint, { moduleId: 'db', now: NOW + 1_000 }).ok, true)

  // Once the lease is strictly in the past the mount is free again.
  const afterExpiry = startRun(first.blueprint, {
    moduleId: 'worker',
    now: first.run.leaseUntil + 1,
  })
  assert.equal(afterExpiry.ok, true)

  const seeded = baseBlueprint({
    runs: [
      { id: 'r1', moduleId: 'api', mountIds: ['main'], adapter: 'cli', status: 'running', startedAt: 1, leaseUntil: NOW + 60_000, evidence: [] },
      { id: 'r2', moduleId: 'worker', mountIds: ['main', 'main'], adapter: 'cli', status: 'running', startedAt: 2, leaseUntil: NOW + 60_000, evidence: [] },
      { id: 'r3', moduleId: 'api', mountIds: ['main'], adapter: 'cli', status: 'blocked', startedAt: 3, evidence: [] },
      { id: 'r4', moduleId: 'worker', mountIds: ['main'], adapter: 'cli', status: 'running', startedAt: 4, leaseUntil: NOW - 1, evidence: [] },
    ],
  })
  assert.deepEqual(claimConflicts(seeded, { now: NOW }), [{
    mountId: 'main',
    runIds: ['r1', 'r2'],
    moduleIds: ['api', 'worker'],
  }])

  const expired = expireRunLeases(seeded, { now: NOW })
  assert.equal(expired.ok, true)
  assert.deepEqual(expired.expired, ['r4'])
  const blocked = expired.blueprint.runs.find(run => run.id === 'r4')
  assert.equal(blocked.status, 'blocked')
  assert.match(blocked.nextAction, /租约已过期/u)
  assert.deepEqual(claimConflicts(expired.blueprint, { now: NOW }).map(item => item.runIds), [['r1', 'r2']])

  // Nothing expires while leases are still in the future.
  const untouched = expireRunLeases(seeded, { now: NOW - 60_000 })
  assert.deepEqual(untouched.expired, [])
  assert.equal(untouched.blueprint, seeded)
})

test('evidence and finish transitions respect terminal records without touching verification', () => {
  const started = startRun(baseBlueprint(), { moduleId: 'api', ttlMs: 10_000, now: NOW })
  assert.equal(started.ok, true)
  const runId = started.run.id

  const evidence = runEvidence(started.blueprint, runId, ' npm test passed ', { kind: 'tests', now: NOW + 1 })
  assert.equal(evidence.ok, true)
  assert.deepEqual(evidence.run.evidence, [{ at: NOW + 1, kind: 'tests', text: 'npm test passed' }])
  assert.equal(started.blueprint.runs[0].evidence.length, 0, 'input run is not mutated')

  assert.match(runEvidence(started.blueprint, runId, '  ').error, /不能为空/u)
  assert.match(runEvidence(started.blueprint, 'run-missing', 'x').error, /不存在/u)

  const done = finishRun(evidence.blueprint, runId, { status: 'done', now: NOW + 2 })
  assert.equal(done.ok, true)
  assert.equal(done.warning, undefined)
  assert.equal(done.run.status, 'done')
  assert.equal(done.run.endedAt, NOW + 2)
  assert.equal(done.run.leaseUntil, undefined)
  assert.deepEqual(done.run.evidence, [{ at: NOW + 1, kind: 'tests', text: 'npm test passed' }])

  // A successful run is only a run record: module verification stays pending.
  const module = done.blueprint.modules.find(entry => entry.id === 'api')
  assert.equal(module.status, 'pending')
  assert.equal(module.verification.tests.status, 'pending')
  assert.equal(module.verification.reviewer.status, 'pending')
  assert.equal(module.verification.human.status, 'pending')

  assert.match(runEvidence(done.blueprint, runId, 'late').error, /已结束/u)
  assert.match(finishRun(done.blueprint, runId, { status: 'failed' }).error, /已结束/u)
  assert.match(finishRun(started.blueprint, runId, { status: 'running' }).error, /状态无效/u)
  assert.match(finishRun(started.blueprint, 'run-missing', { status: 'done' }).error, /不存在/u)

  // done without evidence succeeds but returns a warning.
  const bare = finishRun(started.blueprint, runId, { status: 'done', now: NOW + 2 })
  assert.equal(bare.ok, true)
  assert.match(bare.warning, /没有任何 evidence/u)

  const failed = finishRun(started.blueprint, runId, {
    status: 'failed',
    error: 'tests failed',
    nextAction: 'fix the login test',
    now: NOW + 3,
  })
  assert.equal(failed.ok, true)
  assert.equal(failed.run.status, 'failed')
  assert.equal(failed.run.error, 'tests failed')
  assert.equal(failed.run.nextAction, 'fix the login test')

  const cancelled = finishRun(started.blueprint, runId, { status: 'cancelled', summary: 'user aborted', now: NOW + 4 })
  assert.equal(cancelled.run.status, 'cancelled')
  assert.deepEqual(cancelled.run.evidence, [{ at: NOW + 4, kind: 'summary', text: 'user aborted' }])

  // Blocked runs can collect recovery evidence but still finish normally.
  const blocked = normalized({
    modules: [{ id: 'api', name: 'API', acceptance: ['ok'] }],
    runs: [{ id: 'run-blocked', moduleId: 'api', mountIds: [], adapter: 'cli', status: 'blocked', startedAt: 1, evidence: [] }],
  })
  assert.equal(runEvidence(blocked, 'run-blocked', 'retry with cache cleared', { now: NOW }).ok, true)

  // Evidence is capped at the newest 50 entries.
  let capped = started.blueprint
  for (let index = 0; index < 55; index += 1) {
    capped = runEvidence(capped, runId, `log ${index}`, { now: NOW + index }).blueprint
  }
  const cappedRun = capped.runs.find(run => run.id === runId)
  assert.equal(cappedRun.evidence.length, 50)
  assert.equal(cappedRun.evidence[0].text, 'log 5')
  assert.equal(cappedRun.evidence.at(-1).text, 'log 54')
})

test('rollbackPlanForRun derives restore targets and never executes anything', () => {
  const started = startRun(baseBlueprint(), { moduleId: 'api', ttlMs: 10_000, now: NOW })
  const failed = finishRun(started.blueprint, started.run.id, {
    status: 'failed',
    error: 'partial write',
    now: NOW + 2,
  })
  const planned = rollbackPlanForRun(failed.blueprint, started.run.id)
  assert.equal(planned.ok, true)
  assert.equal(planned.plan.auto, false)
  assert.equal(planned.plan.runId, started.run.id)
  assert.equal(planned.plan.moduleId, 'api')
  assert.equal(planned.plan.status, 'failed')
  assert.equal(planned.plan.evidenceCount, 0)
  assert.deepEqual(planned.plan.baseSnapshot, {
    main: 'sha:main-base',
    snap: 'snap-ref',
    hash: 'sha:hash',
  })
  assert.equal(planned.plan.instructions.length, 3)
  assert.match(planned.plan.instructions.join('\n'), /主|main/u)
  assert.match(planned.plan.instructions.join('\n'), /sha:main-base/u)
  assert.match(planned.plan.instructions.join('\n'), /snap-ref/u)
  assert.match(planned.plan.instructions.join('\n'), /sha:hash/u)

  // Explicit rollback instructions win; auto is forced false by normalize.
  const custom = normalized({
    modules: [{ id: 'api', name: 'API', acceptance: ['ok'] }],
    runs: [{
      id: 'run-custom',
      moduleId: 'api',
      mountIds: ['main'],
      adapter: 'cli',
      status: 'failed',
      startedAt: 1,
      evidence: [],
      rollback: { instructions: ['restore the database from backup'], auto: true },
    }],
  })
  const customPlan = rollbackPlanForRun(custom, 'run-custom')
  assert.deepEqual(customPlan.plan.instructions, ['restore the database from backup'])
  assert.equal(customPlan.plan.auto, false)

  assert.match(rollbackPlanForRun(custom, 'run-missing').error, /不存在/u)

  // A run without mounts/baseSnapshot still gets a readable manual fallback.
  const noMounts = normalized({
    modules: [{ id: 'api', name: 'API' }],
    runs: [{ id: 'run-bare', moduleId: 'api', mountIds: [], adapter: 'manual', status: 'failed', startedAt: 1, evidence: [] }],
  })
  const barePlan = rollbackPlanForRun(noMounts, 'run-bare').plan
  assert.equal(barePlan.instructions.length, 1)
  assert.match(barePlan.instructions[0], /手动回滚/u)
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
  const agent = { id: 'session-run', session: { header: { cwd, id: 'session-run' } } }
  return { tools, commands, agent, dispose: () => { for (const dispose of disposers) dispose() } }
}

async function seedBlueprint(cwd, sessionId, input) {
  const file = blueprintAbsolutePath(cwd, sessionId)
  const blueprint = normalizeBlueprint(input, undefined, { sessionId })
  await writeBlueprintFile(file, blueprint)
  return { file, blueprint }
}

function runStatuses(blueprint) {
  return blueprint.runs.map(run => [run.id, run.status])
}

test('parseRunStartArgs validates flags and converts ttl minutes to milliseconds', () => {
  assert.deepEqual(parseRunStartArgs('api'), {
    ok: true,
    moduleId: 'api',
    adapter: undefined,
    ttlMs: undefined,
    claimedBy: undefined,
  })
  assert.deepEqual(parseRunStartArgs('api --adapter CLI --ttl 5 --by alice'), {
    ok: true,
    moduleId: 'api',
    adapter: 'cli',
    ttlMs: 300_000,
    claimedBy: 'alice',
  })
  assert.deepEqual(parseRunStartArgs(['api', '--ttl=1.5', '--by=bob']), {
    ok: true,
    moduleId: 'api',
    adapter: undefined,
    ttlMs: 90_000,
    claimedBy: 'bob',
  })
  for (const [args, pattern] of [
    ['', /用法/u],
    ['api --ttl 0', /--ttl/u],
    ['api --ttl nope', /--ttl/u],
    ['api --adapter magic', /适配器无效/u],
    ['api --adapter', /缺少取值/u],
    ['api --wat 1', /未知参数/u],
  ]) {
    const parsed = parseRunStartArgs(args)
    assert.equal(parsed.ok, false, args)
    assert.match(parsed.message, pattern, args)
  }
})

test('/blueprint run commands persist the ledger, archive versions and never write on failure', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-blueprint-runs-'))
  try {
    const plugin = setupPlugin(cwd)
    const handler = plugin.commands[0].handler
    const { file } = await seedBlueprint(cwd, plugin.agent.id, {
      title: 'Run command',
      mounts: [{ id: 'main', label: 'Main', root: 'src', vcs: 'git', ref: 'main-ref' }],
      modules: [
        { id: 'api', name: 'API', mountIds: ['main'], execution: { adapter: 'cli' }, acceptance: ['ok'] },
        { id: 'worker', name: 'Worker', mountIds: ['main'], acceptance: ['ok'] },
      ],
    })

    const initial = await handler({ rawInput: 'run list', agent: plugin.agent })
    assert.equal(initial.kind, 'success')
    assert.deepEqual(JSON.parse(initial.text).runs, [])
    assert.deepEqual(JSON.parse(initial.text).claims, [])

    const start = await handler({
      rawInput: 'run start api --adapter cli --ttl 5 --by alice',
      agent: plugin.agent,
    })
    assert.equal(start.kind, 'success')
    const startPayload = JSON.parse(start.text)
    assert.equal(startPayload.ok, true)
    assert.equal(startPayload.run.moduleId, 'api')
    assert.equal(startPayload.run.adapter, 'cli')
    assert.equal(startPayload.run.claimedBy, 'alice')
    const runId = startPayload.run.id
    let disk = await readBlueprintFile(file)
    assert.equal(disk.runs.length, 1)
    assert.equal(disk.runs[0].id, runId)

    const beforeConflict = JSON.stringify(await readBlueprintFile(file))
    const conflict = await handler({ rawInput: 'run start worker', agent: plugin.agent })
    assert.equal(conflict.kind, 'error')
    assert.match(conflict.text, /挂载 main/u)
    assert.equal(JSON.stringify(await readBlueprintFile(file)), beforeConflict, 'conflict never writes')

    const evidence = await handler({ rawInput: `run evidence ${runId} npm test passed`, agent: plugin.agent })
    assert.equal(evidence.kind, 'success')
    assert.deepEqual(JSON.parse(evidence.text).run.evidence.map(item => item.text), ['npm test passed'])

    const complete = await handler({ rawInput: `run complete ${runId} shipped`, agent: plugin.agent })
    assert.equal(complete.kind, 'success')
    const completePayload = JSON.parse(complete.text)
    assert.equal(completePayload.run.status, 'done')
    assert.deepEqual(completePayload.run.evidence.map(item => item.text), ['npm test passed', 'shipped'])
    assert.equal(completePayload.run.evidence.at(-1).kind, 'summary')
    disk = await readBlueprintFile(file)
    assert.equal(disk.runs[0].status, 'done')

    const listed = JSON.parse((await handler({ rawInput: 'run list', agent: plugin.agent })).text)
    assert.equal(listed.runs.length, 1)
    assert.equal(listed.runs[0].status, 'done')
    assert.deepEqual(listed.claims, [])

    const rollback = await handler({ rawInput: `run rollback ${runId}`, agent: plugin.agent })
    assert.equal(rollback.kind, 'success')
    assert.equal(JSON.parse(rollback.text).plan.auto, false)
    assert.match(JSON.parse(rollback.text).plan.instructions.join('\n'), /main/u)

    // A second run can use the same mount because the first is terminal.
    const second = JSON.parse((await handler({ rawInput: 'run start api', agent: plugin.agent })).text)
    const failed = await handler({ rawInput: `run fail ${second.run.id} build broke`, agent: plugin.agent })
    assert.equal(failed.kind, 'success')
    assert.equal(JSON.parse(failed.text).run.status, 'failed')
    const third = JSON.parse((await handler({ rawInput: 'run start api', agent: plugin.agent })).text)
    const cancelled = await handler({ rawInput: `run cancel ${third.run.id} not needed`, agent: plugin.agent })
    assert.equal(cancelled.kind, 'success')
    assert.equal(JSON.parse(cancelled.text).run.status, 'cancelled')

    const beforeFailures = JSON.stringify(await readBlueprintFile(file))
    for (const [line, pattern] of [
      [`run evidence ${runId} late`, /已结束/u],
      [`run evidence run-missing x`, /不存在/u],
      [`run complete run-missing`, /不存在/u],
      [`run rollback run-missing`, /不存在/u],
      ['run start ghost', /模块不存在/u],
      ['run start api --ttl 0', /--ttl/u],
      ['run start', /用法/u],
    ]) {
      const result = await handler({ rawInput: line, agent: plugin.agent })
      assert.equal(result.kind, 'error', line)
      assert.match(result.text, pattern, line)
    }
    assert.equal(JSON.stringify(await readBlueprintFile(file)), beforeFailures, 'failed commands never write')

    const versions = JSON.parse(await fs.readFile(
      path.join(cwd, '.dsh', 'blueprints', 'session-run.versions', 'index.json'),
      'utf8',
    ))
    assert.ok(versions.versions.length >= 4)
    const labels = versions.versions.map(entry => entry.label)
    assert.ok(labels.includes('run start'))
    assert.ok(labels.includes('run evidence'))
    assert.ok(labels.includes('run complete'))
    assert.ok(labels.includes('run fail'))
    assert.ok(labels.includes('run cancel'))
    assert.equal(versions.versions.every(entry => entry.source === 'ui'), true)

    // The Host ledger is not forgeable through the agent tool.
    const statusesBeforeTool = runStatuses(await readBlueprintFile(file))
    await plugin.tools[0].execute({
      action: 'update',
      blueprint: {
        runs: [{ id: 'run-evil', moduleId: 'api', status: 'done', evidence: [] }],
        modules: [{ id: 'api', name: 'API', acceptance: ['ok'] }],
      },
    }, { agent: plugin.agent })
    const afterTool = await readBlueprintFile(file)
    assert.equal(afterTool.runs.some(run => run.id === 'run-evil'), false)
    assert.equal(afterTool.runs.length, 3)
    assert.deepEqual(runStatuses(afterTool), statusesBeforeTool)

    plugin.dispose()
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('run checks are opt-in and report missing module, conflicts, expiry, evidence and rollback', () => {
  const future = Date.now() + 60_000
  const past = Date.now() - 60_000
  const result = analyzeBlueprint(normalized({
    mounts: [{ id: 'main', label: 'Main', root: 'src' }],
    modules: [
      { id: 'api', name: 'API', acceptance: ['ok'] },
      { id: 'worker', name: 'Worker', acceptance: ['ok'] },
    ],
    runs: [
      { id: 'run-ok', moduleId: 'api', mountIds: ['main'], adapter: 'cli', status: 'running', startedAt: 1, leaseUntil: future, evidence: [] },
      { id: 'run-conflict', moduleId: 'worker', mountIds: ['main'], adapter: 'cli', status: 'running', startedAt: 2, leaseUntil: future, evidence: [] },
      { id: 'run-orphan', moduleId: 'ghost', mountIds: ['main'], adapter: 'manual', status: 'blocked', startedAt: 3, evidence: [] },
      { id: 'run-expired', moduleId: 'worker', mountIds: [], adapter: 'cli', status: 'running', startedAt: 4, leaseUntil: past, evidence: [] },
      { id: 'run-done', moduleId: 'api', mountIds: [], adapter: 'cli', status: 'done', startedAt: 5, evidence: [] },
      { id: 'run-failed', moduleId: 'api', mountIds: [], adapter: 'cli', status: 'failed', startedAt: 6, evidence: [] },
      { id: 'run-good', moduleId: 'api', mountIds: [], adapter: 'cli', status: 'failed', startedAt: 7, evidence: [], rollback: { instructions: ['restore main'] } },
    ],
  }))

  const missing = issuesWithCode(result, 'run-module-missing')
  assert.equal(missing.length, 1)
  assert.equal(missing[0].severity, 'error')
  assert.equal(missing[0].runId, 'run-orphan')
  assert.equal(missing[0].moduleId, 'ghost')

  const conflicts = issuesWithCode(result, 'run-mount-conflict')
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].severity, 'error')
  assert.equal(conflicts[0].mountId, 'main')
  assert.deepEqual(conflicts[0].details.runIds, ['run-ok', 'run-conflict'])

  const expired = issuesWithCode(result, 'run-lease-expired')
  assert.equal(expired.length, 1)
  assert.equal(expired[0].severity, 'warn')
  assert.equal(expired[0].runId, 'run-expired')

  const evidence = issuesWithCode(result, 'run-evidence-missing')
  assert.equal(evidence.length, 1)
  assert.equal(evidence[0].severity, 'info')
  assert.equal(evidence[0].runId, 'run-done')

  const rollback = issuesWithCode(result, 'run-rollback-missing')
  assert.equal(rollback.length, 1)
  assert.equal(rollback[0].severity, 'warn')
  assert.equal(rollback[0].runId, 'run-failed')

  // Valid ledger entries stay silent.
  const clean = analyzeBlueprint(normalized({
    mounts: [{ id: 'main', root: 'src' }],
    modules: [{ id: 'api', name: 'API', acceptance: ['ok'] }],
    runs: [
      { id: 'run-active', moduleId: 'api', mountIds: ['main'], adapter: 'cli', status: 'running', startedAt: 1, leaseUntil: future, evidence: [] },
      { id: 'run-done', moduleId: 'api', mountIds: [], adapter: 'cli', status: 'done', startedAt: 2, evidence: [{ at: 3, text: 'tests passed' }] },
      { id: 'run-recovered', moduleId: 'api', mountIds: [], adapter: 'cli', status: 'failed', startedAt: 4, evidence: [], rollback: { instructions: ['restore main'] } },
    ],
  }))
  assert.deepEqual(clean.issues.filter(issue => issue.code.startsWith('run-')), [])

  // Legacy blueprints without any runs never gain ledger warnings.
  const legacy = analyzeBlueprint(normalized({ title: 'Legacy', modules: [{ id: 'api', name: 'API', acceptance: ['ok'] }] }))
  assert.deepEqual(legacy.issues.filter(issue => issue.code.startsWith('run-')), [])
  assert.deepEqual(analyzeBlueprint({ title: 'Raw legacy' }).issues.filter(issue => issue.code.startsWith('run-')), [])

  const catalog = new Map(CHECK_RULES.map(rule => [rule.code, rule]))
  for (const [code, severity] of Object.entries({
    'run-module-missing': 'error',
    'run-mount-conflict': 'error',
    'run-lease-expired': 'warn',
    'run-evidence-missing': 'info',
    'run-rollback-missing': 'warn',
  })) {
    assert.equal(catalog.get(code)?.severity, severity, code)
  }
})
