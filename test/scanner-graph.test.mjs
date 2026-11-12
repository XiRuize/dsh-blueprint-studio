import assert from 'node:assert/strict'
import test from 'node:test'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  TREE_LIMITS,
  buildFileTree,
  scanWorkspace,
  suggestBlueprint,
} from '../lib/scanner.js'

async function makeTemp() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'blueprint-graph-test-'))
}

async function write(root, relative, content) {
  const absolute = path.join(root, ...relative.split('/'))
  await fs.mkdir(path.dirname(absolute), { recursive: true })
  await fs.writeFile(absolute, content)
}

async function withRepo(seed, action) {
  const root = await makeTemp()
  try {
    await seed(root)
    return await action(root)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}

function findNode(node, targetPath) {
  if (node.path === targetPath) return node
  for (const child of node.children ?? []) {
    const found = findNode(child, targetPath)
    if (found !== undefined) return found
  }
  return undefined
}

test('scanner resolves TypeScript relative, require, dynamic, index and circular imports', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({
      name: 'graph-root',
      private: true,
      workspaces: ['packages/*'],
    }))
    await write(root, 'packages/a/package.json', JSON.stringify({
      name: '@graph/a',
      main: 'src/index.ts',
    }))
    await write(root, 'packages/a/src/index.ts', [
      "import { helper } from './util'",
      "import {",
      '  multi,',
      "} from './multi'",
      "export * from './dir'",
      "const legacy = require('./legacy')",
      "const lazy = import('./lazy')",
      "import react from 'react'",
      'export const value = helper + multi',
      '',
    ].join('\n'))
    await write(root, 'packages/a/src/util.ts', "import { value } from './index'\nexport const helper = () => value\n")
    await write(root, 'packages/a/src/multi.ts', 'export const multi = 1\n')
    await write(root, 'packages/a/src/dir/index.ts', 'export const dir = 1\n')
    await write(root, 'packages/a/src/legacy.js', 'module.exports = 1\n')
    await write(root, 'packages/a/src/lazy.ts', 'export const lazy = 1\n')
    await write(root, 'packages/a/src/missing.ts', "import './nope'\n")
  }, async root => {
    const scan = await scanWorkspace(root)
    const edges = scan.imports.edges
    const has = (from, to, kind) => edges.some(edge => edge.from === from && edge.to === to && edge.kind === kind)
    assert.ok(has('packages/a/src/index.ts', 'packages/a/src/util.ts', 'import'))
    assert.ok(has('packages/a/src/index.ts', 'packages/a/src/multi.ts', 'import'))
    assert.ok(has('packages/a/src/index.ts', 'packages/a/src/dir/index.ts', 'export'))
    assert.ok(has('packages/a/src/index.ts', 'packages/a/src/legacy.js', 'require'))
    assert.ok(has('packages/a/src/index.ts', 'packages/a/src/lazy.ts', 'dynamic'))
    assert.ok(has('packages/a/src/util.ts', 'packages/a/src/index.ts', 'import'), 'circular import is an edge')
    assert.ok(scan.imports.external.includes('react'))
    assert.ok(scan.imports.unresolved.some(item => item.from === 'packages/a/src/missing.ts' && item.specifier === './nope'))
    assert.equal(scan.imports.files, 7)
    assert.ok(scan.imports.byDirectory.some(item => (
      item.from === 'packages/a/src' && item.to === 'packages/a/src' && item.weight >= 2
    )))
    assert.deepEqual(scan.imports.unresolved, [...scan.imports.unresolved].sort((left, right) => (
      left.from.localeCompare(right.from) || left.specifier.localeCompare(right.specifier)
    )))
  })
})

