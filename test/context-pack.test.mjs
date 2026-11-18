import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { normalizeBlueprint, blueprintAbsolutePath, writeBlueprintFile } from '../lib/blueprint.js'
import { apply } from '../index.js'
import { extractSymbols, languageOfFile } from '../lib/symbols.js'
import {
  CONTEXT_PACK_LIMITS,
  buildContextPack,
  buildContextPacks,
  leafModules,
  resolveModuleFiles,
} from '../lib/context-pack.js'

async function workspace(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-context-pack-'))
  for (const [relative, body] of Object.entries(files)) {
    const absolute = path.join(root, relative)
    await fs.mkdir(path.dirname(absolute), { recursive: true })
    await fs.writeFile(absolute, body, 'utf8')
  }
  return root
}

function blueprintWith(modules, mounts = []) {
  return normalizeBlueprint({
    title: 'Context pack',
    mounts,
    modules,
  })
}

test('languageOfFile recognizes JS/TS and Python sources only', () => {
  assert.equal(languageOfFile('src/a.mjs'), 'js')
  assert.equal(languageOfFile('src/a.tsx'), 'js')
  assert.equal(languageOfFile('pkg/mod.py'), 'python')
  assert.equal(languageOfFile('README.md'), null)
  assert.equal(languageOfFile(''), null)
})

test('extractSymbols reads JS exports without a parser', () => {
  const source = [
    'export function greet(name) { return name }',
    'export async function load(id, options) {',
    '  return id',
    '}',
    'export class Store {}',
    'export const config = { a: 1 }',
    'export const fetchIt = (url) => fetch(url)',
    'export { alpha, beta as gamma }',
    'module.exports = { legacy }',
  ].join('\n')
  const result = extractSymbols(source, 'src/a.js')
  assert.equal(result.language, 'js')
  assert.equal(result.parseable, true)
  const names = result.symbols.map(symbol => symbol.name)
  for (const expected of ['greet', 'load', 'Store', 'config', 'fetchIt', 'alpha', 'beta', 'legacy']) {
    assert.ok(names.includes(expected), `missing ${expected}`)
  }
  assert.equal(result.symbols.find(symbol => symbol.name === 'greet').kind, 'function')
})

test('extractSymbols reads Python defs, classes and constants', () => {
  const source = [
    'API_VERSION = "1"',
    'def handler(event, context):',
    '    return event',
    'class Client:',
    '    pass',
    '__all__ = ["handler"]',
  ].join('\n')
  const result = extractSymbols(source, 'app/main.py')
  assert.equal(result.language, 'python')
  const names = result.symbols.map(symbol => symbol.name)
  assert.deepEqual(names.sort(), ['API_VERSION', 'Client', 'handler'])
})

