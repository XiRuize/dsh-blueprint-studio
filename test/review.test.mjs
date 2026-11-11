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
  REVIEW_GAP_CODES,
  REVIEW_MAX_BYTES,
  ReviewTooLargeError,
  buildHandoff,
  buildReviewPacket,
  exportReviewHtml,
} from '../lib/review.js'
import { apply } from '../index.js'

const NOW = 1_700_000_000_000
const MALICIOUS_TITLE = '支付评审 </script><script>alert("title")</script> & "Beta"'

function normalize(input) {
  return normalizeBlueprint(input, undefined, { sessionId: 'review-session' })
}

function fixture() {
  return normalize({
    title: MALICIOUS_TITLE,
    status: 'confirmed',
    layers: [
      { letter: 'A', title: '总览' },
      { letter: 'B', title: '认证', parentModuleId: 'api' },
    ],
    mounts: [
      { id: 'main', label: 'Main', root: 'src', vcs: 'git', ref: 'main-ref' },
      { id: 'snap', label: 'Snapshot', root: '../snapshots/a', kind: 'snapshot', ref: 'snap-ref' },
      { id: 'ro', label: 'Docs', root: 'docs', access: 'ro' },
    ],
    modules: [
      {
        id: 'api',
        name: 'API 网关',
        acceptance: ['响应 < 100ms', '覆盖 & 边界'],
        mountIds: ['main', 'snap'],
        execution: {
          adapter: 'cli',
          cwd: 'src',
          commands: ['node --test', 'git status'],
          allow: ['read', 'write-src'],
          agentProfile: 'implementer',
          storage: { kind: 'fs', ref: 'artifacts' },
        },
        dependsOn: ['auth'],
      },
      {
        id: 'auth',
        name: '认证模块',
        layerId: 'B',
        acceptance: ['登录成功'],
        mountIds: ['main'],
        execution: {
          adapter: 'http',
          endpointRef: 'env:AUTH_ENDPOINT',
          storage: { kind: 'object', ref: 'bucket/auth' },
        },
      },
    ],
    sections: [
      {
        key: 'goals',
        items: [
          { id: 'g1', text: '完成 <登录> & 注册', moduleId: 'api', code: 'R1' },
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
          { id: 'u1', type: 'actor', label: '用户 <script>alert(1)</script>' },
          { id: 'u2', type: 'usecase', label: '登录' },
        ],
        edges: [{ id: 'e1', from: 'u1', to: 'u2', label: '发起 & 登录', kind: 'association' }],
      },
      {
        layerId: 'B',
        type: 'dfd',
        nodes: [
          { id: 'p1', type: 'process', label: '校验' },
          { id: 'p2', type: 'store', label: '会话' },
        ],
        edges: [{ id: 'be1', from: 'p1', to: 'p2', label: '写入', kind: 'data' }],
      },
    ],
    runs: [
      {
        id: 'run-manual',
        moduleId: 'api',
        mountIds: ['main'],
        adapter: 'manual',
        status: 'failed',
        startedAt: NOW,
        evidence: [{ at: NOW, text: 'partial write' }],
        error: 'tests failed',
        rollback: { instructions: ['将挂载 main 恢复到 main-ref'] },
      },
      {
        id: 'run-cli',
        moduleId: 'api',
        mountIds: ['main'],
        adapter: 'cli',
        status: 'running',
        startedAt: NOW + 1,
        leaseUntil: NOW + 60_000,
        evidence: [{ at: NOW + 1, text: 'started' }],
        nextAction: '跑集成测试',
      },
      {
        id: 'run-http',
        moduleId: 'auth',
        mountIds: ['main'],
        adapter: 'http',
        status: 'running',
        startedAt: NOW + 2,
        leaseUntil: NOW + 60_000,
        evidence: [],
      },
      {
        id: 'run-sub',
        moduleId: 'auth',
        mountIds: ['main'],
        adapter: 'dsh-subagent',
        status: 'blocked',
        startedAt: NOW + 3,
        evidence: [{ at: NOW + 3, text: 'waiting' }],
      },
    ],
  })
}

