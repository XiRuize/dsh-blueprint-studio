import assert from 'node:assert/strict'
import test from 'node:test'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { apply } from '../index.js'
import {
  LANGUAGE_BY_EXTENSION,
  SCAN_LIMITS,
  languageOf,
  scanWorkspace,
  suggestBlueprint,
} from '../lib/scanner.js'

async function makeTemp() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'blueprint-scanner-test-'))
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

async function seedMonorepo() {
  const root = await makeTemp()
  await write(root, 'package.json', JSON.stringify({
    name: 'mono',
    private: true,
    workspaces: ['packages/*'],
    scripts: { start: 'node packages/a/src/index.js', test: 'node --test' },
    dependencies: { leftpad: '^1.0.0' },
    devDependencies: { typescript: '^5.0.0' },
  }, null, 2))
  await write(root, 'packages/a/package.json', JSON.stringify({
    name: '@mono/a',
    main: 'src/index.js',
    bin: { a: 'bin/a.js' },
    scripts: { test: 'vitest', build: 'tsc' },
    dependencies: { '@mono/b': '*' },
  }, null, 2))
  await write(root, 'packages/a/src/index.js', 'export const a = 1\n')
  await write(root, 'packages/a/tests/a.test.js', 'test("a", () => {})\n')
  await write(root, 'packages/a/bin/a.js', '#!/usr/bin/env node\n')
  await write(root, 'packages/b/package.json', JSON.stringify({
    name: '@mono/b',
    scripts: { lint: 'eslint .' },
  }, null, 2))
  await write(root, 'packages/b/src/index.ts', 'export const b: number = 2\n')
  await write(root, 'node_modules/leftpad/package.json', '{ this is not json')
  await write(root, 'node_modules/leftpad/index.js', 'module.exports = 1\n')
  await write(root, '.env', 'SECRET=should-not-be-read\n')
  await write(root, '.git/HEAD', 'ref: refs/heads/main\n')
  await write(root, '.git/config', '[remote "origin"]\n\turl = https://example.com/mono.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n')
  return root
}

