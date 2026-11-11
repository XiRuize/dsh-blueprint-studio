import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BLUEPRINT_LIMITS,
  BlueprintValidationError,
  buildDispatchPacket,
  mergeBlueprintForUpdate,
  normalizeBlueprint,
} from '../lib/blueprint.js'
import { CHECK_RULES, analyzeBlueprint } from '../lib/checks.js'

function normalized(input, previous) {
  return normalizeBlueprint(input, previous, { sessionId: 'workspace-session' })
}

function issuesWithCode(result, code) {
  return result.issues.filter(issue => issue.code === code)
}

function hasCode(result, code) {
  return result.issues.some(issue => issue.code === code)
}

function expectValidationError(run, pattern) {
  assert.throws(run, error => {
    assert.ok(error instanceof BlueprintValidationError, `expected BlueprintValidationError, got ${error}`)
    assert.match(error.message, pattern)
    return true
  })
}

test('normalizes mount defaults, kind/access/readOnly derivation and extra fields', () => {
  const blueprint = normalized({
    title: 'Mounts',
    mounts: [
      { id: 'main', label: 'Main', root: 'src', vcs: 'git' },
      { id: 'snap_1', label: 'Snap', root: '../snapshots/a', kind: 'snapshot', ref: ' ref-1 ', readOnly: false },
      {
        id: 'archive-1',
        label: 'Archive',
        root: 'archives/a',
        kind: 'archive',
        access: 'ro',
        checksum: ' sha256:abc ',
        notes: ' keep ',
        extra: { ticket: 'T-1' },
      },
    ],
  })

  assert.deepEqual(blueprint.mounts.map(mount => mount.id), ['main', 'snap_1', 'archive-1'])
  assert.deepEqual(blueprint.mounts[0], {
    id: 'main',
    label: 'Main',
    root: 'src',
    kind: 'working',
    access: 'rw',
    readOnly: false,
    vcs: 'git',
  })
  assert.equal(blueprint.mounts[1].kind, 'snapshot')
  assert.equal(blueprint.mounts[1].access, 'rw')
  assert.equal(blueprint.mounts[1].readOnly, true)
  assert.equal(blueprint.mounts[1].ref, 'ref-1')
  assert.equal(blueprint.mounts[2].kind, 'archive')
  assert.equal(blueprint.mounts[2].access, 'ro')
  assert.equal(blueprint.mounts[2].readOnly, true)
  assert.equal(blueprint.mounts[2].checksum, 'sha256:abc')
  assert.equal(blueprint.mounts[2].notes, 'keep')
  assert.deepEqual(blueprint.mounts[2].extra, { ticket: 'T-1' })

  // An empty/legacy blueprint still exposes an empty mounts array.
  assert.deepEqual(normalized({ title: 'Legacy' }).mounts, [])
})

test('normalizes unknown kind/access/vcs to defaults and processes readOnly:true', () => {
  const blueprint = normalized({
    mounts: [
      { id: 'odd', root: 'x', kind: 'weird', access: 'write', vcs: 'svn' },
      { id: 'marked', root: 'y', readOnly: true },
    ],
  })
  const [odd, marked] = blueprint.mounts
  assert.equal(odd.kind, 'working')
  assert.equal(odd.access, 'rw')
  assert.equal(odd.readOnly, false)
  assert.equal(odd.vcs, undefined)
  assert.equal(marked.readOnly, true)
})

test('drops invalid or duplicate mount ids instead of renaming referenced ids', () => {
  const blueprint = normalized({
    mounts: [
      { id: 'ok', root: 'a' },
      { id: 'ok', root: 'b' },
      { id: '1bad', root: 'c' },
      { id: '', root: 'd' },
      null,
      'bare string',
      { id: 'dash-id', root: 'e' },
    ],
  })
  assert.deepEqual(blueprint.mounts.map(mount => [mount.id, mount.root]), [['ok', 'a'], ['dash-id', 'e']])
})

test('enforces mount and per-module mount limits', () => {
  const mounts = Array.from({ length: BLUEPRINT_LIMITS.mounts + 1 }, (_, index) => ({
    id: `m${index + 1}`,
    root: `root-${index + 1}`,
  }))
  expectValidationError(() => normalized({ mounts }), /挂载 101 > 100/u)

  const mountIds = Array.from({ length: BLUEPRINT_LIMITS.moduleMounts + 1 }, (_, index) => `m${index + 1}`)
  expectValidationError(
    () => normalized({ modules: [{ id: 'api', name: 'API', mountIds }] }),
    /挂载引用 17 > 16/u,
  )
})