test('scanner resolves Python package-relative imports and __init__.py', async () => {
  await withRepo(async root => {
    await write(root, 'py/pyproject.toml', '[project]\nname = "pyservice"\n')
    await write(root, 'py/pkg/__init__.py', '')
    await write(root, 'py/pkg/a.py', [
      'from .b import thing',
      'from ..shared import shared',
      'from . import c',
      'import .d',
      '',
    ].join('\n'))
    await write(root, 'py/pkg/b.py', 'thing = 1\n')
    await write(root, 'py/pkg/c.py', 'c = 1\n')
    await write(root, 'py/pkg/d.py', 'd = 1\n')
    await write(root, 'py/shared.py', 'shared = 1\n')
    await write(root, 'py/main.py', 'import os\nfrom requests import get\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    const edges = scan.imports.edges
    const has = (to) => edges.some(edge => edge.from === 'py/pkg/a.py' && edge.to === to)
    assert.ok(has('py/pkg/b.py'))
    assert.ok(has('py/shared.py'))
    assert.ok(has('py/pkg/__init__.py'))
    assert.ok(has('py/pkg/d.py'))
    assert.ok(scan.imports.external.includes('os'))
    assert.ok(scan.imports.external.includes('requests'))
    assert.equal(scan.imports.files, 7)
  })
})

test('scanner resolves Go module imports and skips same-package edges', async () => {
  await withRepo(async root => {
    await write(root, 'go/go.mod', 'module example.com/gosvc\n\ngo 1.22\n')
    await write(root, 'go/main.go', [
      'package main',
      '',
      'import (',
      '\t"fmt"',
      '\t"example.com/gosvc/internal/foo"',
      ')',
      '',
      'func main() {}',
      '',
    ].join('\n'))
    await write(root, 'go/internal/foo/foo.go', [
      'package foo',
      '',
      'import "example.com/gosvc/internal/foo"',
      '',
      'func Foo() {}',
      '',
    ].join('\n'))
    await write(root, 'go/internal/bar/bar.go', 'package bar\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    const edges = scan.imports.edges
    assert.ok(edges.some(edge => edge.from === 'go/main.go' && edge.to === 'go/internal/foo/foo.go'))
    assert.ok(!edges.some(edge => edge.from === 'go/internal/foo/foo.go' && edge.to === 'go/internal/foo/foo.go'))
    assert.ok(scan.imports.external.includes('fmt'))
    assert.ok(!scan.imports.external.some(name => name.startsWith('example.com/gosvc')))
  })
})

test('scanner resolves Rust mod declarations and crate/super use paths', async () => {
  await withRepo(async root => {
    await write(root, 'rust/Cargo.toml', '[package]\nname = "rusty"\nversion = "0.1.0"\n')
    await write(root, 'rust/src/main.rs', [
      'mod util;',
      'mod dir;',
      'use crate::util::helper;',
      'use std::fmt;',
      'fn main() {}',
      '',
    ].join('\n'))
    await write(root, 'rust/src/util.rs', 'use super::other;\npub fn helper() {}\n')
    await write(root, 'rust/src/other.rs', 'pub fn other() {}\n')
    await write(root, 'rust/src/dir/mod.rs', 'pub const dir: u8 = 1;\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    const edges = scan.imports.edges
    assert.ok(edges.some(edge => edge.from === 'rust/src/main.rs' && edge.to === 'rust/src/util.rs' && edge.kind === 'mod'))
    assert.ok(edges.some(edge => edge.from === 'rust/src/main.rs' && edge.to === 'rust/src/dir/mod.rs' && edge.kind === 'mod'))
    assert.ok(edges.some(edge => edge.from === 'rust/src/main.rs' && edge.to === 'rust/src/util.rs' && edge.kind === 'use'))
    assert.ok(edges.some(edge => edge.from === 'rust/src/util.rs' && edge.to === 'rust/src/other.rs' && edge.kind === 'use'))
    assert.ok(scan.imports.external.includes('std'))
  })
})

test('buildFileTree marks entry, test and doc files and caps depth and children', async () => {
  await withRepo(async root => {
    await write(root, 'README.md', '# readme\n')
    await write(root, 'package.json', JSON.stringify({ name: 'tree' }))
    await write(root, 'docs/guide.md', '# guide\n')
    await write(root, 'src/index.js', 'export default 1\n')
    await write(root, 'src/util.js', 'export const util = 1\n')
    await write(root, 'src/deep/a/b/c/file.js', 'export const deep = 1\n')
    await write(root, 'tests/a.test.js', 'test("a", () => {})\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    assert.deepEqual(scan.tree, buildFileTree(scan))
    assert.equal(scan.tree.path, '')
    assert.equal(scan.tree.files, scan.fileCount)
    assert.equal(scan.tree.bytes, scan.totalBytes)
    assert.ok(Array.isArray(scan.tree.children))

    const readme = findNode(scan.tree, 'README.md')
    const testFile = findNode(scan.tree, 'tests/a.test.js')
    const entry = findNode(scan.tree, 'src/index.js')
    assert.equal(readme.doc, true)
    assert.equal(testFile.test, true)
    assert.equal(entry.entry, true)
    assert.equal(findNode(scan.tree, 'docs').doc, true)
    assert.equal(findNode(scan.tree, 'tests').test, true)

    // Ordinary files are hidden by default, but directories keep aggregate counts.
    assert.equal(findNode(scan.tree, 'src/util.js'), undefined)
    assert.equal(findNode(scan.tree, 'src').files, 3)

    const shallow = buildFileTree(scan, { maxDepth: 2, maxChildren: 2 })
    assert.equal(shallow.children.length, 2)
    assert.equal(shallow.truncated, true)
    const src = findNode(shallow, 'src')
    assert.ok(src !== undefined)
    assert.equal(findNode(shallow, 'src/deep').truncated, true)
    assert.deepEqual(
      shallow.children.map(child => child.name),
      [...shallow.children.map(child => child.name)],
    )
    const names = shallow.children.map(child => child.name)
    assert.deepEqual(names, [...names].sort())

    const full = buildFileTree(scan, { includeFiles: true })
    assert.ok(findNode(full, 'src/util.js'))
    assert.ok(findNode(full, 'src/deep/a/b/c/file.js'))
    assert.equal(TREE_LIMITS.maxDepth, 8)
    assert.equal(TREE_LIMITS.maxChildren, 80)
  })
})

test('buildFileTree keeps directories before files and sorts stably', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'order' }))
    await write(root, 'z.js', 'export const z = 1\n')
    await write(root, 'a.js', 'export const a = 1\n')
    await write(root, 'b/README.md', '# b\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    const tree = buildFileTree(scan, { includeFiles: true })
    const rootNames = tree.children.map(child => `${child.type}:${child.name}`)
    assert.deepEqual(rootNames, ['dir:b', 'file:a.js', 'file:package.json', 'file:z.js'])
    assert.ok(tree.children.findIndex(child => child.type === 'dir') < tree.children.findIndex(child => child.type === 'file'))
  })
})

