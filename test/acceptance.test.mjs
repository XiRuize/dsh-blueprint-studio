import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  blueprintAbsolutePath,
  mergeBlueprintForUpdate,
  moduleStatusAfterVerification,
  normalizeBlueprint,
  normalizeVerification,
  readBlueprintFile,
  recordModuleVerification,
  verificationComplete,
  verificationFailed,
  writeBlueprintFile,
} from '../lib/blueprint.js'
import { CHECK_RULES, analyzeBlueprint } from '../lib/checks.js'
import { apply } from '../index.js'

const PASSED = { status: 'passed', evidence: [] }
const PENDING = { status: 'pending', evidence: [] }
const FAILED = { status: 'failed', evidence: [] }

function allPassed(evidence = []) {
  return {
    tests: { status: 'passed', evidence },
    reviewer: { status: 'passed', evidence: [] },
    human: { status: 'passed', evidence: [] },
  }
}

function verificationIssues(result) {
  return result.issues.filter(issue => issue.code === 'module-verification-incomplete')
}

test('normalize gives every module three pending verification layers and cleans bad values', () => {
  const blueprint = normalizeBlueprint({
    modules: [
      { id: 'api', name: 'API' },
      {
        id: 'web',
        name: 'Web',
        status: 'running',
        verification: {
          tests: { status: 'passed', evidence: ['npm test', '', 7], at: 1234 },
          reviewer: { status: 'not-a-status' },
          human: { status: 'failed', evidence: 'manual review' },
        },
      },
      {
        id: 'cli',
        name: 'CLI',
        verification: { tests: { status: 'passed', evidence: ['node cli.mjs'], at: 'soon' } },
      },
    ],
  }, undefined, { sessionId: 's' })

  const [api, web, cli] = blueprint.modules
  assert.deepEqual(api.verification, {
    tests: { status: 'pending', evidence: [] },
    reviewer: { status: 'pending', evidence: [] },
    human: { status: 'pending', evidence: [] },
  })
  assert.equal(api.status, 'pending')

  assert.equal(web.verification.tests.status, 'passed')
  assert.deepEqual(web.verification.tests.evidence, ['npm test'])
  assert.equal(web.verification.tests.at, 1234)
  assert.equal(web.verification.reviewer.status, 'pending')
  assert.deepEqual(web.verification.human.evidence, ['manual review'])
  // One failed layer always forces rework, even if the incoming status was running.
  assert.equal(web.status, 'needs-rework')

  // A single-layer hand edit inherits the other two pending layers; invalid `at` is dropped.
  assert.equal(cli.verification.tests.status, 'passed')
  assert.equal(cli.verification.tests.at, undefined)
  assert.equal(cli.verification.reviewer.status, 'pending')
  assert.equal(cli.verification.human.status, 'pending')
  assert.equal(cli.status, 'pending')
})

test('normalizeVerification inherits omitted fields from the previous verification', () => {
  const previous = normalizeVerification({
    tests: { status: 'passed', evidence: ['unit'], at: 10 },
    reviewer: { status: 'failed', evidence: ['needs work'] },
  })
  const next = normalizeVerification({ reviewer: { status: 'passed' } }, previous)

  assert.deepEqual(next.tests, { status: 'passed', evidence: ['unit'], at: 10 })
  assert.deepEqual(next.reviewer, { status: 'passed', evidence: ['needs work'] })
  assert.deepEqual(next.human, { status: 'pending', evidence: [] })
})

test('module status aggregation only grants done when all three layers passed', () => {
  const all = allPassed()
  assert.equal(verificationComplete(all), true)
  assert.equal(verificationFailed(all), false)
  assert.equal(moduleStatusAfterVerification('running', all), 'done')
  assert.equal(moduleStatusAfterVerification('blocked', all), 'done')

  const oneFailed = { ...all, reviewer: FAILED }
  assert.equal(verificationComplete(oneFailed), false)
  assert.equal(verificationFailed(oneFailed), true)
  assert.equal(moduleStatusAfterVerification('done', oneFailed), 'needs-rework')

  const notYet = { tests: PASSED, reviewer: PENDING, human: PENDING }
  assert.equal(moduleStatusAfterVerification('running', notYet), 'running')
  assert.equal(moduleStatusAfterVerification('done', notYet), 'done', 'pending verification does not auto-done or auto-revert')
  assert.equal(moduleStatusAfterVerification('', notYet), 'pending')

  const normalizedDone = normalizeBlueprint({
    modules: [{ id: 'api', name: 'API', status: 'done', acceptance: ['ok'] }],
  }).modules[0]
  assert.equal(normalizedDone.status, 'done')
  assert.equal(normalizedDone.verification.tests.status, 'pending')
})