test('normalizes workspaceSnapshot strings and keeps it across omitted updates', () => {
  const first = normalized({
    mounts: [{ id: 'main', root: 'src' }],
    workspaceSnapshot: { main: ' sha:1 ', blank: '   ', missing: '' },
  })
  assert.deepEqual(first.workspaceSnapshot, { main: 'sha:1' })

  const inherited = normalized({ title: 'Update without snapshot' }, first)
  assert.deepEqual(inherited.workspaceSnapshot, { main: 'sha:1' })

  const cleared = mergeBlueprintForUpdate(first, { workspaceSnapshot: {} })
  assert.equal(cleared.workspaceSnapshot, undefined)

  assert.equal(normalized({ title: 'No snapshot' }).workspaceSnapshot, undefined)
})

test('normalizes module mountIds and execution fields', () => {
  const blueprint = normalized({
    modules: [
      {
        id: 'api',
        name: 'API',
        mountIds: [' main ', 'main', 'snap', ''],
        execution: {
          adapter: 'CLI',
          cwd: '  worktrees/api  ',
          allow: [' read ', 'read', ''],
          commands: ['npm test', 'npm test', 42],
          agentProfile: ' reviewer ',
          endpointRef: ' endpoint-1 ',
          storage: { kind: 'GIT', ref: ' main ' },
        },
      },
      { id: 'plain', name: 'Plain' },
    ],
  })
  const api = blueprint.modules.find(module => module.id === 'api')
  const plain = blueprint.modules.find(module => module.id === 'plain')

  assert.deepEqual(api.mountIds, ['main', 'snap'])
  assert.deepEqual(api.execution, {
    adapter: 'cli',
    allow: ['read'],
    commands: ['npm test'],
    cwd: 'worktrees/api',
    agentProfile: 'reviewer',
    endpointRef: 'endpoint-1',
    storage: { kind: 'git', ref: 'main' },
  })

  assert.deepEqual(plain.mountIds, [])
  assert.equal(plain.execution, undefined)

  const minimal = normalized({ modules: [{ id: 'min', name: 'Min', execution: {} }] }).modules[0]
  assert.deepEqual(minimal.execution, { adapter: 'dsh-subagent', allow: [], commands: [] })

  const fallback = normalized({
    modules: [{
      id: 'fallback',
      name: 'Fallback',
      execution: { adapter: 'unknown', storage: { kind: 'weird' } },
    }],
  }).modules[0]
  assert.equal(fallback.execution.adapter, 'dsh-subagent')
  assert.deepEqual(fallback.execution.storage, { kind: 'fs' })
})

test('mergeBlueprintForUpdate merges mounts by id, applies removedMountIds and keeps module wiring', () => {
  const base = normalized({
    title: 'Merge',
    mounts: [
      { id: 'main', label: 'Main', root: 'src', vcs: 'git' },
      { id: 'docs', label: 'Docs', root: 'docs' },
    ],
    workspaceSnapshot: { main: ' commit-1 ' },
    modules: [{
      id: 'api',
      name: 'API',
      mountIds: ['main'],
      execution: { adapter: 'cli', allow: ['read'] },
      acceptance: ['tests pass'],
    }],
  })

  const merged = mergeBlueprintForUpdate(base, {
    modules: [{ id: 'api', summary: 'changed summary' }],
    mounts: [
      { id: 'docs', label: 'Docs 2' },
      { id: 'new', root: 'new-root', kind: 'snapshot', ref: 'r1' },
    ],
    removedMountIds: ['main'],
    workspaceSnapshot: { new: 'r1' },
  })

  assert.deepEqual(merged.mounts.map(mount => [mount.id, mount.label, mount.root]), [
    ['docs', 'Docs 2', 'docs'],
    ['new', '', 'new-root'],
  ])
  const api = merged.modules.find(module => module.id === 'api')
  assert.equal(api.summary, 'changed summary')
  assert.deepEqual(api.mountIds, ['main'])
  assert.deepEqual(api.execution, { adapter: 'cli', allow: ['read'], commands: [] })
  assert.deepEqual(merged.workspaceSnapshot, { new: 'r1' })

  // An update that omits mounts/modules preserves them; removedMountIds alone deletes.
  const untouched = mergeBlueprintForUpdate(base, { title: 'Renamed' })
  assert.deepEqual(untouched.mounts.map(mount => mount.id), ['main', 'docs'])
  assert.deepEqual(untouched.modules[0].mountIds, ['main'])
  assert.deepEqual(untouched.workspaceSnapshot, { main: 'commit-1' })

  const removedOnly = mergeBlueprintForUpdate(base, { removedMountIds: ['docs'] })
  assert.deepEqual(removedOnly.mounts.map(mount => mount.id), ['main'])

  // Explicit empty arrays still clear.
  const cleared = mergeBlueprintForUpdate(base, { mounts: [] })
  assert.deepEqual(cleared.mounts, [])
})

