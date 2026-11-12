import assert from 'node:assert/strict'
import test from 'node:test'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  IMPORT_DIAGRAM_LIMITS,
  TREE_LIMITS,
  buildFileTree,
  buildImportDiagram,
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
      aliases: [],
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

// ---------------------------------------------------------------------------
// v0.16: TypeScript/JavaScript path aliases

test('scanner resolves tsconfig paths with JSONC, fallbacks and baseUrl imports', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'alias-app' }))
    await write(root, 'tsconfig.json', [
      '{',
      '  // comments and trailing commas are valid tsconfig syntax',
      '  "compilerOptions": {',
      '    "baseUrl": ".",',
      '    "paths": {',
      '      "@/*": ["src/*", "fallback/*"], /* second target is a fallback */',
      '    },',
      '  },',
      '}',
      '',
    ].join('\n'))
    await write(root, 'src/index.ts', [
      "import { util } from '@/util'",
      "import { pkg } from '@/pkg'",
      "import { only } from '@/fallback-only'",
      "import '@/missing'",
      "import react from 'react'",
      '',
    ].join('\n'))
    await write(root, 'src/other.ts', "import 'src/util'\n")
    await write(root, 'src/util.ts', 'export const util = 1\n')
    await write(root, 'src/pkg/index.ts', 'export const pkg = 1\n')
    await write(root, 'fallback/fallback-only.ts', 'export const only = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    const edges = scan.imports.edges
    const aliasEdge = (from, to) => edges.find(edge => edge.from === from && edge.to === to)

    assert.deepEqual(scan.imports.aliases, [{
      config: 'tsconfig.json',
      baseUrl: '.',
      patterns: ['@/*'],
    }])
    assert.equal(aliasEdge('src/index.ts', 'src/util.ts').alias, true)
    assert.equal(aliasEdge('src/index.ts', 'src/pkg/index.ts').alias, true)
    // The second paths target is tried when the first one has no file.
    assert.equal(aliasEdge('src/index.ts', 'fallback/fallback-only.ts').alias, true)
    // Without a matching paths pattern, baseUrl still supports absolute imports.
    assert.equal(aliasEdge('src/other.ts', 'src/util.ts').alias, true)
    const failed = scan.imports.unresolved.find(item => item.specifier === '@/missing')
    assert.equal(failed.reason, 'alias')
    assert.ok(scan.imports.external.includes('react'))
    assert.ok(!scan.imports.unresolved.some(item => item.specifier === 'react'))
  })
})

test('scanner applies the nearest jsconfig and keeps relative imports working', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'workspace', workspaces: ['packages/*'] }))
    await write(root, 'tsconfig.json', JSON.stringify({
      compilerOptions: { baseUrl: '.', paths: { '@/*': ['root-src/*'] } },
    }, null, 2))
    await write(root, 'root-src/root.ts', 'export const root = 1\n')
    await write(root, 'src/root-user.ts', "import '@/root'\n")
    await write(root, 'packages/a/package.json', JSON.stringify({ name: '@alias/a' }))
    await write(root, 'packages/a/jsconfig.json', [
      '{',
      '  // package-local jsconfig wins for files under packages/a',
      '  "compilerOptions": {',
      '    "baseUrl": "lib",',
      '    "paths": { "~/*": ["*"] },',
      '  },',
      '}',
      '',
    ].join('\n'))
    await write(root, 'packages/a/src/index.js', [
      "import { helper } from '~/helper'",
      "import { local } from './local'",
      "import { root } from '@/root'",
      '',
    ].join('\n'))
    await write(root, 'packages/a/src/local.js', 'export const local = 1\n')
    await write(root, 'packages/a/lib/helper.js', 'export const helper = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    const edges = scan.imports.edges
    assert.ok(edges.some(edge => (
      edge.from === 'packages/a/src/index.js'
      && edge.to === 'packages/a/lib/helper.js'
      && edge.alias === true
    )))
    assert.ok(edges.some(edge => (
      edge.from === 'packages/a/src/index.js'
      && edge.to === 'packages/a/src/local.js'
      && edge.alias === undefined
    )))
    // The parent tsconfig is not merged into the nearest package config.
    assert.ok(scan.imports.external.includes('@/root'))
    assert.ok(edges.some(edge => (
      edge.from === 'src/root-user.ts' && edge.to === 'root-src/root.ts' && edge.alias === true
    )))
    const summaries = scan.imports.aliases
    assert.deepEqual(summaries.map(item => item.config), ['packages/a/jsconfig.json', 'tsconfig.json'])
    assert.deepEqual(summaries[0], {
      config: 'packages/a/jsconfig.json',
      baseUrl: 'packages/a/lib',
      patterns: ['~/*'],
    })
  })
})