test('recordModuleVerification updates one layer, appends evidence and aggregates status', () => {
  const blueprint = normalizeBlueprint({
    modules: [{ id: 'api', name: 'API', acceptance: ['login works'] }],
  })

  const first = recordModuleVerification(blueprint, { moduleId: 'api', role: 'tests', status: 'passed', evidence: 'npm test', at: 1000 })
  assert.equal(first.ok, true)
  assert.equal(first.moduleStatus, 'pending')
  assert.deepEqual(first.evidence, ['npm test'])
  assert.equal(blueprint.modules[0].verification.tests.at, 1000)

  const second = recordModuleVerification(blueprint, { moduleId: 'api', role: 'reviewer', status: 'passed', at: 2000 })
  assert.equal(second.moduleStatus, 'pending')

  const third = recordModuleVerification(blueprint, { moduleId: 'api', role: 'human', status: 'passed', evidence: 'manual sign-off' })
  assert.equal(third.ok, true)
  assert.equal(third.moduleStatus, 'done')
  assert.deepEqual(blueprint.modules[0].verification.tests.evidence, ['npm test'])

  const failed = recordModuleVerification(blueprint, { moduleId: 'api', role: 'reviewer', status: 'failed', evidence: 'needs changes' })
  assert.equal(failed.moduleStatus, 'needs-rework')
  assert.deepEqual(blueprint.modules[0].verification.reviewer.evidence, ['needs changes'])

  const invalidRole = recordModuleVerification(blueprint, { moduleId: 'api', role: 'qa', status: 'passed' })
  assert.equal(invalidRole.ok, false)
  assert.match(invalidRole.message, /验证角色无效/u)
  const invalidStatus = recordModuleVerification(blueprint, { moduleId: 'api', role: 'tests', status: 'ok' })
  assert.equal(invalidStatus.ok, false)
  assert.match(invalidStatus.message, /验证状态无效/u)
  const missingModule = recordModuleVerification(blueprint, { moduleId: 'nope', role: 'tests', status: 'passed' })
  assert.equal(missingModule.ok, false)
  assert.match(missingModule.message, /模块不存在/u)
})

test('tool update preserves previous verification instead of trusting the patch', () => {
  const base = normalizeBlueprint({
    modules: [{
      id: 'api',
      name: 'API',
      verification: { tests: { status: 'passed', evidence: ['unit'] } },
    }],
  })

  const merged = mergeBlueprintForUpdate(base, {
    modules: [
      { id: 'api', name: 'API v2', verification: allPassed(['forged']) },
      { id: 'new', name: 'New', verification: allPassed(['forged']) },
    ],
  })

  const api = merged.modules.find(module => module.id === 'api')
  assert.equal(api.name, 'API v2')
  assert.equal(api.verification.tests.status, 'passed')
  assert.deepEqual(api.verification.tests.evidence, ['unit'], 'patch evidence must be discarded')
  assert.equal(api.verification.reviewer.status, 'pending')

  const added = merged.modules.find(module => module.id === 'new')
  assert.equal(added.verification.tests.status, 'pending')
  assert.deepEqual(added.verification.tests.evidence, [])
})