test('buildDispatchPacket projects mounts, execution, requirements and snapshot for a module', () => {
  const blueprint = normalized({
    title: 'Dispatch',
    layers: [{ letter: 'A' }, { letter: 'B', parentModuleId: 'api' }],
    mounts: [
      { id: 'main', root: 'repo', kind: 'working' },
      { id: 'snap', root: '../snapshots/a', kind: 'snapshot', ref: 'r1' },
    ],
    workspaceSnapshot: { main: 'commit-1', snap: 'r1', unrelated: 'x' },
    sections: [{
      key: 'functional',
      items: [
        { id: 'f1', text: '登录', moduleId: 'api' },
        { id: 'f2', text: '存储', moduleId: 'db' },
      ],
    }],
    modules: [
      {
        id: 'api',
        name: 'API',
        layerId: 'A',
        mountIds: ['main', 'ghost'],
        execution: {
          adapter: 'cli',
          cwd: 'worktrees/api',
          allow: ['read'],
          commands: ['npm test'],
          agentProfile: 'coder',
          storage: { kind: 'git', ref: 'main' },
        },
        acceptance: ['GET /api returns 200'],
        dependsOn: ['db'],
      },
      { id: 'db', name: 'DB', layerId: 'B', mountIds: ['snap'] },
    ],
  })

  const packet = buildDispatchPacket(blueprint, 'api')
  assert.equal(packet.module.id, 'api')
  assert.equal(packet.code, 'A1')
  assert.equal(packet.layer.letter, 'A')
  assert.deepEqual(packet.mounts.map(mount => mount.id), ['main'])
  assert.deepEqual(packet.mountIds, ['main', 'ghost'])
  assert.equal(packet.cwd, 'worktrees/api')
  assert.deepEqual(packet.allow, ['read'])
  assert.deepEqual(packet.commands, ['npm test'])
  assert.equal(packet.agentProfile, 'coder')
  assert.equal(packet.adapter, 'cli')
  assert.deepEqual(packet.storage, { kind: 'git', ref: 'main' })
  assert.deepEqual(packet.requirements, [{ uid: 'functional:f1', text: '登录' }])
  assert.deepEqual(packet.acceptance, ['GET /api returns 200'])
  assert.deepEqual(packet.dependsOn, ['db'])
  assert.deepEqual(packet.snapshot, { main: 'commit-1' })

  // A module object works as well; unknown ids return undefined.
  assert.equal(buildDispatchPacket(blueprint, { id: 'api' }).code, 'A1')
  assert.equal(buildDispatchPacket(blueprint, 'missing'), undefined)
  assert.equal(buildDispatchPacket(blueprint, { id: 'missing' }), undefined)

  // No execution: cwd falls back to the first mount root, optional fields are null/empty.
  const db = buildDispatchPacket(blueprint, 'db')
  assert.equal(db.cwd, '../snapshots/a')
  assert.equal(db.adapter, null)
  assert.equal(db.storage, null)
  assert.deepEqual(db.allow, [])
  assert.deepEqual(db.requirements, [{ uid: 'functional:f2', text: '存储' }])
  assert.deepEqual(db.snapshot, { snap: 'r1' })
})