test('scan without alias config keeps bare specifiers external', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'no-alias' }))
    await write(root, 'src/index.ts', "import 'src/util'\nimport './local'\n")
    await write(root, 'src/util.ts', 'export const util = 1\n')
    await write(root, 'src/local.ts', 'export const local = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    assert.deepEqual(scan.imports.aliases, [])
    assert.ok(scan.imports.external.includes('src/util'))
    assert.ok(scan.imports.edges.some(edge => edge.to === 'src/local.ts' && edge.alias === undefined))
  })
})

// ---------------------------------------------------------------------------
// v0.16: Python src layout and absolute imports

test('scanner resolves Python src layout, __init__.py and keeps stdlib external', async () => {
  await withRepo(async root => {
    await write(root, 'pyproject.toml', '[project]\nname = "layout"\n')
    await write(root, 'src/pkg/__init__.py', '')
    await write(root, 'src/pkg/mod.py', 'value = 1\n')
    await write(root, 'src/pkg/sub/__init__.py', '')
    await write(root, 'src/pkg/sub/deep.py', 'deep = 1\n')
    await write(root, 'src/app.py', [
      'from pkg.mod import value',
      'import pkg',
      'from pkg.sub.deep import deep',
      'from pkg.missing import nope',
      'import os',
      'import typing',
      'from collections import OrderedDict',
      'from requests import get',
      '',
    ].join('\n'))
    await write(root, 'tools/__init__.py', '')
    await write(root, 'tools/helper.py', 'helper = 1\n')
    await write(root, 'main.py', 'from tools.helper import helper\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    const edges = scan.imports.edges
    const has = (from, to) => edges.some(edge => edge.from === from && edge.to === to)
    assert.ok(has('src/app.py', 'src/pkg/mod.py'))
    assert.ok(has('src/app.py', 'src/pkg/__init__.py'))
    assert.ok(has('src/app.py', 'src/pkg/sub/deep.py'))
    assert.ok(has('main.py', 'tools/helper.py'))
    const missing = scan.imports.unresolved.find(item => item.specifier === 'pkg.missing')
    assert.equal(missing.reason, 'not-found')
    for (const external of ['os', 'typing', 'collections', 'requests']) {
      assert.ok(scan.imports.external.includes(external), `expected external ${external}`)
      assert.ok(!edges.some(edge => edge.specifier === external))
    }
    assert.ok(!scan.imports.external.some(name => name === 'pkg'))
  })
})

// ---------------------------------------------------------------------------
// v0.16: buildImportDiagram

function syntheticScan(edges) {
  return { root: '/repo', imports: { edges } }
}

test('buildImportDiagram returns an empty legal diagram without imports', () => {
  for (const scan of [syntheticScan([]), {}, { imports: null }]) {
    assert.deepEqual(buildImportDiagram(scan), {
      key: 'imports',
      layerId: 'A',
      type: 'module',
      title: 'File import graph',
      nodes: [],
      edges: [],
      truncated: false,
    })
  }
  assert.throws(() => buildImportDiagram(null), TypeError)
})

test('buildImportDiagram aggregates directory edges with weights and stable order', () => {
  const edges = [
    { from: 'src/a/one.ts', to: 'src/b/two.ts' },
    { from: 'src/a/three.ts', to: 'src/b/two.ts' },
    { from: 'src/b/two.ts', to: 'src/a/one.ts' },
    { from: 'src/a/one.ts', to: 'src/a/three.ts' },
  ]
  const diagram = buildImportDiagram(syntheticScan(edges))
  assert.equal(diagram.key, 'imports')
  assert.equal(diagram.layerId, 'A')
  assert.equal(diagram.type, 'module')
  assert.equal(diagram.title, 'File import graph')
  assert.deepEqual(diagram.nodes.map(node => node.id), ['src/a', 'src/b'])
  assert.ok(diagram.nodes.every(node => node.type === 'module' && typeof node.label === 'string'))
  assert.deepEqual(diagram.edges, [
    { from: 'src/a', to: 'src/b', label: 'imports', kind: 'depends', weight: 2 },
    { from: 'src/b', to: 'src/a', label: 'imports', kind: 'depends', weight: 1 },
  ])
  assert.equal(diagram.truncated, false)
  assert.deepEqual(buildImportDiagram(syntheticScan(edges)), diagram)
})

test('buildImportDiagram uses file nodes for a single directory under the node cap', () => {
  const edges = [
    { from: 'src/one.ts', to: 'src/two.ts' },
    { from: 'src/two.ts', to: 'src/three.ts' },
  ]
  const diagram = buildImportDiagram(syntheticScan(edges))
  assert.deepEqual(diagram.nodes.map(node => node.id), ['src/one.ts', 'src/three.ts', 'src/two.ts'])
  assert.deepEqual(diagram.edges.map(edge => edge.weight), [1, 1])
  assert.equal(diagram.truncated, false)
  const directory = buildImportDiagram(syntheticScan(edges), { level: 'directory' })
  assert.deepEqual(directory.nodes.map(node => node.id), ['src'])
  assert.deepEqual(directory.edges, [])
})

test('buildImportDiagram caps nodes and edges deterministically', () => {
  const edges = []
  for (let index = 0; index < 60; index += 1) {
    edges.push({ from: `pkg-${index}/a.ts`, to: `pkg-${index}/b.ts` })
    edges.push({ from: `pkg-${index}/a.ts`, to: `pkg-${(index + 1) % 60}/b.ts` })
  }
  const first = buildImportDiagram(syntheticScan(edges))
  const second = buildImportDiagram(syntheticScan(edges))
  assert.deepEqual(first, second)
  assert.ok(first.nodes.length <= IMPORT_DIAGRAM_LIMITS.maxNodes)
  assert.ok(first.edges.length <= IMPORT_DIAGRAM_LIMITS.maxEdges)
  assert.equal(first.truncated, true)
  const ids = new Set(first.nodes.map(node => node.id))
  for (const edge of first.edges) {
    assert.ok(ids.has(edge.from), `edge source ${edge.from} must be a node`)
    assert.ok(ids.has(edge.to), `edge target ${edge.to} must be a node`)
  }
  assert.deepEqual(first.nodes.map(node => node.id), [...first.nodes.map(node => node.id)].sort())
  assert.deepEqual(
    first.edges.map(edge => `${edge.from}|${edge.to}`),
    [...first.edges]
      .sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to))
      .map(edge => `${edge.from}|${edge.to}`),
  )

  const narrow = buildImportDiagram(syntheticScan(edges), { maxNodes: 4, maxEdges: 5 })
  assert.ok(narrow.nodes.length <= 4)
  assert.ok(narrow.edges.length <= 5)
  assert.equal(narrow.truncated, true)
  assert.deepEqual(narrow, buildImportDiagram(syntheticScan(edges), { maxNodes: 4, maxEdges: 5 }))
})