function gapFixture() {
  const future = Date.now() + 60_000
  const past = Date.now() - 60_000
  return normalize({
    title: 'Gap fixture',
    mounts: [
      { id: 'main', label: 'Main', root: 'src' },
      { id: 'nested', label: 'Nested', root: 'src/nested' },
      { id: 'unsafe', label: 'Unsafe', root: '/absolute/path' },
      { id: 'ro', label: 'Read only', root: 'docs', access: 'ro' },
    ],
    modules: [
      {
        id: 'api',
        name: 'API',
        acceptance: ['ok'],
        mountIds: ['main', 'ro'],
        execution: { adapter: 'cli', commands: ['npm test'] },
      },
      { id: 'm2', name: 'M2', mountIds: ['main'], acceptance: ['ok'] },
      { id: 'm3', name: 'M3', mountIds: ['main'], acceptance: ['ok'] },
      { id: 'm4', name: 'M4', mountIds: ['main'] },
      { id: 'm5', name: 'M5', mountIds: ['main'], acceptance: ['ok'] },
      { id: 'm6', name: 'M6', mountIds: ['main'], acceptance: ['ok'] },
    ],
    sections: [
      { key: 'goals', items: [{ id: 'g1', text: '未归属需求' }, { id: 'g2', text: '归属需求', moduleId: 'api' }] },
    ],
    diagrams: [
      {
        layerId: 'A',
        type: 'usecase',
        nodes: [{ id: 'u1', type: 'usecase', label: '孤立用例' }],
        edges: [],
      },
    ],
    runs: [
      { id: 'run-conflict-a', moduleId: 'api', mountIds: ['main'], adapter: 'cli', status: 'running', startedAt: 1, leaseUntil: future, evidence: [] },
      { id: 'run-conflict-b', moduleId: 'm2', mountIds: ['main'], adapter: 'cli', status: 'running', startedAt: 2, leaseUntil: future, evidence: [] },
      { id: 'run-expired', moduleId: 'm3', mountIds: ['nested'], adapter: 'cli', status: 'running', startedAt: 3, leaseUntil: past, evidence: [] },
      { id: 'run-done', moduleId: 'm5', mountIds: [], adapter: 'cli', status: 'done', startedAt: 4, evidence: [] },
      { id: 'run-failed', moduleId: 'm6', mountIds: [], adapter: 'cli', status: 'failed', startedAt: 5, evidence: [] },
    ],
  })
}