test('check catalog exposes the workspace rules with fixed severities', () => {
  const expected = {
    'mount-duplicate': 'error',
    'mount-path-missing': 'error',
    'mount-ref-missing': 'error',
    'mount-readonly-write': 'error',
    'mount-path-unsafe': 'warn',
    'mount-overlap': 'warn',
    'mount-snapshot-ref-missing': 'warn',
    'module-mount-missing': 'info',
  }
  for (const [code, severity] of Object.entries(expected)) {
    const rule = CHECK_RULES.find(entry => entry.code === code)
    assert.ok(rule, `missing rule ${code}`)
    assert.equal(rule.severity, severity, code)
  }
})

test('mount-duplicate reports duplicate ids once per id', () => {
  const result = analyzeBlueprint({
    mounts: [
      { id: 'main', root: 'src' },
      { id: 'main', root: 'other' },
      { id: 'docs', root: 'docs' },
    ],
  })
  const issues = issuesWithCode(result, 'mount-duplicate')
  assert.equal(issues.length, 1)
  assert.equal(issues[0].severity, 'error')
  assert.equal(issues[0].mountId, 'main')
  assert.equal(issues[0].details.count, 2)

  assert.equal(hasCode(analyzeBlueprint({ mounts: [{ id: 'main', root: 'src' }] }), 'mount-duplicate'), false)
})

test('mount-path-missing requires a root and mount-path-unsafe warns on risky roots', () => {
  const missing = issuesWithCode(analyzeBlueprint({ mounts: [{ id: 'main' }] }), 'mount-path-missing')
  assert.equal(missing.length, 1)
  assert.equal(missing[0].severity, 'error')

  const safe = analyzeBlueprint({ mounts: [{ id: 'main', root: 'src/lib' }] })
  assert.equal(hasCode(safe, 'mount-path-missing'), false)
  assert.equal(hasCode(safe, 'mount-path-unsafe'), false)

  const unsafe = issuesWithCode(analyzeBlueprint({
    mounts: [
      { id: 'abs', root: '/abs/path' },
      { id: 'trav', root: '../outside' },
      { id: 'win', root: 'C:\\work' },
      { id: 'empty', root: '' },
    ],
  }), 'mount-path-unsafe')
  assert.deepEqual(unsafe.map(issue => issue.mountId).sort(), ['abs', 'empty', 'trav', 'win'])
  assert.deepEqual(unsafe.find(issue => issue.mountId === 'trav').details.reasons, ['parent-traversal'])
  assert.deepEqual(unsafe.find(issue => issue.mountId === 'win').details.reasons, ['windows-drive'])
  assert.equal(unsafe.every(issue => issue.severity === 'warn'), true)
})

test('mount-ref-missing reports dangling module mount ids', () => {
  const result = analyzeBlueprint({
    mounts: [{ id: 'main', root: 'src' }],
    modules: [{ id: 'api', name: 'API', mountIds: ['main', 'ghost', 'ghost'] }],
  })
  const issues = issuesWithCode(result, 'mount-ref-missing')
  assert.equal(issues.length, 1)
  assert.equal(issues[0].severity, 'error')
  assert.equal(issues[0].moduleId, 'api')
  assert.deepEqual(issues[0].details.missing, ['ghost'])

  const valid = analyzeBlueprint({
    mounts: [{ id: 'main', root: 'src' }],
    modules: [{ id: 'api', name: 'API', mountIds: ['main'] }],
  })
  assert.equal(hasCode(valid, 'mount-ref-missing'), false)
})

test('mount-readonly-write rejects write intent on a read-only mount', () => {
  const readOnly = analyzeBlueprint({
    mounts: [{ id: 'snap', root: '../snapshots/a', kind: 'snapshot', ref: 'r1' }],
    modules: [{
      id: 'api',
      name: 'API',
      mountIds: ['snap'],
      execution: { allow: ['write'], commands: ['npm run build'] },
    }],
  })
  const issues = issuesWithCode(readOnly, 'mount-readonly-write')
  assert.equal(issues.length, 1)
  assert.equal(issues[0].severity, 'error')
  assert.equal(issues[0].moduleId, 'api')

  const writable = analyzeBlueprint({
    mounts: [{ id: 'main', root: 'src', kind: 'working', access: 'rw' }],
    modules: [{ id: 'api', name: 'API', mountIds: ['main'], execution: { commands: ['npm test'] } }],
  })
  assert.equal(hasCode(writable, 'mount-readonly-write'), false)

  const readOnlyWithoutWrite = analyzeBlueprint({
    mounts: [{ id: 'snap', root: '../snapshots/a', kind: 'snapshot', ref: 'r1' }],
    modules: [{ id: 'api', name: 'API', mountIds: ['snap'], execution: { cwd: 'x' } }],
  })
  assert.equal(hasCode(readOnlyWithoutWrite, 'mount-readonly-write'), false)
})