test('resolveModuleFiles resolves mount roots and expands wildcards', async () => {
  const cwd = await workspace({
    'repo/src/a.js': 'export const a = 1\n',
    'repo/src/deep/b.js': 'export const b = 1\n',
    'repo/docs/readme.md': '# hi\n',
  })
  try {
    const blueprint = blueprintWith(
      [{ id: 'core', name: 'Core', files: ['src/**'] }],
      [{ id: 'repo', label: 'repo', root: 'repo', kind: 'working', access: 'rw' }],
    )
    const packet = { module: blueprint.modules[0], mounts: blueprint.mounts }
    const resolved = await resolveModuleFiles(packet, cwd)
    assert.deepEqual(resolved.files.map(file => file.path), ['src/a.js', 'src/deep/b.js'])
    assert.deepEqual(resolved.missing, [])
    assert.ok(resolved.files.every(file => path.isAbsolute(file.absolute)))
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('resolveModuleFiles reports missing patterns instead of inventing files', async () => {
  const cwd = await workspace({ 'repo/src/a.js': 'export const a = 1\n' })
  try {
    const blueprint = blueprintWith(
      [{ id: 'core', name: 'Core', files: ['src/a.js', 'src/ghost.js'] }],
      [{ id: 'repo', label: 'repo', root: 'repo', kind: 'working', access: 'rw' }],
    )
    const packet = { module: blueprint.modules[0], mounts: blueprint.mounts }
    const resolved = await resolveModuleFiles(packet, cwd)
    assert.deepEqual(resolved.files.map(file => file.path), ['src/a.js'])
    assert.deepEqual(resolved.missing, ['src/ghost.js'])
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('buildContextPack renders files, symbols, imports, tests and acceptance', async () => {
  const cwd = await workspace({
    'repo/src/a.js': 'export function greet(name) { return name }\n',
    'repo/src/b.js': 'import { greet } from "./a.js"\nexport const b = greet("x")\n',
    'repo/test/a.test.mjs': 'import { greet } from "../src/a.js"\n',
    'repo/package.json': '{"name":"demo"}\n',
  })
  try {
    const blueprint = blueprintWith(
      [{
        id: 'core',
        code: 'A1',
        name: 'Core',
        summary: 'Core module',
        files: ['src/a.js'],
        mountIds: ['repo'],
        acceptance: ['greet returns the name'],
      }],
      [{ id: 'repo', label: 'repo', root: 'repo', kind: 'working', access: 'rw' }],
    )
    blueprint.sections[0].items.push({ id: 'i1', uid: 'goals:i1', code: 'R1', text: 'greet works', moduleId: 'core' })
    const scan = {
      root: path.join(cwd, 'repo'),
      imports: { edges: [{ from: 'src/b.js', to: 'src/a.js', kind: 'import' }] },
      files: [{ path: 'test/a.test.mjs' }],
      packages: [{ relativePath: '.', testCommands: ['node --test'] }],
      testCommands: ['node --test'],
    }
    const pack = await buildContextPack(blueprint, 'core', { cwd, scan })
    assert.equal(pack.ok, true)
    assert.match(pack.markdown, /## 模块 Core/)
    assert.match(pack.markdown, new RegExp(path.join(cwd, 'repo').replace(/\\/gu, '\\\\')))
    assert.match(pack.markdown, /`src\/a\.js`/)
    assert.match(pack.markdown, /export function greet\(name\)/)
    assert.match(pack.markdown, /入：`src\/b\.js`/)
    assert.match(pack.markdown, /`node --test`/)
    assert.match(pack.markdown, /greet returns the name/)
    assert.match(pack.markdown, /R1 greet works/)
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('buildContextPack fails closed on a missing file and truncates to the budget', async () => {
  const cwd = await workspace({ 'src/a.js': 'export const a = 1\n' })
  try {
    const blueprint = blueprintWith([{ id: 'core', name: 'Core', files: ['src/ghost.js'] }])
    const pack = await buildContextPack(blueprint, 'core', { cwd })
    assert.equal(pack.ok, false)
    assert.ok(pack.issues.some(issue => issue.code === 'context-file-missing' && issue.severity === 'error'))
    assert.match(pack.markdown, /文件不存在/)

    const small = await buildContextPack(blueprint, 'core', { cwd, limits: { ...CONTEXT_PACK_LIMITS, maxChars: 200 } })
    assert.ok(small.markdown.length <= 260)
    assert.match(small.markdown, /截断/)
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('leafModules skips parents that own children and buildContextPacks covers leaves', async () => {
  const cwd = await workspace({ 'src/a.js': 'export const a = 1\n' })
  try {
    const blueprint = normalizeBlueprint({
      title: 'Layered',
      layers: [
        { letter: 'A', title: '总览' },
        { letter: 'B', title: '子层', parentModuleId: 'parent' },
      ],
      modules: [
        { id: 'parent', name: 'Parent', layerId: 'A', files: [] },
        { id: 'child', name: 'Child', layerId: 'B', files: ['src/a.js'], acceptance: ['a exports'] },
      ],
    })
    assert.equal(blueprint.modules.find(module => module.id === 'child').parentId, 'parent')
    assert.deepEqual(leafModules(blueprint).map(module => module.id), ['child'])
    const result = await buildContextPacks(blueprint, { cwd })
    assert.equal(result.packs.length, 1)
    assert.equal(result.packs[0].moduleId, 'child')
    assert.equal(result.ok, true)
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('module files cannot escape the mount root', async () => {
  const cwd = await workspace({ 'repo/src/a.js': 'export const a = 1\n', 'outside.txt': 'top secret\n' })
  try {
    const blueprint = blueprintWith(
      [{ id: 'core', name: 'Core', files: ['../outside.txt'] }],
      [{ id: 'repo', label: 'repo', root: 'repo', kind: 'working', access: 'rw' }],
    )
    blueprint.modules[0].mountIds = ['repo']
    const pack = await buildContextPack(blueprint, 'core', { cwd })
    assert.equal(pack.ok, false)
    assert.ok(pack.issues.some(issue => issue.code === 'context-file-missing'))
    assert.doesNotMatch(pack.markdown, /top secret/)
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('buildContextPacks reports an unknown module instead of returning an empty success', async () => {
  const cwd = await workspace({ 'src/a.js': 'export const a = 1\n' })
  try {
    const blueprint = blueprintWith([{ id: 'core', name: 'Core', files: ['src/a.js'] }])
    const result = await buildContextPacks(blueprint, { cwd, moduleId: 'ghost' })
    assert.equal(result.ok, false)
    assert.equal(result.packs.length, 0)
    assert.ok(result.issues.some(issue => issue.code === 'module-unknown' && issue.severity === 'error'))
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

// --- host integration ------------------------------------------------------

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
  apply(ctx, { promptSection: false })
  const agent = { id: 'session-context', session: { header: { cwd, id: 'session-context' } } }
  return { tools, commands, agent, dispose: () => { for (const dispose of disposers) dispose() } }
}

async function seed(cwd, sessionId, input) {
  const file = blueprintAbsolutePath(cwd, sessionId)
  await writeBlueprintFile(file, normalizeBlueprint(input, undefined, { sessionId }))
  return file
}

const GROUNDED = {
  title: 'Grounded',
  mounts: [{ id: 'repo', label: 'repo', root: '.', kind: 'working', access: 'rw' }],
  modules: [{
    id: 'core',
    name: 'Core',
    mountIds: ['repo'],
    files: ['src/a.js'],
    acceptance: ['a exports'],
    dependsOn: [],
  }],
}

test('brief compiles grounded packs through the tool', async () => {
  const cwd = await workspace({ 'src/a.js': 'export function greet(name) { return name }\n' })
  try {
    const plugin = setupPlugin(cwd)
    await seed(cwd, plugin.agent.id, GROUNDED)
    const result = await plugin.tools[0].execute({ action: 'brief' }, { agent: plugin.agent })
    assert.equal(result.found, true)
    assert.equal(result.ok, true)
    assert.equal(result.packs.length, 1)
    assert.equal(result.packs[0].moduleId, 'core')
    assert.match(result.packs[0].markdown, /export function greet/)
    assert.match(result.packs[0].markdown, /`src\/a\.js`/)
    plugin.dispose()
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('dispatch refuses a module whose declared file does not exist and keeps the token usable', async () => {
  const cwd = await workspace({ 'src/a.js': 'export const a = 1\n' })
  try {
    const plugin = setupPlugin(cwd)
    await seed(cwd, plugin.agent.id, {
      ...GROUNDED,
      modules: [{ ...GROUNDED.modules[0], files: ['src/ghost.js'] }],
    })
    const handler = plugin.commands[0].handler
    const confirmation = JSON.parse((await handler({ rawInput: 'confirm', agent: plugin.agent })).text)

    const refused = await handler({ rawInput: `dispatch ${confirmation.token}`, agent: plugin.agent })
    assert.equal(refused.kind, 'error')
    assert.match(refused.text, /分派被拒绝/)
    assert.match(refused.text, /src\/ghost\.js/)

    const onDisk = JSON.parse(await fs.readFile(blueprintAbsolutePath(cwd, plugin.agent.id), 'utf8'))
    assert.equal(onDisk.status, 'confirmed', 'a refused dispatch must not mark the blueprint dispatched')
    plugin.dispose()
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})

test('dispatch returns compiled packs and grounding warnings', async () => {
  const cwd = await workspace({ 'src/a.js': 'export function greet(name) { return name }\n' })
  try {
    const plugin = setupPlugin(cwd)
    await seed(cwd, plugin.agent.id, GROUNDED)
    const handler = plugin.commands[0].handler
    const confirmation = JSON.parse((await handler({ rawInput: 'confirm', agent: plugin.agent })).text)
    const dispatched = await handler({ rawInput: `dispatch ${confirmation.token}`, agent: plugin.agent })
    assert.equal(dispatched.kind, 'success')
    const receipt = JSON.parse(dispatched.text)
    assert.equal(receipt.status, 'dispatched')
    assert.equal(receipt.grounding.ok, true)
    assert.equal(receipt.packs.length, 1)
    assert.equal(receipt.packs[0].moduleId, 'core')
    assert.match(receipt.packs[0].markdown, /export function greet/)
    plugin.dispose()
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})