// ---------------------------------------------------------------------------
// v0.16: child-layer edges reuse import weights and stay node-consistent

test('suggestBlueprint child layers use real import weights and consistent node ids', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'import-layers' }))
    await write(root, 'src/ignored.ts', 'export const ignored = 1\n')
    await write(root, 'app/entry.ts', [
      "import { x } from '../lib/x'",
      "import { y } from '../lib/y'",
      "import './entry'",
      '',
    ].join('\n'))
    await write(root, 'lib/x.ts', 'export const x = 1\n')
    await write(root, 'lib/y.ts', 'export const y = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    const suggestions = suggestBlueprint(scan)
    const layer = suggestions.layers.find(item => item.letter === 'B')
    assert.ok(layer !== undefined)
    const diagram = layer.diagrams.find(item => item.key === 'B:module')
    const app = layer.modules.find(module => module.name === 'app')
    const lib = layer.modules.find(module => module.name === 'lib')
    assert.deepEqual(app.dependsOn, [lib.id])
    assert.deepEqual(diagram.edges, [{ from: app.id, to: lib.id, label: 'depends', kind: 'depends', weight: 2 }])
    const nodeIds = new Set(diagram.nodes.map(node => node.id))
    assert.deepEqual([...nodeIds].sort(), layer.modules.map(module => module.id).sort())
    for (const edge of diagram.edges) {
      assert.ok(nodeIds.has(edge.from) && nodeIds.has(edge.to))
    }
  })
})