test('scanner walks a monorepo without reading node_modules or .env', async () => {
  const root = await seedMonorepo()
  try {
    const scan = await scanWorkspace(root)
    assert.equal(scan.root, path.resolve(root))
    const paths = scan.files.map(file => file.path)
    assert.ok(paths.includes('package.json'))
    assert.ok(paths.includes('packages/a/src/index.js'))
    assert.ok(!paths.some(item => item.startsWith('node_modules/')))
    assert.ok(!paths.some(item => item === '.env' || item.startsWith('.env.')))
    assert.deepEqual(paths, [...paths].sort())

    assert.equal(scan.fileCount, scan.files.length)
    assert.equal(scan.languages.js.files, 3)
    assert.equal(scan.languages.ts.files, 1)
    assert.ok(scan.languages.js.bytes > 0)

    assert.deepEqual(scan.packages.map(entry => entry.relativePath), ['.', 'packages/a', 'packages/b'])
    assert.deepEqual(scan.packages.map(entry => entry.name), ['mono', '@mono/a', '@mono/b'])
    assert.deepEqual(scan.packages[1].deps, ['@mono/b'])
    assert.deepEqual(scan.packages[2].scripts, { lint: 'eslint .' })

    assert.equal(scan.manifests.filter(manifest => manifest.kind === 'npm').length, 3)
    assert.deepEqual(scan.manifests.map(manifest => manifest.path), [
      'package.json',
      'packages/a/package.json',
      'packages/b/package.json',
    ])

    assert.ok(scan.sourceDirs.includes('packages/a/src'))
    assert.ok(scan.sourceDirs.includes('packages/b/src'))
    assert.ok(scan.entryPoints.includes('packages/a/src/index.js'))
    assert.ok(scan.entryPoints.includes('packages/a/bin/a.js'))
    assert.ok(scan.entryPoints.includes('packages/b/src/index.ts'))
    assert.ok(scan.testCommands.includes('npm run test'))
    assert.ok(scan.testCommands.includes('npm --prefix packages/a run test'))
    assert.ok(scan.testCommands.includes('npm --prefix packages/a run build'))
    assert.ok(scan.testCommands.includes('npm --prefix packages/b run lint'))
    assert.deepEqual(scan.warnings, [])

    assert.equal(scan.git.branch, 'main')
    assert.equal(scan.git.remote, 'https://example.com/mono.git')
    assert.equal(scan.git.remotes.origin, 'https://example.com/mono.git')
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('scanner recognizes python, cargo and go manifests and their commands', async () => {
  const root = await makeTemp()
  try {
    await write(root, 'py/pyproject.toml', [
      '[project]',
      'name = "pyservice"',
      'dependencies = ["requests>=2", "pytest>=8"]',
      '',
      '[project.scripts]',
      'pyservice = "pyservice.cli:main"',
      '',
      '[tool.pytest.ini_options]',
      'testpaths = ["tests"]',
      '',
    ].join('\n'))
    await write(root, 'py/requirements.txt', 'flask==3.0\nrequests>=2\n# comment\n')
    await write(root, 'py/pyservice/cli.py', 'def main():\n    return 0\n')
    await write(root, 'py/tests/test_cli.py', 'def test_cli():\n    assert True\n')
    await write(root, 'rust/Cargo.toml', [
      '[package]',
      'name = "rusty"',
      'version = "0.1.0"',
      '',
      '[[bin]]',
      'name = "rusty"',
      'path = "src/main.rs"',
      '',
      '[dependencies]',
      'serde = "1"',
      '',
    ].join('\n'))
    await write(root, 'rust/src/main.rs', 'fn main() {}\n')
    await write(root, 'go/go.mod', [
      'module example.com/gosvc',
      '',
      'go 1.22',
      '',
      'require (',
      '\tgithub.com/example/dep v1.2.3',
      ')',
      '',
    ].join('\n'))
    await write(root, 'go/main.go', 'package main\n\nfunc main() {}\n')

    const scan = await scanWorkspace(root)
    assert.deepEqual(scan.packages.map(entry => entry.kind), ['go', 'python', 'rust'])
    assert.deepEqual(scan.packages.map(entry => entry.name), ['example.com/gosvc', 'pyservice', 'rusty'])
    assert.ok(scan.testCommands.includes('pytest'))
    assert.ok(scan.testCommands.includes('cargo test'))
    assert.ok(scan.testCommands.includes('go test ./...'))
    assert.ok(scan.externalDeps.includes('requests'))
    assert.ok(scan.externalDeps.includes('flask'))
    assert.ok(scan.externalDeps.includes('github.com/example/dep'))
    assert.ok(scan.entryPoints.includes('py/pyservice/cli.py'))
    assert.ok(scan.entryPoints.includes('rust/src/main.rs'))
    assert.ok(scan.languages.py.files >= 2)
    assert.equal(scan.languages.rs.files, 1)
    assert.equal(scan.languages.go.files, 1)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('scanner enforces file and read budgets with warnings', async () => {
  const root = await makeTemp()
  try {
    await write(root, 'a.js', 'a\n')
    await write(root, 'b.js', 'b\n')
    await write(root, 'c.js', 'c\n')
    await write(root, 'package.json', JSON.stringify({ name: 'limited', scripts: { test: 'x' } }))

    const limited = await scanWorkspace(root, { maxFiles: 3 })
    assert.equal(limited.fileCount, 3)
    assert.ok(limited.warnings.some(warning => warning.includes('达到文件上限')))

    const tiny = await scanWorkspace(root, { maxFileBytes: 10 })
    assert.ok(tiny.warnings.some(warning => warning.includes('单文件上限')))
    assert.equal(tiny.manifests.length, 1)
    assert.equal(tiny.manifests[0].error, '未读取（超出上限）')

    const budget = await scanWorkspace(root, { maxTotalBytes: 5 })
    assert.ok(budget.warnings.some(warning => warning.includes('总读取上限')))
    assert.equal(budget.readBytes, 0)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('scanner reports malformed JSON but keeps walking', async () => {
  const root = await makeTemp()
  try {
    await write(root, 'package.json', '{ "name": "broken", ')
    await write(root, 'src/index.js', 'export default 1\n')

    const scan = await scanWorkspace(root)
    assert.equal(scan.manifests.length, 1)
    assert.equal(scan.manifests[0].kind, 'npm')
    assert.equal(scan.manifests[0].error, 'JSON 解析失败')
    assert.ok(scan.warnings.some(warning => warning.includes('解析 package.json 失败')))
    assert.deepEqual(scan.packages, [])
    assert.equal(scan.fileCount, 2)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('scanner handles an empty directory and missing root', async () => {
  const root = await makeTemp()
  try {
    const scan = await scanWorkspace(root)
    assert.equal(scan.root, path.resolve(root))
    assert.deepEqual(scan.files, [])
    assert.deepEqual(scan.packages, [])
    assert.deepEqual(scan.manifests, [])
    assert.deepEqual(scan.sourceDirs, [])
    assert.deepEqual(scan.entryPoints, [])
    assert.deepEqual(scan.testCommands, [])
    assert.deepEqual(scan.externalDeps, [])
    assert.deepEqual(scan.warnings, [])
    assert.equal(scan.git, undefined)

    const suggestions = suggestBlueprint(scan)
    assert.equal(suggestions.mounts.length, 1)
    assert.equal(suggestions.mounts[0].id, 'root')
    assert.equal(suggestions.modules.length, 1)
    assert.equal(suggestions.modules[0].code, 'A1')
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }

  await assert.rejects(
    () => scanWorkspace(path.join(root, 'missing')),
    /无法读取扫描根目录/u,
  )
})

test('suggestBlueprint maps packages to mounts, modules and diagram edges', async () => {
  const root = await seedMonorepo()
  try {
    const scan = await scanWorkspace(root)
    const suggestions = suggestBlueprint(scan)

    assert.deepEqual(suggestions.mounts.map(mount => mount.id), ['root', 'packages-a', 'packages-b'])
    assert.deepEqual(suggestions.mounts.map(mount => mount.root), ['.', 'packages/a', 'packages/b'])
    for (const mount of suggestions.mounts) {
      assert.equal(mount.kind, 'working')
      assert.equal(mount.access, 'rw')
    }

    assert.deepEqual(suggestions.modules.map(module => module.code), ['A1', 'A2', 'A3'])
    assert.deepEqual(suggestions.modules.map(module => module.layerId), ['A', 'A', 'A'])
    assert.deepEqual(suggestions.modules.map(module => module.mountIds[0]), ['root', 'packages-a', 'packages-b'])
    const moduleA = suggestions.modules.find(module => module.name === '@mono/a')
    const moduleB = suggestions.modules.find(module => module.name === '@mono/b')
    assert.deepEqual(moduleA.dependsOn, [moduleB.id])
    assert.equal(moduleA.verification.tests.status, 'pending')
    assert.ok(moduleA.files.includes('packages/a/src/index.js'))

    const moduleDiagram = suggestions.diagrams.find(diagram => diagram.type === 'module')
    assert.equal(moduleDiagram.nodes.length, 3)
    assert.equal(moduleDiagram.edges.length, 1)
    assert.deepEqual(
      { from: moduleDiagram.edges[0].from, to: moduleDiagram.edges[0].to, kind: moduleDiagram.edges[0].kind },
      { from: moduleA.id, to: moduleB.id, kind: 'depends' },
    )

    const c4 = suggestions.diagrams.find(diagram => diagram.type === 'c4')
    assert.equal(c4.nodes.filter(node => node.type === 'container').length, 3)
    assert.ok(c4.nodes.some(node => node.type === 'external' && node.label === 'leftpad'))
    assert.ok(c4.nodes.some(node => node.type === 'external' && node.label === 'typescript'))
    assert.ok(!c4.nodes.some(node => node.type === 'external' && node.label === '@mono/b'))
    assert.ok(c4.edges.length >= 2)
    assert.ok(suggestions.notes.some(note => note.includes('scan apply 尚未实现')))

    const slugs = suggestions.mounts.map(mount => mount.id)
    assert.equal(new Set(slugs).size, slugs.length)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('suggestBlueprint splits a single root package into source-directory modules', async () => {
  const root = await makeTemp()
  try {
    await write(root, 'package.json', JSON.stringify({ name: 'single', scripts: { test: 'node --test' } }))
    await write(root, 'src/index.js', 'export default 1\n')
    await write(root, 'lib/util.js', 'export const util = 1\n')
    await write(root, 'docs/readme.md', '# docs\n')

    const scan = await scanWorkspace(root)
    const suggestions = suggestBlueprint(scan)
    assert.equal(suggestions.mounts.length, 1)
    assert.deepEqual(suggestions.mounts[0].root, '.')
    assert.equal(suggestions.modules.length, 2)
    assert.deepEqual(suggestions.modules.map(module => module.code), ['A1', 'A2'])
    assert.deepEqual(suggestions.modules.map(module => module.name), ['src', 'lib'])
    assert.ok(suggestions.modules.every(module => module.mountIds[0] === 'root'))
    assert.ok(!suggestions.modules.some(module => module.name === 'docs'))
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('language helpers expose the documented extension mapping', () => {
  assert.equal(languageOf('index.tsx'), 'tsx')
  assert.equal(languageOf('main.go'), 'go')
  assert.equal(languageOf('README.md'), undefined)
  assert.equal(LANGUAGE_BY_EXTENSION['.cpp'], 'cpp')
  assert.equal(LANGUAGE_BY_EXTENSION['.h'], 'h')
  assert.equal(SCAN_LIMITS.maxFiles, 5000)
  assert.equal(SCAN_LIMITS.maxFileBytes, 512 * 1024)
  assert.equal(SCAN_LIMITS.maxTotalBytes, 50 * 1024 * 1024)
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
  const agent = { id: 'session-scanner', session: { header: { cwd, id: 'session-scanner' } } }
  return { tools, commands, agent, dispose: () => { for (const dispose of disposers) dispose() } }
}

test('/blueprint scan is read-only and returns scan plus suggestions', async () => {
  const root = await makeTemp()
  const plugin = setupPlugin(root)
  try {
    await write(root, 'package.json', JSON.stringify({ name: 'cmd-scan', scripts: { test: 'node --test' } }))
    await write(root, 'src/index.js', 'export default 1\n')

    assert.match(plugin.commands[0].input.hint, /scan/u)

    const result = await plugin.commands[0].handler({ rawInput: 'scan', agent: plugin.agent })
    assert.equal(result.kind, 'success')
    const payload = JSON.parse(result.text)
    assert.equal(payload.scan.root, path.resolve(root))
    assert.equal(payload.scan.packages[0].name, 'cmd-scan')
    assert.equal(payload.suggestions.mounts[0].root, '.')
    assert.ok(payload.suggestions.modules.length >= 1)

    assert.equal(await exists(path.join(root, '.dsh')), false)
    assert.equal(await exists(path.join(root, '.dsh/blueprints')), false)

    const applyResult = await plugin.commands[0].handler({ rawInput: 'scan apply', agent: plugin.agent })
    assert.equal(applyResult.kind, 'success')
    const applyPayload = JSON.parse(applyResult.text)
    assert.equal(applyPayload.ok, true)
    assert.equal(applyPayload.path, '.dsh/blueprints/session-scanner.json')
    assert.ok(applyPayload.modulesAdded >= 1)
    assert.ok(applyPayload.diagramsAdded >= 1)
    const blueprintPath = path.join(root, '.dsh', 'blueprints', 'session-scanner.json')
    const blueprint = JSON.parse(await fs.readFile(blueprintPath, 'utf8'))
    assert.ok(blueprint.modules.length >= 1)
    assert.ok(blueprint.diagrams.some(diagram => diagram.type === 'module'))
    assert.ok(blueprint.mounts.length >= 1)

    const unknown = await plugin.commands[0].handler({ rawInput: 'scan nope', agent: plugin.agent })
    assert.equal(unknown.kind, 'error')
    assert.match(unknown.text, /未知 scan 参数/u)
  } finally {
    plugin.dispose()
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('scanner extracts pnpm, composer, maven and gradle manifests as text without running them', async () => {
  const root = await makeTemp()
  try {
    await write(root, 'package.json', JSON.stringify({ name: 'workspace-root' }))
    await write(root, 'pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n  - 'packages/*'\n")
    await write(root, 'composer.json', JSON.stringify({
      name: 'acme/app',
      require: { php: '^8.2', 'monolog/monolog': '^3.0' },
      scripts: { test: 'phpunit' },
    }, null, 2))
    await write(root, 'pom.xml', '<project><groupId>com.acme</groupId><artifactId>acme</artifactId><modules><module>core</module></modules></project>\n')
    await write(root, 'build.gradle', "plugins { id 'java' }\n")

    const scan = await scanWorkspace(root)
    const byKind = new Map(scan.manifests.map(manifest => [manifest.kind, manifest]))
    assert.deepEqual([...byKind.keys()].sort(), ['composer', 'gradle', 'maven', 'npm', 'pnpm-workspace'])
    assert.deepEqual(byKind.get('pnpm-workspace').packages, ['apps/*', 'packages/*'])
    assert.equal(byKind.get('composer').name, 'acme/app')
    assert.deepEqual(byKind.get('composer').dependencies, ['monolog/monolog', 'php'])
    assert.equal(byKind.get('maven').name, 'acme')
    assert.equal(byKind.get('maven').groupId, 'com.acme')
    assert.deepEqual(byKind.get('maven').modules, ['core'])
    assert.match(byKind.get('gradle').text, /java/u)
    assert.deepEqual(scan.packages.map(entry => entry.name), ['workspace-root'])
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('scanner read budget counts only manifest text and keeps arrays stable', async () => {
  const root = await seedMonorepo()
  try {
    const first = await scanWorkspace(root)
    const second = await scanWorkspace(root)
    assert.deepEqual(first.files, second.files)
    assert.deepEqual(first.packages, second.packages)
    assert.deepEqual(first.warnings, second.warnings)
    assert.ok(first.readBytes > 0)
    assert.ok(first.readBytes < first.totalBytes)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