test('review packet has the documented shape, stable ordering and deterministic generatedAt', () => {
  const blueprint = fixture()
  const before = JSON.stringify(blueprint)
  const packet = buildReviewPacket(blueprint)

  assert.equal(packet.title, MALICIOUS_TITLE)
  assert.equal(packet.status, 'confirmed')
  assert.equal(packet.generatedAt, blueprint.updatedAt)
  assert.deepEqual(packet.summary, {
    layers: 2,
    modules: 2,
    requirements: 3,
    diagrams: 2,
    mounts: 3,
    runs: 4,
    activeRuns: 2,
    openGaps: packet.gaps.length,
  })

  assert.equal(packet.requirements.sections.length, 7)
  assert.deepEqual(
    packet.requirements.sections.slice(0, 3).map(section => section.key),
    ['goals', 'actors', 'functional'],
  )
  assert.deepEqual(packet.requirements.sections[0].items[0], {
    code: 'R1',
    uid: 'goals:g1',
    text: '完成 <登录> & 注册',
    moduleCode: 'A1',
    moduleName: 'API 网关',
  })
  assert.equal(packet.requirements.sections[0].items[1].moduleCode, '')
  assert.equal(packet.requirements.sections[2].items[0].code, 'R3')

  // Modules are ordered by code; codes come from normalization (A1, B1).
  assert.deepEqual(packet.modules.map(module => module.code), ['A1', 'B1'])
  const api = packet.modules[0]
  assert.equal(api.id, 'api')
  assert.equal(api.layer, 'A')
  assert.equal(api.adapter, 'cli')
  assert.equal(api.activeRunId, 'run-cli')
  assert.deepEqual(api.mountIds, ['main', 'snap'])
  assert.deepEqual(api.verification.tests, { status: 'pending', evidence: [] })
  assert.equal(packet.modules[1].activeRunId, 'run-http')

  assert.deepEqual(packet.mounts.map(mount => mount.id), ['main', 'ro', 'snap'])
  assert.deepEqual(packet.mounts[0].boundModules, ['A1', 'B1'])
  assert.deepEqual(packet.mounts[1].boundModules, [])
  assert.equal(packet.mounts[2].kind, 'snapshot')
  assert.equal(packet.mounts[2].ref, 'snap-ref')

  assert.deepEqual(packet.diagrams.map(diagram => diagram.key), ['usecase', 'B:dfd'])
  assert.equal(packet.diagrams[0].nodeCount, 2)
  assert.equal(packet.diagrams[0].edgeCount, 1)
  assert.match(packet.diagrams[0].mermaid, /^flowchart LR/)
  assert.match(packet.diagrams[0].mermaid, /u1 -->\|发起 & 登录\| u2/)
  assert.match(packet.diagrams[1].mermaid, /^flowchart LR/)

  assert.deepEqual(packet.runs.map(run => run.id), ['run-manual', 'run-cli', 'run-http', 'run-sub'])
  assert.equal(packet.runs[0].moduleCode, 'A1')
  assert.equal(packet.runs[0].evidenceCount, 1)
  assert.deepEqual(packet.runs[0].rollbackInstructions, ['将挂载 main 恢复到 main-ref'])
  assert.equal(packet.runs[1].nextAction, '跑集成测试')
  assert.equal(packet.runs[2].leaseUntil, NOW + 60_000)
  assert.equal(packet.runs[3].leaseUntil, null)

  // Deterministic: a second call is deeply equal, and the input is untouched.
  assert.deepEqual(buildReviewPacket(blueprint), packet)
  assert.equal(JSON.stringify(blueprint), before)
})

test('review packet degrades gracefully for empty and malformed blueprints', () => {
  const empty = buildReviewPacket(normalize({}))
  assert.equal(empty.title, '工程蓝图')
  assert.equal(empty.summary.layers, 1)
  assert.equal(empty.summary.modules, 0)
  assert.equal(empty.summary.requirements, 0)
  assert.equal(empty.summary.diagrams, 8)
  assert.equal(empty.summary.mounts, 0)
  assert.equal(empty.summary.runs, 0)
  assert.equal(empty.summary.activeRuns, 0)
  assert.equal(empty.requirements.sections.length, 7)
  assert.equal(empty.requirements.sections.every(section => section.items.length === 0), true)
  assert.deepEqual(empty.modules, [])

  for (const input of [
    null,
    undefined,
    {},
    { modules: 'nope', sections: null, mounts: 42, runs: [null, 'x'] },
    { sections: [{ key: 7, items: [null, 3, { id: 'i1' }, { text: 'ok' }] }] },
    { diagrams: [{ key: 42, nodes: null, edges: 'x' }], layers: 'nope' },
    { runs: [{ id: 'r1', moduleId: 'ghost', evidence: 'not-an-array', rollback: 'x' }] },
  ]) {
    const packet = buildReviewPacket(input)
    assert.equal(typeof packet.title, 'string')
    assert.ok(Array.isArray(packet.modules))
    assert.ok(Array.isArray(packet.mounts))
    assert.ok(Array.isArray(packet.diagrams))
    assert.ok(Array.isArray(packet.runs))
    assert.ok(Array.isArray(packet.gaps))
    assert.ok(Array.isArray(packet.nextActions))
    assert.ok(Array.isArray(packet.requirements.sections))
  }
})