test('mount-overlap warns for identical or nested writable working roots', () => {
  const same = issuesWithCode(analyzeBlueprint({
    mounts: [
      { id: 'a', root: 'Repo/Src' },
      { id: 'b', root: 'repo/src/' },
    ],
  }), 'mount-overlap')
  assert.equal(same.length, 1)
  assert.equal(same[0].severity, 'warn')
  assert.equal(same[0].details.relation, 'same')

  const nested = issuesWithCode(analyzeBlueprint({
    mounts: [
      { id: 'root', root: 'repo' },
      { id: 'child', root: 'repo/src' },
    ],
  }), 'mount-overlap')
  assert.equal(nested.length, 1)
  assert.equal(nested[0].details.relation, 'nested')

  const disjoint = analyzeBlueprint({
    mounts: [
      { id: 'a', root: 'repo-a' },
      { id: 'b', root: 'repo-b' },
    ],
  })
  assert.equal(hasCode(disjoint, 'mount-overlap'), false)

  // Read-only and non-working mounts never overlap-check against writable roots.
  const ignored = analyzeBlueprint({
    mounts: [
      { id: 'snap', root: '../repo', kind: 'snapshot', ref: 'r1' },
      { id: 'ro', root: 'repo', access: 'ro' },
      { id: 'working', root: 'repo' },
    ],
  })
  assert.equal(hasCode(ignored, 'mount-overlap'), false)
})

test('mount-snapshot-ref-missing requires ref or checksum for snapshot/archive mounts', () => {
  const result = analyzeBlueprint({
    mounts: [
      { id: 'snap', root: '../snapshots/a', kind: 'snapshot' },
      { id: 'arch', root: '../archives/a', kind: 'archive' },
      { id: 'tagged', root: '../snapshots/b', kind: 'snapshot', ref: 'r1' },
      { id: 'hashed', root: '../archives/b', kind: 'archive', checksum: 'sha256:abc' },
      { id: 'work', root: 'src' },
    ],
  })
  const issues = issuesWithCode(result, 'mount-snapshot-ref-missing')
  assert.deepEqual(issues.map(issue => issue.mountId).sort(), ['arch', 'snap'])
  assert.equal(issues.every(issue => issue.severity === 'warn'), true)
})

test('module-mount-missing is info-level and only applies when the blueprint has mounts', () => {
  const result = analyzeBlueprint({
    mounts: [{ id: 'main', root: 'src' }],
    modules: [
      { id: 'api', name: 'API', mountIds: ['main'] },
      { id: 'lib', name: 'Lib' },
    ],
  })
  const issues = issuesWithCode(result, 'module-mount-missing')
  assert.equal(issues.length, 1)
  assert.equal(issues[0].severity, 'info')
  assert.equal(issues[0].moduleId, 'lib')

  const noMounts = analyzeBlueprint({ modules: [{ id: 'lib', name: 'Lib' }] })
  assert.equal(hasCode(noMounts, 'module-mount-missing'), false)
})

test('legacy blueprints without mounts stay free of workspace warnings', () => {
  const legacy = normalized({
    title: 'Legacy',
    modules: [{ id: 'api', name: 'API', acceptance: ['ok'] }],
    sections: [{ key: 'functional', items: [{ id: 'f1', text: '登录', moduleId: 'api' }] }],
  })
  const result = analyzeBlueprint(legacy)
  const workspaceCodes = result.issues
    .map(issue => issue.code)
    .filter(code => code.startsWith('mount-') || code === 'module-mount-missing')
  assert.deepEqual(workspaceCodes, [])

  // Execution or mountIds alone opt the blueprint into workspace checks.
  const optedIn = analyzeBlueprint({
    modules: [{ id: 'api', name: 'API', mountIds: ['ghost'] }],
  })
  assert.equal(hasCode(optedIn, 'mount-ref-missing'), true)
})