test('suggestBlueprint falls back to package dependencies when no imports exist', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'manifest-only', workspaces: ['packages/*'] }))
    await write(root, 'packages/a/package.json', JSON.stringify({
      name: '@manifest/a',
      dependencies: { '@manifest/b': '1.0.0' },
    }))
    await write(root, 'packages/a/src/index.ts', 'export const a = 1\n')
    await write(root, 'packages/b/package.json', JSON.stringify({ name: '@manifest/b' }))
    await write(root, 'packages/b/src/index.ts', 'export const b = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    const suggestions = suggestBlueprint(scan)
    const moduleA = suggestions.modules.find(module => module.name === '@manifest/a')
    const moduleB = suggestions.modules.find(module => module.name === '@manifest/b')
    assert.deepEqual(moduleA.dependsOn, [moduleB.id])
    const top = suggestions.diagrams.find(diagram => diagram.key === 'module')
    assert.ok(top.edges.some(edge => edge.from === moduleA.id && edge.to === moduleB.id && edge.weight === undefined))
    for (const layer of suggestions.layers.slice(1)) {
      const diagram = layer.diagrams[0]
      const nodeIds = new Set(diagram.nodes.map(node => node.id))
      assert.deepEqual(diagram.edges, [])
      for (const module of layer.modules) assert.ok(nodeIds.has(module.id))
    }
  })
})

test('tsconfig takes precedence over jsconfig in the same directory', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'config-priority' }))
    await write(root, 'jsconfig.json', JSON.stringify({
      compilerOptions: { baseUrl: '.', paths: { '@/*': ['js/*'] } },
    }))
    await write(root, 'tsconfig.json', JSON.stringify({
      compilerOptions: { baseUrl: '.', paths: { '@/*': ['ts/*'] } },
    }))
    await write(root, 'src/index.ts', "import '@/x'\n")
    await write(root, 'ts/x.ts', 'export const source = "ts"\n')
    await write(root, 'js/x.ts', 'export const source = "js"\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    assert.ok(scan.imports.edges.some(edge => (
      edge.from === 'src/index.ts' && edge.to === 'ts/x.ts' && edge.alias === true
    )))
    assert.ok(!scan.imports.edges.some(edge => edge.to === 'js/x.ts'))
    assert.deepEqual(scan.imports.aliases.map(item => item.config), ['jsconfig.json', 'tsconfig.json'])
  })
})

// ---------------------------------------------------------------------------
// v0.17: tsconfig extends and project/workspace references

test('tsconfig extends resolves relative configs, extensionless names and merges paths wholesale', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'extends-app' }))
    await write(root, 'tsconfig.base.json', [
      '{',
      '  // base config owns baseUrl and default aliases',
      '  "compilerOptions": {',
      '    "baseUrl": "src",',
      '    "paths": {',
      '      "@base/*": ["base/*"],',
      '      "@shared/*": ["shared/*"], /* string // is not a comment */',
      '    },',
      '  },',
      '}',
      '',
    ].join('\n'))
    await write(root, 'tsconfig.json', [
      '{',
      '  "extends": "./tsconfig.base",',
      '  "compilerOptions": {',
      '    "paths": {',
      '      "@app/*": ["app/*"],',
      '      "@lit//path/*": ["lit/*"],',
      '    },',
      '  },',
      '}',
      '',
    ].join('\n'))
    await write(root, 'src/entry.ts', [
      "import '@app/page'",
      "import '@lit//path/lit'",
      "import '@base/base'",
      "import '@shared/shared'",
      '',
    ].join('\n'))
    await write(root, 'src/app/page.ts', 'export const page = 1\n')
    await write(root, 'src/lit/lit.ts', 'export const lit = 1\n')
    await write(root, 'src/base/base.ts', 'export const base = 1\n')
    await write(root, 'src/shared/shared.ts', 'export const shared = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    const edge = to => scan.imports.edges.find(item => item.from === 'src/entry.ts' && item.to === to)
    assert.equal(edge('src/app/page.ts').alias, true)
    assert.equal(edge('src/lit/lit.ts').alias, true)
    // Child `paths` replaces the parent object instead of merging keys.
    assert.ok(scan.imports.external.includes('@base/base'))
    assert.ok(scan.imports.external.includes('@shared/shared'))
    const summary = scan.imports.aliases.find(item => item.config === 'tsconfig.json')
    assert.deepEqual(summary, {
      config: 'tsconfig.json',
      baseUrl: 'src',
      patterns: ['@app/*', '@lit//path/*'],
      extends: ['tsconfig.base.json'],
    })
    assert.equal(scan.imports.aliases.length, 1)
  })
})