test('review gaps keep only review-relevant self-check rules', () => {
  const packet = buildReviewPacket(gapFixture())
  const codes = new Set(packet.gaps.map(gap => gap.code))
  for (const code of [
    'requirement-unassigned',
    'module-acceptance-missing',
    'mount-path-unsafe',
    'mount-overlap',
    'mount-readonly-write',
    'run-mount-conflict',
    'run-lease-expired',
    'run-evidence-missing',
    'run-rollback-missing',
    'layer-flat-complex',
  ]) {
    assert.ok(codes.has(code), `missing gap ${code}`)
  }
  // Diagram-shape warnings are intentionally not part of the review report.
  assert.equal(codes.has('node-isolated'), false)
  assert.equal(packet.gaps.every(gap => REVIEW_GAP_CODES.includes(gap.code)), true)
  assert.equal(packet.summary.openGaps, packet.gaps.length)

  // Severity order is error, warn, info; every gap is a plain projection.
  const ranks = { error: 0, warn: 1, info: 2 }
  for (let index = 1; index < packet.gaps.length; index += 1) {
    assert.ok(ranks[packet.gaps[index - 1].severity] <= ranks[packet.gaps[index].severity])
  }
  const conflict = packet.gaps.find(gap => gap.code === 'run-mount-conflict')
  assert.equal(conflict.severity, 'error')
  assert.equal(conflict.mountId, 'main')
})

test('nextActions cover active runs, failed rollback, unbound modules and unverified modules', () => {
  const packet = buildReviewPacket(fixture())
  const actions = packet.nextActions

  assert.ok(actions.some(action => action.runId === 'run-cli' && /跑集成测试/u.test(action.text)))
  assert.ok(actions.some(action =>
    action.runId === 'run-http'
    && /run-http/u.test(action.text)
    && /evidence/u.test(action.text)))
  assert.ok(actions.some(action =>
    action.runId === 'run-manual'
    && /回滚/u.test(action.text)
    && /main-ref/u.test(action.text)))
  assert.ok(actions.some(action => action.moduleCode === 'A1' && /mount/u.test(action.text) === false))
  assert.ok(actions.some(action => action.moduleCode === 'B1' && /分层验收/u.test(action.text)))

  // Every module without mounts yields a binding action; the fixture modules all
  // have mounts, so the count of those actions is zero.
  assert.equal(actions.some(action => /绑定任何 mount/u.test(action.text)), false)

  const unbound = buildReviewPacket(normalize({
    mounts: [{ id: 'main', root: 'src' }],
    modules: [{ id: 'api', name: 'API', acceptance: ['ok'] }],
  }))
  assert.ok(unbound.nextActions.some(action => action.moduleCode === 'A1' && /绑定任何 mount/u.test(action.text)))

  // Failed runs without rollback instructions ask for them instead of inventing one.
  const noRollback = buildReviewPacket(normalize({
    modules: [{ id: 'api', name: 'API', acceptance: ['ok'] }],
    runs: [{ id: 'run-failed', moduleId: 'api', status: 'failed', adapter: 'cli', startedAt: 1, evidence: [] }],
  }))
  assert.ok(noRollback.nextActions.some(action =>
    action.runId === 'run-failed' && /rollback\.instructions/u.test(action.text)))
})