test('scan.metrics reports totals, package health, languages and hotspots', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({
      name: 'app',
      main: 'src/index.ts',
      scripts: { test: 'node --test' },
    }))
    await write(root, 'src/index.ts', "import './util'\nexport const app = 1\n")
    await write(root, 'src/util.ts', 'export const util = 1\n')
    await write(root, 'tests/index.test.ts', 'test("x", () => {})\n')
    await write(root, 'README.md', '# app\n')
    await write(root, 'docs/guide.md', '# guide\n')
    await write(root, 'config.json', '{}\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    const metrics = scan.metrics
    assert.equal(metrics.totals.totalFiles, 7)
    assert.equal(metrics.totals.sourceFiles, 2)
    assert.equal(metrics.totals.testFiles, 1)
    assert.equal(metrics.totals.docsFiles, 2)
    assert.equal(metrics.totals.totalBytes, scan.totalBytes)
    assert.deepEqual(metrics.totals.languages.map(item => item.name), ['ts'])
    assert.equal(metrics.totals.languages[0].files, 3)
    assert.equal(metrics.totals.languages[0].percent, 100)

    assert.equal(metrics.packages.length, 1)
    const app = metrics.packages[0]
    assert.equal(app.name, 'app')
    assert.equal(app.path, '.')
    assert.equal(app.source, 2)
    assert.equal(app.test, 1)
    assert.equal(app.docs, 2)
    assert.deepEqual(app.testCommands, ['npm run test'])
    assert.ok(app.entryPoints.includes('src/index.ts'))
    assert.equal(app.health.level, 'good')
    assert.equal(app.health.score, 100)
    assert.deepEqual(app.health.reasons, [])

    assert.ok(metrics.hotspots.length > 0)
    assert.ok(metrics.hotspots.every(item => !item.path.startsWith('tests')))
    assert.ok(metrics.hotspots.some(item => item.path === 'src'))
    assert.ok(metrics.hotspots.every(item => item.files > 0 && item.bytes >= 0))
    assert.ok(metrics.insights.some(item => item.code === 'no-tests') === false)
  })
})