test('tsconfig extends inherits parent baseUrl and paths relative to the defining config', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'workspace', workspaces: ['packages/*'] }))
    await write(root, 'tsconfig.base.json', JSON.stringify({
      compilerOptions: { baseUrl: '.', paths: { '@root/*': ['src/*'] } },
    }))
    await write(root, 'packages/a/base.json', [
      '{',
      '  // baseUrl belongs to packages/a/base.json, not to the child config',
      '  "compilerOptions": {',
      '    "baseUrl": "lib",',
      '    "paths": { "~/*": ["*"] },',
      '  },',
      '}',
      '',
    ].join('\n'))
    await write(root, 'packages/a/tsconfig.json', JSON.stringify({ extends: './base.json' }))
    await write(root, 'packages/a/src/index.ts', "import '~/helper'\n")
    await write(root, 'packages/a/lib/helper.ts', 'export const helper = 1\n')
    await write(root, 'packages/b/tsconfig.json', JSON.stringify({ extends: '../../tsconfig.base.json' }))
    await write(root, 'packages/b/src/index.ts', "import '@root/util'\n")
    await write(root, 'src/util.ts', 'export const util = 1\n')
    await write(root, 'configs/paths-only.json', JSON.stringify({
      compilerOptions: { paths: { '@shared/*': ['../shared-src/*'] } },
    }))
    await write(root, 'packages/c/tsconfig.json', JSON.stringify({ extends: '../../configs/paths-only.json' }))
    await write(root, 'packages/c/src/index.ts', "import '@shared/thing'\n")
    await write(root, 'shared-src/thing.ts', 'export const thing = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    assert.ok(scan.imports.edges.some(edge => (
      edge.from === 'packages/a/src/index.ts'
      && edge.to === 'packages/a/lib/helper.ts'
      && edge.alias === true
    )))
    const packageA = scan.imports.aliases.find(item => item.config === 'packages/a/tsconfig.json')
    assert.deepEqual(packageA, {
      config: 'packages/a/tsconfig.json',
      baseUrl: 'packages/a/lib',
      patterns: ['~/*'],
      extends: ['packages/a/base.json'],
    })
    // Parent paths are inherited when the child does not define its own.
    assert.ok(scan.imports.edges.some(edge => (
      edge.from === 'packages/b/src/index.ts'
      && edge.to === 'src/util.ts'
      && edge.alias === true
    )))
    const packageB = scan.imports.aliases.find(item => item.config === 'packages/b/tsconfig.json')
    assert.deepEqual(packageB, {
      config: 'packages/b/tsconfig.json',
      baseUrl: '.',
      patterns: ['@root/*'],
      extends: ['tsconfig.base.json'],
    })
    // Inherited `paths` without baseUrl resolve from the config that declares them.
    assert.ok(scan.imports.edges.some(edge => (
      edge.from === 'packages/c/src/index.ts'
      && edge.to === 'shared-src/thing.ts'
      && edge.alias === true
    )))
    const packageC = scan.imports.aliases.find(item => item.config === 'packages/c/tsconfig.json')
    assert.deepEqual(packageC, {
      config: 'packages/c/tsconfig.json',
      baseUrl: 'configs',
      patterns: ['@shared/*'],
      extends: ['configs/paths-only.json'],
    })
  })
})