test('buildHandoff supports all four adapters, stays advisory and leaks no secrets', () => {
  const blueprint = fixture()
  const manual = buildHandoff(blueprint, 'run-manual')
  assert.equal(manual.mode, 'manual')
  assert.equal(manual.adapter, 'manual')
  assert.equal(manual.auto, false)
  assert.equal(manual.moduleCode, 'A1')
  assert.equal(manual.cwd, 'src')
  assert.equal(manual.storage.kind, 'fs')
  assert.deepEqual(manual.commands, ['node --test', 'git status'])
  assert.match(manual.steps.join('\n'), /手动模式/u)
  assert.match(manual.steps.join('\n'), /不会自动执行/u)
  assert.doesNotMatch(manual.steps.join('\n'), /^cd /u)

  const cli = buildHandoff(blueprint, 'run-cli')
  assert.equal(cli.mode, 'cli')
  assert.equal(cli.auto, false)
  assert.ok(cli.steps.includes('cd src'))
  assert.ok(cli.steps.includes('node --test'))
  assert.match(cli.steps.join('\n'), /不会执行任何命令/u)

  const http = buildHandoff(blueprint, 'run-http')
  assert.equal(http.mode, 'http')
  assert.equal(http.endpointRef, 'env:AUTH_ENDPOINT')
  assert.deepEqual(http.storage, { kind: 'object', ref: 'bucket/auth' })
  assert.match(http.steps.join('\n'), /不生成请求体/u)
  assert.match(http.steps.join('\n'), /env:AUTH_ENDPOINT/u)
  for (const key of ['body', 'requestBody', 'headers', 'secret', 'secrets', 'password', 'token']) {
    assert.equal(Object.hasOwn(http, key), false, key)
  }

  const sub = buildHandoff(blueprint, 'run-sub')
  assert.equal(sub.mode, 'dsh-subagent')
  assert.equal(sub.auto, false)
  assert.match(sub.steps.join('\n'), /不自动 spawn/u)
  assert.match(sub.steps.join('\n'), /不自动 spawn/u)

  // Raw execution extras (including secrets) never reach the handoff.
  const withSecret = normalize({
    modules: [{
      id: 'api',
      name: 'API',
      acceptance: ['ok'],
      execution: {
        adapter: 'http',
        endpointRef: 'env:SAFE_REF',
        apiKey: 'super-secret-key',
        headers: { authorization: 'Bearer super-secret-token' },
        storage: { kind: 'fs', ref: 'artifacts', token: 'storage-secret' },
      },
    }],
    runs: [{ id: 'run-http', moduleId: 'api', adapter: 'http', status: 'running', startedAt: 1, evidence: [] }],
  })
  const secretHandoff = buildHandoff(withSecret, 'run-http')
  const serialized = JSON.stringify(secretHandoff)
  assert.doesNotMatch(serialized, /super-secret/u)
  assert.doesNotMatch(serialized, /storage-secret/u)

  assert.equal(buildHandoff(blueprint, 'run-missing'), undefined)
  assert.equal(buildHandoff(blueprint, ''), undefined)
  assert.equal(buildHandoff(null, 'run-cli'), undefined)

  // A run whose module was deleted has no handoff target.
  const orphan = normalize({
    runs: [{ id: 'run-orphan', moduleId: 'ghost', adapter: 'cli', status: 'running', startedAt: 1, evidence: [] }],
  })
  assert.equal(buildHandoff(orphan, 'run-orphan'), undefined)
})

test('handoff warnings flag missing mounts, empty cwd and failed runs without rollback', () => {
  const blueprint = normalize({
    modules: [{ id: 'api', name: 'API', acceptance: ['ok'], execution: { adapter: 'cli' } }],
    runs: [
      { id: 'run-cli', moduleId: 'api', adapter: 'cli', status: 'running', startedAt: 1, evidence: [] },
      { id: 'run-failed', moduleId: 'api', adapter: 'cli', status: 'failed', startedAt: 2, evidence: [] },
    ],
  })
  const cli = buildHandoff(blueprint, 'run-cli')
  assert.ok(cli.warnings.some(warning => /没有绑定任何工作挂载/u.test(warning)))
  assert.ok(cli.warnings.some(warning => /没有可用的 cwd/u.test(warning)))
  assert.ok(cli.warnings.some(warning => /没有建议命令/u.test(warning)))

  const failed = buildHandoff(blueprint, 'run-failed')
  assert.ok(failed.warnings.some(warning => /没有回滚说明/u.test(warning)))
  assert.equal(failed.auto, false)
})