test('metrics reports no-tests, no-test-command, no-docs, no-entry, high-fanout and large-files', async () => {
  await withRepo(async root => {
    const dependencies = {}
    for (let index = 0; index < 30; index += 1) dependencies[`dep-${index}`] = '1.0.0'
    await write(root, 'packages/a/package.json', JSON.stringify({ name: 'a', dependencies }))
    await write(root, 'packages/a/src/helper.js', 'export const helper = 1\n')
    await write(root, 'packages/a/src/big.js', `// ${'x'.repeat(301 * 1024)}\n`)
    for (let index = 0; index < 10; index += 1) {
      await write(root, `packages/a/vendor/lib-${index}.js`, 'module.exports = 1\n')
    }
    await write(root, 'packages/b/package.json', JSON.stringify({ name: 'b' }))
    await write(root, 'packages/b/tests/b.test.js', 'test("b", () => {})\n')
    await write(root, 'packages/b/README.md', '# b\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    const codes = scan.metrics.insights.map(item => item.code)
    for (const code of ['no-tests', 'no-test-command', 'no-docs', 'no-entry', 'high-fanout', 'large-files', 'vendor-heavy']) {
      assert.ok(codes.includes(code), `missing insight ${code}: ${codes.join(',')}`)
    }
    for (const insight of scan.metrics.insights) {
      assert.ok(['info', 'warn', 'error'].includes(insight.severity))
      assert.equal(typeof insight.message, 'string')
      assert.equal(typeof insight.subject, 'string')
      assert.equal(typeof insight.fix, 'string')
    }
    const severity = { error: 0, warn: 1, info: 2 }
    const sorted = [...scan.metrics.insights].sort((left, right) => (
      severity[left.severity] - severity[right.severity]
      || left.code.localeCompare(right.code)
      || left.subject.localeCompare(right.subject)
      || left.message.localeCompare(right.message)
    ))
    assert.deepEqual(scan.metrics.insights, sorted)
  })
})

test('metrics reports unbound source files and monorepo-root-only workspaces', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({
      name: 'workspace-root',
      workspaces: ['packages/*'],
    }))
    await write(root, 'src/helper.js', 'export const helper = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    const codes = scan.metrics.insights.map(item => item.code)
    assert.ok(codes.includes('monorepo-root-only'))
    // The root package manifest does bind src/helper.js, so it is not unbound here.
    assert.ok(!codes.includes('unbound-source'))
  })

  await withRepo(async root => {
    await write(root, 'packages/a/package.json', JSON.stringify({ name: 'a' }))
    await write(root, 'lib/outside.js', 'export const outside = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    const insight = scan.metrics.insights.find(item => item.code === 'unbound-source')
    assert.ok(insight !== undefined)
    assert.equal(insight.severity, 'warn')
  })
})

test('suggestBlueprint creates child layers and uses real import aggregates', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({
      name: 'layered-root',
      private: true,
      workspaces: ['packages/*'],
    }))
    await write(root, 'packages/a/package.json', JSON.stringify({
      name: '@layered/a',
      main: 'src/index.ts',
      dependencies: { 'left-pad': '1.0.0' },
    }))
    await write(root, 'packages/b/package.json', JSON.stringify({
      name: '@layered/b',
      main: 'src/index.ts',
    }))
    await write(root, 'packages/a/src/index.ts', "import { b } from '../../b/src/index'\nexport const a = b\n")
    await write(root, 'packages/a/src/inner.ts', "import './index'\n")
    await write(root, 'packages/b/src/index.ts', "import './util'\nexport const b = 1\n")
    await write(root, 'packages/b/src/util.ts', "import './index'\nexport const util = 1\n")
  }, async root => {
    const scan = await scanWorkspace(root)
    const suggestions = suggestBlueprint(scan)
    assert.deepEqual(suggestions.modules.map(module => module.code), ['A1', 'A2', 'A3'])
    assert.deepEqual(suggestions.modules.map(module => module.layerId), ['A', 'A', 'A'])

    const moduleA = suggestions.modules.find(module => module.name === '@layered/a')
    const moduleB = suggestions.modules.find(module => module.name === '@layered/b')
    assert.deepEqual(moduleA.dependsOn, [moduleB.id])

    const topModule = suggestions.diagrams.find(diagram => diagram.key === 'module')
    assert.equal(topModule.nodes.length, 3)
    assert.equal(topModule.edges.length, 1)
    assert.equal(topModule.edges[0].from, moduleA.id)
    assert.equal(topModule.edges[0].to, moduleB.id)
    assert.equal(topModule.edges[0].weight, 1)
    assert.ok(suggestions.notes.some(note => note.includes('真实 import 聚合边')))

    assert.deepEqual(suggestions.layers.map(layer => layer.letter), ['A', 'B', 'C'])
    const layerB = suggestions.layers.find(layer => layer.letter === 'B')
    const layerC = suggestions.layers.find(layer => layer.letter === 'C')
    assert.equal(layerB.parentModuleId, moduleA.id)
    assert.equal(layerC.parentModuleId, moduleB.id)
    assert.equal(layerB.modules[0].layerId, 'B')
    assert.equal(layerB.modules[0].parentId, moduleA.id)
    assert.equal(layerB.modules[0].code, 'B1')
    assert.equal(layerC.modules[0].layerId, 'C')
    assert.equal(layerC.modules[0].parentId, moduleB.id)
    assert.ok(layerB.diagrams.some(diagram => diagram.key === 'B:module' && diagram.layerId === 'B'))
    assert.ok(layerC.diagrams.some(diagram => diagram.key === 'C:module' && diagram.layerId === 'C'))
    // Root diagrams stay A-only so `scan apply` keeps working.
    assert.deepEqual(suggestions.diagrams.map(diagram => diagram.key), ['module', 'c4'])
    assert.ok(Array.isArray(suggestions.insights))
  })
})

