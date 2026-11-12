import assert from 'node:assert/strict'
import test from 'node:test'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  SCAN_PREVIEW_LIMITS,
  apply,
  buildScanPreview,
  mergeScanSuggestions,
} from '../index.js'
import { normalizeBlueprint } from '../lib/blueprint.js'
import { scanWorkspace, suggestBlueprint } from '../lib/scanner.js'

async function makeTemp() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'blueprint-scan-preview-'))
}

async function write(root, relative, content) {
  const absolute = path.join(root, ...relative.split('/'))
  await fs.mkdir(path.dirname(absolute), { recursive: true })
  await fs.writeFile(absolute, content)
}

async function exists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
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
  const agent = { id: 'session-preview', session: { header: { cwd, id: 'session-preview' } } }
  return { tools, commands, agent, dispose: () => { for (const dispose of disposers) dispose() } }
}

function countTreeNodes(nodes) {
  if (!Array.isArray(nodes)) return 0
  return nodes.reduce((total, node) => total + 1 + countTreeNodes(node?.children), 0)
}

function layeredSuggestions() {
  return {
    mounts: [{ id: 'repo', label: 'repo', root: '.', kind: 'working', access: 'rw' }],
    layers: [
      { letter: 'A', title: 'Overview', parentModuleId: null },
      { letter: 'B', title: 'Auth layer', parentModuleId: 'api' },
      { letter: 'C', title: 'Login layer', parentModuleId: 'auth' },
    ],
    modules: [
      { id: 'api', name: 'API', code: 'A1', layerId: 'A', summary: 'root api' },
      { id: 'auth', name: 'Auth', code: 'B1', layerId: 'B', parentId: 'api', summary: 'auth service' },
      { id: 'login', name: 'Login', code: 'C1', layerId: 'C', parentId: 'auth', summary: 'login flow' },
    ],
    diagrams: [
      {
        key: 'module', layerId: 'A', type: 'module', title: 'Structure',
        nodes: [
          { id: 'api', type: 'module', label: 'API' },
          { id: 'auth', type: 'module', label: 'Auth' },
        ],
        edges: [{ from: 'auth', to: 'api', label: 'imports', kind: 'depends' }],
      },
      {
        key: 'B:module', layerId: 'B', type: 'module', title: 'Auth structure',
        nodes: [{ id: 'auth', type: 'module', label: 'Auth' }],
        edges: [],
      },
      {
        key: 'C:module', layerId: 'C', type: 'module', title: 'Login structure',
        nodes: [{ id: 'login', type: 'module', label: 'Login' }],
        edges: [],
      },
    ],
  }
}

function blueprintOf(merged, title = 'Layered scan') {
  return normalizeBlueprint({
    title,
    summary: 'Generated from a layered scan.',
    prompt: 'Understand the layered repository.',
    layers: merged.layers,
    modules: merged.modules,
    diagrams: merged.diagrams,
    mounts: merged.mounts,
  }, undefined, { sessionId: 'session-preview' })
}