test('review HTML is a single offline document with escaping, sections and print CSS', () => {
  const html = exportReviewHtml(fixture())

  assert.match(html, /^<!DOCTYPE html>/)
  assert.match(html, /<html lang="zh-CN">/)
  assert.match(html, /<meta name="viewport"/)
  assert.match(html, /id="requirements"/)
  assert.match(html, /id="modules"/)
  assert.match(html, /id="mounts"/)
  assert.match(html, /id="diagrams"/)
  assert.match(html, /id="runs"/)
  assert.match(html, /id="gaps"/)
  assert.match(html, /id="next-actions"/)
  assert.match(html, /class="stat"/)
  assert.match(html, /<pre class="mermaid-source"><code>/)
  assert.match(html, /@media print/)
  assert.match(html, /prefers-color-scheme: dark/)
  assert.match(html, /@media \(max-width: 760px\)/)
  assert.match(html, /状态：<span class="status status-confirmed">confirmed<\/span>/)
  assert.match(html, /未记录|生成时间/)

  // No scripts, no external resources, no links at all.
  assert.doesNotMatch(html, /<script/i)
  assert.doesNotMatch(html, /<link\b/i)
  assert.doesNotMatch(html, /<img\b/i)
  assert.doesNotMatch(html, /https?:\/\//i)
  assert.doesNotMatch(html, /\bsrc=/i)
  assert.doesNotMatch(html, /@import/i)

  // All user text is escaped, including </script>, & and quotes in the title.
  assert.match(html, /支付评审 &lt;\/script&gt;&lt;script&gt;alert\(&quot;title&quot;\)&lt;\/script&gt; &amp; &quot;Beta&quot;/)
  assert.match(html, /用户 &lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(html, /覆盖 &amp; 边界/)
  assert.match(html, /发起 &amp; 登录/)
  assert.doesNotMatch(html, /<script>alert/)
  assert.doesNotMatch(html, /<\/script><script>alert/)
})

test('review HTML rejects pages above 5MB with a typed readable error', () => {
  const blueprint = normalize({ title: 'X'.repeat(REVIEW_MAX_BYTES + 1) })
  assert.throws(
    () => exportReviewHtml(blueprint),
    error => {
      assert.ok(error instanceof ReviewTooLargeError)
      assert.equal(error.name, 'ReviewTooLargeError')
      assert.equal(error.code, 'review-too-large')
      assert.ok(error.size > REVIEW_MAX_BYTES)
      assert.equal(error.limit, REVIEW_MAX_BYTES)
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
  const agent = { id: 'session-review', session: { header: { cwd, id: 'session-review' } } }
  return { tools, commands, agent, dispose: () => { for (const dispose of disposers) dispose() } }
}

async function seedBlueprint(cwd, sessionId, input) {
  const file = blueprintAbsolutePath(cwd, sessionId)
  const blueprint = normalizeBlueprint(input, undefined, { sessionId })
  await writeBlueprintFile(file, blueprint)
  return { file, blueprint }
}

function commandInput(input) {
  return {
    title: 'Review command',
    mounts: [{ id: 'main', label: 'Main', root: 'src' }],
    modules: [
      {
        id: 'api',
        name: 'API',
        mountIds: ['main'],
        acceptance: ['ok'],
        execution: { adapter: 'cli', cwd: 'src', commands: ['node --test'] },
      },
      {
        id: 'docs',
        name: 'Docs',
        mountIds: ['main'],
        acceptance: ['ok'],
        execution: { adapter: 'http', endpointRef: 'env:DOCS_ENDPOINT', storage: { kind: 'fs' } },
      },
    ],
    sections: [{ key: 'goals', items: [{ id: 'g1', text: '目标', moduleId: 'api' }] }],
    runs: [
      { id: 'run-cli', moduleId: 'api', mountIds: ['main'], adapter: 'cli', status: 'running', startedAt: NOW, leaseUntil: NOW + 60_000, evidence: [{ at: NOW, text: 'started' }] },
      { id: 'run-http', moduleId: 'docs', mountIds: ['main'], adapter: 'http', status: 'blocked', startedAt: NOW + 1, evidence: [] },
      { id: 'run-failed', moduleId: 'api', adapter: 'manual', status: 'failed', startedAt: NOW + 2, evidence: [], rollback: { instructions: ['恢复 src'] } },
    ],
    ...input,
  }
}

test('/blueprint review, review html and review handoff are read-only end-to-end', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-blueprint-review-'))
  try {
    const plugin = setupPlugin(cwd)
    const handler = plugin.commands[0].handler
    const hint = plugin.commands[0].input.hint
    assert.match(hint, /review handoff <runId>/u)

    const { file } = await seedBlueprint(cwd, plugin.agent.id, commandInput())
    const diskBefore = JSON.stringify(await readBlueprintFile(file))

    const reviewed = await handler({ rawInput: 'review', agent: plugin.agent })
    assert.equal(reviewed.kind, 'success')
    const packet = JSON.parse(reviewed.text)
    assert.equal(packet.title, 'Review command')
    assert.deepEqual(packet.runs.map(run => run.id), ['run-cli', 'run-http', 'run-failed'])
    assert.equal(packet.summary.activeRuns, 1)

    const html = await handler({ rawInput: 'review html', agent: plugin.agent })
    assert.equal(html.kind, 'success')
    assert.match(html.text, /^<!DOCTYPE html>/)
    assert.match(html.text, /id="runs"/)

    const handoff = await handler({ rawInput: 'review handoff run-cli', agent: plugin.agent })
    assert.equal(handoff.kind, 'success')
    const handoffPayload = JSON.parse(handoff.text)
    assert.equal(handoffPayload.runId, 'run-cli')
    assert.equal(handoffPayload.mode, 'cli')
    assert.equal(handoffPayload.auto, false)
    assert.ok(handoffPayload.steps.includes('cd src'))

    const manual = await handler({ rawInput: 'review handoff run-failed', agent: plugin.agent })
    assert.equal(manual.kind, 'success')
    assert.equal(JSON.parse(manual.text).mode, 'manual')

    const http = await handler({ rawInput: 'review handoff run-http', agent: plugin.agent })
    assert.equal(http.kind, 'success')
    assert.equal(JSON.parse(http.text).mode, 'http')

    for (const [line, pattern] of [
      ['review nope', /用法/u],
      ['review handoff', /用法/u],
      ['review handoff run-cli extra', /用法/u],
      ['review handoff run-missing', /不存在/u],
      ['review html extra', /用法/u],
    ]) {
      const failed = await handler({ rawInput: line, agent: plugin.agent })
      assert.equal(failed.kind, 'error', line)
      assert.match(failed.text, pattern, line)
    }

    const fallback = await handler({ rawInput: 'unknown-command', agent: plugin.agent })
    assert.equal(fallback.kind, 'error')
    assert.match(fallback.text, /review handoff <runId>/u)

    // Read-only: neither the blueprint JSON nor the version archive changed.
    assert.equal(JSON.stringify(await readBlueprintFile(file)), diskBefore)
    const versionsDir = path.join(cwd, '.dsh', 'blueprints', 'session-review.versions')
    await assert.rejects(fs.access(versionsDir), error => error.code === 'ENOENT')

    // A different session with no blueprint gets a readable error, not a crash.
    const emptyAgent = { id: 'session-empty', session: { header: { cwd, id: 'session-empty' } } }
    for (const line of ['review', 'review html', 'review handoff run-cli']) {
      const failed = await handler({ rawInput: line, agent: emptyAgent })
      assert.equal(failed.kind, 'error')
      assert.match(failed.text, /还没有工程蓝图/u)
    }

    plugin.dispose()
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})