test('tsconfig extends reads node_modules packages through the package.json tsconfig field', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'package-extends' }))
    await write(root, 'node_modules/@shared/tsconfig/package.json', JSON.stringify({
      name: '@shared/tsconfig',
      tsconfig: 'tsconfig.base.json',
    }))
    await write(root, 'node_modules/@shared/tsconfig/tsconfig.base.json', JSON.stringify({
      compilerOptions: {
        // From node_modules/@shared/tsconfig back to the repository root.
        baseUrl: '../../..',
        paths: { '@pkg/*': ['src/pkg/*'] },
      },
    }))
    await write(root, 'tsconfig.json', JSON.stringify({ extends: '@shared/tsconfig' }))
    await write(root, 'src/index.ts', "import '@pkg/thing'\n")
    await write(root, 'src/pkg/thing.ts', 'export const thing = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    assert.ok(scan.imports.edges.some(edge => (
      edge.from === 'src/index.ts' && edge.to === 'src/pkg/thing.ts' && edge.alias === true
    )))
    const summary = scan.imports.aliases.find(item => item.config === 'tsconfig.json')
    assert.deepEqual(summary.patterns, ['@pkg/*'])
    assert.equal(summary.baseUrl, '.')
    assert.deepEqual(summary.extends, ['node_modules/@shared/tsconfig/tsconfig.base.json'])
  })
})

test('tsconfig extends resolves node_modules package tsconfig.json and subpaths', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'package-subpath' }))
    await write(root, 'node_modules/plain-tsconfig/tsconfig.json', JSON.stringify({
      compilerOptions: { baseUrl: '../..', paths: { 'plain/*': ['plain-src/*'] } },
    }))
    await write(root, 'node_modules/plain-tsconfig/extra.json', JSON.stringify({
      compilerOptions: { baseUrl: '../..', paths: { 'extra/*': ['extra-src/*'] } },
    }))
    await write(root, 'tsconfig.json', JSON.stringify({ extends: 'plain-tsconfig' }))
    await write(root, 'src/index.ts', "import 'plain/x'\n")
    await write(root, 'plain-src/x.ts', 'export const x = 1\n')
    await write(root, 'packages/sub/tsconfig.json', JSON.stringify({ extends: 'plain-tsconfig/extra.json' }))
    await write(root, 'packages/sub/src/index.ts', "import 'extra/y'\n")
    await write(root, 'extra-src/y.ts', 'export const y = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    assert.ok(scan.imports.edges.some(edge => (
      edge.from === 'src/index.ts' && edge.to === 'plain-src/x.ts' && edge.alias === true
    )))
    assert.ok(scan.imports.edges.some(edge => (
      edge.from === 'packages/sub/src/index.ts' && edge.to === 'extra-src/y.ts' && edge.alias === true
    )))
    const sub = scan.imports.aliases.find(item => item.config === 'packages/sub/tsconfig.json')
    assert.deepEqual(sub.extends, ['node_modules/plain-tsconfig/extra.json'])
    assert.deepEqual(sub.patterns, ['extra/*'])
  })
})

test('tsconfig extends follows deep chains and warns instead of looping on cycles', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'deep-chain' }))
    await write(root, 'configs/level5.json', JSON.stringify({
      compilerOptions: { baseUrl: '..', paths: { '@deep/*': ['deep/*'] } },
    }))
    await write(root, 'configs/level4.json', JSON.stringify({ extends: './level5.json' }))
    await write(root, 'configs/level3.json', JSON.stringify({ extends: './level4.json' }))
    await write(root, 'configs/level2.json', JSON.stringify({ extends: './level3.json' }))
    await write(root, 'configs/level1.json', JSON.stringify({ extends: './level2.json' }))
    await write(root, 'tsconfig.json', JSON.stringify({ extends: './configs/level1.json' }))
    await write(root, 'src/index.ts', "import '@deep/feature'\n")
    await write(root, 'deep/feature.ts', 'export const feature = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    assert.ok(scan.imports.edges.some(edge => (
      edge.from === 'src/index.ts' && edge.to === 'deep/feature.ts' && edge.alias === true
    )))
    const summary = scan.imports.aliases.find(item => item.config === 'tsconfig.json')
    assert.equal(summary.baseUrl, '.')
    assert.deepEqual(summary.patterns, ['@deep/*'])
    assert.equal(summary.extends.length, 5)
  })

  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'cycle-chain' }))
    await write(root, 'a.json', JSON.stringify({ extends: './b.json' }))
    await write(root, 'b.json', JSON.stringify({ extends: './a.json' }))
    await write(root, 'tsconfig.json', JSON.stringify({ extends: './a.json' }))
    await write(root, 'src/index.ts', 'export const value = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    assert.ok(scan.warnings.some(warning => warning.includes('循环')))
    // The root config is still usable; the cyclic parent contributes nothing.
    assert.deepEqual(scan.imports.aliases.map(item => item.patterns), [[]])
    assert.ok(scan.imports.aliases[0].extends.includes('a.json'))
  })
})