test('scan preview returns metrics, tree, imports and a Host SVG without writing', async () => {
  const root = await makeTemp()
  const plugin = setupPlugin(root)
  try {
    await write(root, 'package.json', JSON.stringify({ name: 'preview-repo', scripts: { test: 'node --test' } }))
    await write(root, 'src/index.js', 'export const value = 1\n')
    await write(root, 'src/util.js', 'export const util = 2\n')
    await write(root, 'test/app.test.mjs', 'test("app", () => {})\n')
    await write(root, 'docs/readme.md', '# docs\n')

    assert.match(plugin.commands[0].input.hint, /scan \[preview\|apply\]/u)

    const result = await plugin.commands[0].handler({ rawInput: 'scan preview', agent: plugin.agent })
    assert.equal(result.kind, 'success')
    const payload = JSON.parse(result.text)
    assert.equal(payload.ok, true)
    assert.equal(payload.scan.root, path.resolve(root))
    assert.match(payload.svg, /<svg/u)
    assert.match(payload.svg, /<\/svg>/u)
    assert.equal(typeof payload.scan.metrics.totals.files, 'number')
    assert.ok(payload.scan.metrics.totals.files >= 5)
    assert.equal(typeof payload.scan.metrics.health.score, 'number')
    assert.ok(payload.scan.metrics.insights.length > 0)
    assert.equal(typeof payload.scan.imports.edges, 'number')
    assert.equal(typeof payload.scan.imports.external, 'number')
    assert.ok(Array.isArray(payload.scan.tree))
    assert.ok(countTreeNodes(payload.scan.tree) > 0)
    // The pre-v0.15 scanner has no layer suggestions; A is still reported.
    for (const key of ['mounts', 'modules', 'layers', 'diagrams']) {
      assert.equal(typeof payload.suggestions[key], 'number')
    }
    assert.equal(payload.suggestions.layers, 1)

    assert.deepEqual(await fs.readdir(root), ['docs', 'package.json', 'src', 'test'])
    assert.equal(await exists(path.join(root, '.dsh')), false)

    const again = await plugin.commands[0].handler({ rawInput: 'scan preview', agent: plugin.agent })
    assert.equal(again.kind, 'success')
    assert.equal(await exists(path.join(root, '.dsh')), false)
  } finally {
    plugin.dispose()
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('scan preview trims oversized trees and diagrams but keeps suggestion counts', async () => {
  const tree = Array.from({ length: 600 }, (_, index) => ({
    name: `file-${index}.js`,
    path: `src/file-${index}.js`,
    type: 'file',
    children: [],
  }))
  const nodes = Array.from({ length: 200 }, (_, index) => ({ id: `module-${index}`, type: 'module', label: `Module ${index}` }))
  const suggestions = {
    mounts: Array.from({ length: 40 }, (_, index) => ({ id: `mount-${index}`, root: '.', kind: 'working', access: 'rw' })),
    layers: [{ letter: 'A', title: 'Overview', parentModuleId: null }],
    modules: Array.from({ length: 90 }, (_, index) => ({ id: `module-${index}`, name: `Module ${index}`, code: `A${index + 1}`, layerId: 'A' })),
    diagrams: [{
      key: 'module', layerId: 'A', type: 'module', title: 'Huge',
      nodes,
      edges: nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id, label: 'depends', kind: 'depends' })),
    }],
  }
  const scan = {
    root: '/synthetic/repo',
    metrics: {
      totals: { files: 600, bytes: 120000, directories: 12, packages: 3 },
      languages: { js: { files: 600, bytes: 120000 } },
      packages: [],
      hotspots: [],
      insights: [],
    },
    tree,
  }
  const preview = buildScanPreview({ scan, suggestions })
  assert.equal(preview.ok, true)
  assert.ok(countTreeNodes(preview.scan.tree) <= SCAN_PREVIEW_LIMITS.maxTreeNodes)
  assert.equal(preview.scan.truncated, true)
  assert.equal(preview.suggestions.modules, 90)
  assert.equal(preview.suggestions.diagrams, 1)
  assert.equal(preview.suggestions.mounts, 40)
  assert.match(preview.svg, /<svg/u)
  assert.ok(!preview.svg.includes('Module 199'))

  const root = await makeTemp()
  const plugin = setupPlugin(root)
  try {
    await write(root, 'package.json', JSON.stringify({ name: 'wide-repo' }))
    await Promise.all(Array.from({ length: 230 }, (_, index) =>
      write(root, `src/dir-${index % 5}/file-${index}.js`, `export const value${index} = ${index}\n`)))
    const result = await plugin.commands[0].handler({ rawInput: 'scan preview', agent: plugin.agent })
    assert.equal(result.kind, 'success')
    const payload = JSON.parse(result.text)
    assert.ok(countTreeNodes(payload.scan.tree) <= SCAN_PREVIEW_LIMITS.maxTreeNodes)
    assert.equal(payload.scan.truncated, true)
    assert.equal(await exists(path.join(root, '.dsh')), false)
  } finally {
    plugin.dispose()
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('scan preview reports an unreadable repository clearly', async () => {
  const root = await makeTemp()
  const missing = path.join(root, 'does-not-exist')
  const plugin = setupPlugin(missing)
  try {
    const result = await plugin.commands[0].handler({ rawInput: 'scan preview', agent: plugin.agent })
    assert.equal(result.kind, 'error')
    assert.match(result.text, /扫描预览失败/u)
    assert.match(result.text, /does-not-exist/u)
  } finally {
    plugin.dispose()
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('mergeScanSuggestions applies layers, parent modules and sub-layer diagrams', async () => {
  const merged = mergeScanSuggestions({ suggestions: layeredSuggestions() })
  assert.deepEqual(merged.layers.map(layer => layer.letter), ['A', 'B', 'C'])
  assert.equal(merged.layersAdded, 3)
  assert.equal(merged.modulesAdded, 3)
  assert.equal(merged.diagramsAdded, 3)
  assert.equal(merged.mountsAdded, 1)

  const blueprint = blueprintOf(merged)
  assert.deepEqual(blueprint.layers.map(layer => layer.letter), ['A', 'B', 'C'])
  const auth = blueprint.modules.find(module => module.id === 'auth')
  assert.equal(auth.layerId, 'B')
  assert.equal(auth.parentId, 'api')
  assert.equal(auth.code, 'B1')
  const login = blueprint.modules.find(module => module.id === 'login')
  assert.equal(login.layerId, 'C')
  assert.equal(login.parentId, 'auth')
  assert.ok(blueprint.diagrams.some(diagram => diagram.key === 'B:module'))
  assert.ok(blueprint.diagrams.some(diagram => diagram.key === 'C:module'))
  const rootDiagram = blueprint.diagrams.find(diagram => diagram.key === 'module')
  assert.ok(rootDiagram.edges.some(edge => edge.from === 'auth' && edge.to === 'api' && edge.label === 'imports'))
})

test('mergeScanSuggestions preserves existing modules and repeated apply is idempotent', async () => {
  const previous = normalizeBlueprint({
    title: 'Existing blueprint',
    layers: [{ letter: 'A', title: 'Overview', parentModuleId: null }],
    modules: [{ id: 'legacy', name: 'Legacy', code: 'A1', layerId: 'A' }],
    diagrams: [{
      key: 'module', layerId: 'A', type: 'module', title: 'Existing structure',
      nodes: [{ id: 'legacy', type: 'module', label: 'Legacy' }],
      edges: [],
    }],
    mounts: [{ id: 'repo', label: 'repo', root: '.', kind: 'working', access: 'rw' }],
  }, undefined, { sessionId: 'session-preview' })

  const suggestions = {
    mounts: [{ id: 'repo', label: 'repo', root: '.', kind: 'working', access: 'rw' }],
    layers: [
      { letter: 'A', title: 'Overview', parentModuleId: null },
      { letter: 'B', title: 'Auth layer', parentModuleId: 'legacy' },
      { letter: 'Z', title: 'Broken layer', parentModuleId: 'missing-module' },
    ],
    modules: [
      { id: 'auth', name: 'Auth', code: 'B1', layerId: 'B', parentId: 'legacy' },
      { id: 'orphan', name: 'Orphan', code: 'Z1', layerId: 'Z', parentId: 'legacy' },
    ],
    diagrams: [
      {
        key: 'B:module', layerId: 'B', type: 'module', title: 'Auth structure',
        nodes: [{ id: 'auth', type: 'module', label: 'Auth' }],
        edges: [],
      },
      {
        key: 'Z:module', layerId: 'Z', type: 'module', title: 'Orphan structure',
        nodes: [{ id: 'orphan', type: 'module', label: 'Orphan' }],
        edges: [],
      },
    ],
  }

  const merged = mergeScanSuggestions({ previous, suggestions })
  assert.deepEqual(merged.modules[0], previous.modules[0])
  assert.ok(merged.modules.some(module => module.id === 'auth'))
  assert.ok(!merged.modules.some(module => module.id === 'orphan'))
  assert.deepEqual(merged.layers.map(layer => layer.letter), ['A', 'B'])
  assert.equal(merged.layersAdded, 1)
  assert.equal(merged.modulesAdded, 1)
  assert.equal(merged.diagramsAdded, 1)
  assert.equal(merged.mountsAdded, 0)

  const normalized = blueprintOf(merged, 'Existing blueprint')
  const again = mergeScanSuggestions({ previous: normalized, suggestions })
  assert.equal(again.layersAdded, 0)
  assert.equal(again.modulesAdded, 0)
  assert.equal(again.diagramsAdded, 0)
  assert.equal(again.mountsAdded, 0)
  const againNormalized = blueprintOf(again, 'Existing blueprint')
  assert.deepEqual(againNormalized.modules, normalized.modules)
  assert.deepEqual(againNormalized.layers, normalized.layers)
  assert.deepEqual(againNormalized.diagrams, normalized.diagrams)
})

test('scan apply creates a blueprint, keeps existing modules and only writes under .dsh', async () => {
  const root = await makeTemp()
  const plugin = setupPlugin(root)
  try {
    await write(root, 'package.json', JSON.stringify({
      name: 'apply-repo',
      private: true,
      workspaces: ['packages/*'],
      scripts: { test: 'node --test' },
      dependencies: { leftpad: '^1.0.0' },
    }, null, 2))
    await write(root, 'packages/a/package.json', JSON.stringify({ name: '@apply/a', dependencies: { '@apply/b': '*' } }))
    await write(root, 'packages/a/src/index.js', 'export const a = 1\n')
    await write(root, 'packages/b/package.json', JSON.stringify({ name: '@apply/b' }))
    await write(root, 'packages/b/src/index.js', 'export const b = 2\n')

    const before = (await fs.readdir(root)).sort()

    const preview = await plugin.commands[0].handler({ rawInput: 'scan preview', agent: plugin.agent })
    assert.equal(preview.kind, 'success')
    assert.equal(await exists(path.join(root, '.dsh')), false)

    const first = await plugin.commands[0].handler({ rawInput: 'scan apply', agent: plugin.agent })
    assert.equal(first.kind, 'success')
    const firstPayload = JSON.parse(first.text)
    assert.equal(firstPayload.ok, true)
    assert.ok(firstPayload.layersAdded >= 1)
    assert.ok(firstPayload.modulesAdded >= 1)
    assert.ok(firstPayload.diagramsAdded >= 1)
    assert.equal(firstPayload.path, '.dsh/blueprints/session-preview.json')

    const blueprintPath = path.join(root, '.dsh', 'blueprints', 'session-preview.json')
    const saved = JSON.parse(await fs.readFile(blueprintPath, 'utf8'))
    assert.equal(saved.layers[0].letter, 'A')
    assert.ok(saved.modules.length >= 1)
    assert.ok(saved.diagrams.some(diagram => diagram.key === 'module'))
    assert.ok(saved.mounts.length >= 1)

    const after = (await fs.readdir(root)).sort()
    assert.deepEqual(after, [...before, '.dsh'].sort())
    const dshEntries = await fs.readdir(path.join(root, '.dsh'))
    assert.deepEqual(dshEntries, ['blueprints'])

    const second = await plugin.commands[0].handler({ rawInput: 'scan apply', agent: plugin.agent })
    assert.equal(second.kind, 'success')
    const secondPayload = JSON.parse(second.text)
    assert.equal(secondPayload.ok, true)
    assert.equal(secondPayload.layersAdded, 0)
    assert.equal(secondPayload.modulesAdded, 0)
    assert.equal(secondPayload.diagramsAdded, 0)
    assert.equal(secondPayload.mountsAdded, 0)
    const resaved = JSON.parse(await fs.readFile(blueprintPath, 'utf8'))
    assert.deepEqual(resaved.modules, saved.modules)
    assert.deepEqual(resaved.layers, saved.layers)
    assert.deepEqual(resaved.diagrams, saved.diagrams)
  } finally {
    plugin.dispose()
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('buildScanPreview falls back to the legacy scanner shape', async () => {
  const root = await makeTemp()
  try {
    await write(root, 'package.json', JSON.stringify({ name: 'legacy-shape' }))
    await write(root, 'src/index.js', 'export default 1\n')
    const scan = await scanWorkspace(root)
    const suggestions = suggestBlueprint(scan)
    const preview = buildScanPreview({ scan, suggestions })
    assert.equal(preview.ok, true)
    assert.equal(preview.scan.metrics.totals.files, scan.fileCount)
    assert.ok(preview.scan.metrics.packages.length >= 1)
    assert.ok(preview.scan.metrics.hotspots.length >= 1)
    assert.ok(preview.scan.metrics.insights.length >= 1)
    assert.ok(preview.scan.tree[0].children.length > 0)
    assert.equal(preview.scan.imports.external, scan.externalDeps.length)
    assert.equal(preview.suggestions.layers, 1)
    assert.equal(preview.suggestions.modules, suggestions.modules.length)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