test('module-verification-incomplete flags done modules without all three passes', () => {
  const done = verification => analyzeBlueprint({
    layers: [{ id: 'A', title: '总览' }],
    modules: [{ id: 'api', name: 'API', layerId: 'A', code: 'A1', acceptance: ['login works'], status: 'done', verification }],
  })

  const normalizedPending = done({ tests: PASSED, reviewer: PENDING, human: PENDING })
  const flagged = verificationIssues(normalizedPending)
  assert.equal(flagged.length, 1)
  assert.equal(flagged[0].severity, 'error')
  assert.equal(flagged[0].moduleId, 'api')
  assert.deepEqual(flagged[0].details.notPassed.sort(), ['human', 'reviewer'])

  assert.equal(verificationIssues(done(allPassed())).length, 0)
  // A module with no acceptance criteria is reported once, by module-acceptance-missing.
  const noAcceptance = analyzeBlueprint({
    layers: [{ id: 'A', title: '总览' }],
    modules: [{ id: 'api', name: 'API', layerId: 'A', code: 'A1', status: 'done' }],
  })
  assert.equal(verificationIssues(noAcceptance).length, 0)
  assert.equal(noAcceptance.issues.filter(issue => issue.code === 'module-acceptance-missing').length, 1)

  // Normalization turns a failed layer into needs-rework, so the done-check no longer fires.
  const reworked = normalizeBlueprint({
    modules: [{ id: 'api', name: 'API', status: 'done', acceptance: ['ok'], verification: { reviewer: FAILED } }],
  })
  assert.equal(reworked.modules[0].status, 'needs-rework')
  assert.equal(verificationIssues(analyzeBlueprint(reworked)).length, 0)

  // The new rule is part of the public catalog.
  const catalog = new Map(CHECK_RULES.map(rule => [rule.code, rule]))
  assert.equal(catalog.get('module-verification-incomplete')?.severity, 'error')
  assert.ok(catalog.get('module-acceptance-missing'))
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
  const agent = { id: 'session-accept', session: { header: { cwd, id: 'session-accept' } } }
  return { tools, commands, agent, dispose: () => { for (const dispose of disposers) dispose() } }
}

async function seedBlueprint(cwd, sessionId, input) {
  const file = blueprintAbsolutePath(cwd, sessionId)
  const blueprint = normalizeBlueprint(input, undefined, { sessionId })
  await writeBlueprintFile(file, blueprint)
  return { file, blueprint }
}

test('/blueprint verify records the three layers, archives and enforces validation', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-blueprint-verify-'))
  try {
    const plugin = setupPlugin(cwd)
    const handler = plugin.commands[0].handler
    const { file } = await seedBlueprint(cwd, plugin.agent.id, {
      title: 'Verify command',
      modules: [{ id: 'api', name: 'API', acceptance: ['login works'] }],
    })

    const first = await handler({ rawInput: 'verify api tests passed npm test', agent: plugin.agent })
    assert.equal(first.kind, 'success')
    const firstPayload = JSON.parse(first.text)
    assert.equal(firstPayload.ok, true)
    assert.equal(firstPayload.moduleId, 'api')
    assert.equal(firstPayload.role, 'tests')
    assert.equal(firstPayload.status, 'passed')
    assert.equal(firstPayload.moduleStatus, 'pending')
    assert.deepEqual(firstPayload.evidence, ['npm test'])
    assert.equal(typeof firstPayload.at, 'number')
    assert.equal(firstPayload.path, '.dsh/blueprints/session-accept.json')

    const reviewer = await handler({ rawInput: 'verify api reviewer passed looks good', agent: plugin.agent })
    assert.equal(JSON.parse(reviewer.text).moduleStatus, 'pending')
    const human = await handler({ rawInput: 'verify api human passed signed off by QA', agent: plugin.agent })
    assert.equal(JSON.parse(human.text).moduleStatus, 'done')

    let onDisk = await readBlueprintFile(file)
    assert.equal(onDisk.modules[0].status, 'done')
    assert.deepEqual(onDisk.modules[0].verification.tests.evidence, ['npm test'])
    assert.deepEqual(onDisk.modules[0].verification.reviewer.evidence, ['looks good'])
    assert.equal(onDisk.modules[0].verification.human.status, 'passed')
    const versions = JSON.parse(await fs.readFile(path.join(cwd, '.dsh', 'blueprints', 'session-accept.versions', 'index.json'), 'utf8'))
    assert.ok(versions.versions.length >= 1, 'verify writes archive a version')

    const snapshot = JSON.stringify(onDisk)
    for (const [line, pattern] of [
      ['verify api qa passed', /验证角色无效/u],
      ['verify api tests okay', /验证状态无效/u],
      ['verify ghost tests passed', /模块不存在/u],
      ['verify', /参数不足/u],
    ]) {
      const result = await handler({ rawInput: line, agent: plugin.agent })
      assert.equal(result.kind, 'error', line)
      assert.match(result.text, pattern, line)
    }
    assert.equal(JSON.stringify(await readBlueprintFile(file)), snapshot, 'failed verify commands never write')

    // Agent update cannot forge a failed verification or reset evidence.
    const tool = plugin.tools[0]
    await tool.execute({
      action: 'update',
      blueprint: { modules: [{ id: 'api', name: 'API', acceptance: ['login works'], verification: { tests: { status: 'failed' } } }] },
    }, { agent: plugin.agent })
    onDisk = await readBlueprintFile(file)
    assert.equal(onDisk.modules[0].verification.tests.status, 'passed')
    assert.deepEqual(onDisk.modules[0].verification.tests.evidence, ['npm test'])
    assert.equal(onDisk.modules[0].status, 'done')

    plugin.dispose()
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})