test('tsconfig extends stops after eight levels with a warning', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'depth-limit' }))
    for (let level = 1; level <= 10; level += 1) {
      const config = level === 10
        ? { compilerOptions: { baseUrl: '..', paths: { '@deep/*': ['deep/*'] } } }
        : { extends: `./level${level + 1}.json` }
      await write(root, `configs/level${level}.json`, JSON.stringify(config))
    }
    await write(root, 'tsconfig.json', JSON.stringify({ extends: './configs/level1.json' }))
    await write(root, 'deep/feature.ts', 'export const feature = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    assert.ok(scan.warnings.some(warning => warning.includes('超过 8 层')))
    const summary = scan.imports.aliases.find(item => item.config === 'tsconfig.json')
    assert.deepEqual(summary.patterns, [])
  })
})

test('tsconfig extends warns about broken JSON and keeps the child config usable', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'broken-extends' }))
    await write(root, 'base.json', '{ "compilerOptions": { "baseUrl": "src", "paths": { "@base/*": ["base/*"] } ')
    await write(root, 'tsconfig.json', JSON.stringify({
      extends: './base.json',
      compilerOptions: { baseUrl: '.', paths: { '@ok/*': ['ok/*'] } },
    }))
    await write(root, 'src/index.ts', "import '@ok/thing'\n")
    await write(root, 'ok/thing.ts', 'export const thing = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    assert.ok(scan.warnings.some(warning => (
      warning.includes('解析别名配置失败') && warning.includes('base.json')
    )))
    assert.ok(scan.imports.edges.some(edge => (
      edge.from === 'src/index.ts' && edge.to === 'ok/thing.ts' && edge.alias === true
    )))
    const summary = scan.imports.aliases.find(item => item.config === 'tsconfig.json')
    assert.deepEqual(summary.patterns, ['@ok/*'])
    assert.equal(summary.extends, undefined)
  })
})

test('tsconfig references add directory and file configs as merged alias candidates', async () => {
  await withRepo(async root => {
    await write(root, 'package.json', JSON.stringify({ name: 'references-app', workspaces: ['packages/*'] }))
    await write(root, 'tsconfig.json', JSON.stringify({
      compilerOptions: { baseUrl: '.', paths: { '@root/*': ['src/*'] } },
      references: [
        { path: './packages/b' },
        { path: './packages/a/tsconfig.app.json' },
        { path: '.' },
      ],
    }))
    await write(root, 'src/main.ts', [
      "import '@root/local'",
      "import '@b/util'",
      "import '@a/helper'",
      "import 'react'",
      '',
    ].join('\n'))
    await write(root, 'src/local.ts', 'export const local = 1\n')
    await write(root, 'packages/b/tsconfig.json', JSON.stringify({
      compilerOptions: { baseUrl: '.', paths: { '@b/*': ['src/*'] } },
    }))
    await write(root, 'packages/b/src/util.ts', 'export const util = 1\n')
    await write(root, 'packages/b/src/index.ts', "import '@b/util'\n")
    await write(root, 'packages/a/tsconfig.app.json', JSON.stringify({
      compilerOptions: { baseUrl: '.', paths: { '@a/*': ['lib/*'] } },
    }))
    await write(root, 'packages/a/lib/helper.ts', 'export const helper = 1\n')
  }, async root => {
    const scan = await scanWorkspace(root)
    const edge = to => scan.imports.edges.find(item => item.from === 'src/main.ts' && item.to === to)
    assert.equal(edge('src/local.ts').alias, true)
    // Imports from a sibling package resolve through the referenced config.
    assert.equal(edge('packages/b/src/util.ts').alias, true)
    assert.equal(edge('packages/a/lib/helper.ts').alias, true)
    assert.ok(scan.imports.external.includes('react'))
    assert.ok(scan.imports.edges.some(edgeItem => (
      edgeItem.from === 'packages/b/src/index.ts'
      && edgeItem.to === 'packages/b/src/util.ts'
      && edgeItem.alias === true
    )))
    assert.deepEqual(
      scan.imports.aliases.map(item => item.config),
      ['packages/a/tsconfig.app.json', 'packages/b/tsconfig.json', 'tsconfig.json'],
    )
  })
})