test('suggestBlueprint caps child layers and records merged packages', async () => {
  await withRepo(async root => {
    for (let index = 1; index <= 6; index += 1) {
      await write(root, `packages/p${index}/package.json`, JSON.stringify({ name: `p${index}` }))
      await write(root, `packages/p${index}/src/index.js`, `export const p${index} = ${index}\n`)
    }
  }, async root => {
    const scan = await scanWorkspace(root)
    const suggestions = suggestBlueprint(scan)
    assert.equal(suggestions.layers[0].letter, 'A')
    assert.equal(suggestions.layers.length, 5)
    assert.ok(suggestions.notes.some(note => note.includes('子层上限')))
    for (const layer of suggestions.layers.slice(1)) {
      assert.ok(layer.parentModuleId !== null)
      assert.ok(layer.modules.length <= 8)
      assert.ok(layer.modules.every(module => module.layerId === layer.letter))
      assert.ok(layer.diagrams.some(diagram => diagram.key === `${layer.letter}:module`))
    }
  })
})

test('imports respect maxImportFiles and maxImportBytes budgets', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'budget' }))
    await write(root, 'src/a.js', "import './b'\n")
    await write(root, 'src/b.js', "import './c'\n")
    await write(root, 'src/c.js', 'export const c = 1\n')
  }, async root => {
    const byFiles = await scanWorkspace(root, { maxImportFiles: 1 })
    assert.equal(byFiles.imports.files, 1)
    assert.ok(byFiles.warnings.some(warning => warning.includes('import 文件上限')))

    const byBytes = await scanWorkspace(root, { maxImportBytes: 1 })
    assert.equal(byBytes.imports.files, 0)
    assert.ok(byBytes.warnings.some(warning => warning.includes('import 读取上限')))
  })
})

test('imports handle malformed source files and cap unresolved entries', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'broken-imports' }))
    await write(root, 'src/bad.js', 'import { broken\nrequire(\n')
    const lines = []
    for (let index = 0; index < 150; index += 1) lines.push(`import './missing-${index}'`)
    await write(root, 'src/many.js', `${lines.join('\n')}\n`)
  }, async root => {
    const scan = await scanWorkspace(root)
    assert.equal(scan.imports.unresolved.length, 100)
    assert.ok(scan.imports.unresolved.every(item => item.reason === 'not-found'))
    assert.ok(scan.warnings.some(warning => warning.includes('无法解析的 import 超过')))
    assert.equal(scan.imports.external.length, 0)
  })
})

test('empty repositories expose empty graph structures', async () => {
  const root = await makeTemp()
  try {
    const scan = await scanWorkspace(root)
    assert.deepEqual(scan.imports, {
      files: 0,
      edges: [],
      unresolved: [],
      external: [],
      byDirectory: [],
    })
    assert.equal(scan.metrics.totals.totalFiles, 0)
    assert.deepEqual(scan.metrics.totals.languages, [])
    assert.deepEqual(scan.metrics.packages, [])
    assert.deepEqual(scan.metrics.hotspots, [])
    assert.deepEqual(scan.metrics.insights, [])
    assert.equal(scan.tree.type, 'dir')
    assert.deepEqual(scan.tree.children, [])
    assert.equal(scan.tree.files, 0)

    const suggestions = suggestBlueprint(scan)
    assert.deepEqual(suggestions.modules.map(module => module.code), ['A1'])
    assert.deepEqual(suggestions.layers.map(layer => layer.letter), ['A'])
    assert.deepEqual(suggestions.insights, [])
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('graph results are deterministic across repeated scans', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'stable' }))
    await write(root, 'src/b.js', "import './a'\n")
    await write(root, 'src/a.js', "import './b'\nexport const a = 1\n")
    await write(root, 'README.md', '# stable\n')
  }, async root => {
    const first = await scanWorkspace(root)
    const second = await scanWorkspace(root)
    assert.deepEqual(first.metrics, second.metrics)
    assert.deepEqual(first.tree, second.tree)
    assert.deepEqual(first.imports, second.imports)
    assert.deepEqual(suggestBlueprint(first), suggestBlueprint(second))
  })
})
