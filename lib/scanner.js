// Repository scanner (v0.14).
//
// Read-only, dependency-free repository reconnaissance used by `/blueprint scan`.
// The scanner never executes project code, never spawns git, never reads .env or
// secret files, and stops at hard traversal/read budgets so it stays cheap on
// large repositories. Every collection is deterministically sorted.

import { promises as fs } from 'node:fs'
import path from 'node:path'

export const SCAN_LIMITS = Object.freeze({
  maxFiles: 5000,
  maxFileBytes: 512 * 1024,
  maxTotalBytes: 50 * 1024 * 1024,
  maxSourceDirs: 200,
  maxEntryPoints: 100,
})

export const SUGGEST_LIMITS = Object.freeze({
  maxModules: 50,
  maxExternalNodes: 30,
})

export const SKIP_DIR_NAMES = Object.freeze([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  '.dsh',
])

export const SOURCE_DIR_NAMES = Object.freeze([
  'src',
  'apps',
  'packages',
  'services',
  'lib',
  'cmd',
  'server',
  'client',
  'web',
  'api',
  'tests',
  'test',
  'docs',
])

// Source directory preference used when turning a single root package into
// modules. Build output folders such as dist/build are already skipped.
const SOURCE_DIR_PRIORITY = Object.freeze([
  'src',
  'app',
  'apps',
  'packages',
  'services',
  'lib',
  'cmd',
  'server',
  'client',
  'web',
  'api',
  'tests',
  'test',
  'docs',
])

export const LANGUAGE_BY_EXTENSION = Object.freeze({
  '.js': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.ts': 'ts',
  '.mts': 'ts',
  '.cts': 'ts',
  '.tsx': 'tsx',
  '.jsx': 'jsx',
  '.py': 'py',
  '.go': 'go',
  '.rs': 'rs',
  '.java': 'java',
  '.kt': 'kt',
  '.kts': 'kt',
  '.cs': 'cs',
  '.rb': 'rb',
  '.php': 'php',
  '.c': 'c',
  '.h': 'h',
  '.cc': 'cpp',
  '.cpp': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hh': 'cpp',
  '.swift': 'swift',
  '.dart': 'dart',
  '.scala': 'scala',
  '.lua': 'lua',
  '.sql': 'sql',
})

const BINARY_EXTENSIONS = new Set([
  // images
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.tif', '.tiff',
  '.avif', '.heic', '.psd', '.svg',
  // fonts
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  // archives
  '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar', '.jar', '.war',
  '.whl', '.egg',
  // binaries / compiled output
  '.exe', '.dll', '.so', '.dylib', '.bin', '.class', '.pyc', '.pyo', '.o',
  '.a', '.lib', '.node', '.wasm', '.map',
  // media and documents
  '.mp4', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.flac', '.ogg', '.pdf',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
])

const TEST_SCRIPT_NAMES = new Set(['test', 'lint', 'typecheck', 'build'])
const GIT_REMOTE_SECTION = /^\[remote\s+"([^"]+)"\]$/u
const REQUIREMENT_NAME = /^([A-Za-z0-9_.-]+)/u
const ENV_FILE = /^\.env(?:\.|$)/u

function compareText(left, right) {
  const a = String(left ?? '')
  const b = String(right ?? '')
  return a < b ? -1 : a > b ? 1 : 0
}

function sortText(values) {
  return values.sort(compareText)
}

function uniqueSorted(values) {
  return [...new Set(values.map(value => String(value)))].sort(compareText)
}

function normalizeRelative(parts) {
  return parts.filter(Boolean).join('/')
}

function extensionOf(name) {
  return path.extname(name).toLowerCase()
}

export function languageOf(fileName) {
  return LANGUAGE_BY_EXTENSION[extensionOf(fileName)]
}

function isSkippedFile(name) {
  if (ENV_FILE.test(name)) return true
  if (name === '.DS_Store') return true
  return BINARY_EXTENSIONS.has(extensionOf(name))
}

function manifestKindOf(name) {
  if (name === 'package.json') return 'npm'
  if (name === 'composer.json') return 'composer'
  if (name === 'pnpm-workspace.yaml') return 'pnpm-workspace'
  if (name === 'pyproject.toml') return 'python'
  if (name === 'Cargo.toml') return 'rust'
  if (name === 'go.mod') return 'go'
  if (name === 'pom.xml') return 'maven'
  if (name === 'build.gradle' || name === 'build.gradle.kts') return 'gradle'
  if (/^requirements[\w.-]*\.txt$/iu.test(name)) return 'requirements'
  return undefined
}

function normalizeLimits(options) {
  const input = options !== null && typeof options === 'object' ? options : {}
  const number = (value, fallback) => (
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
  )
  return {
    maxFiles: number(input.maxFiles, SCAN_LIMITS.maxFiles),
    maxFileBytes: number(input.maxFileBytes, SCAN_LIMITS.maxFileBytes),
    maxTotalBytes: number(input.maxTotalBytes, SCAN_LIMITS.maxTotalBytes),
  }
}

async function walkRepository(root, limits, warnings) {
  const files = []
  const directories = []
  const sourceDirs = []
  let truncated = false
  let sourceTruncated = false
  const pending = [{ absolute: root, relative: '' }]

  while (pending.length > 0) {
    if (files.length >= limits.maxFiles) {
      truncated = true
      break
    }
    const current = pending.pop()
    let entries
    try {
      entries = await fs.readdir(current.absolute, { withFileTypes: true })
    } catch (error) {
      warnings.push(`无法读取目录：${current.relative || '.'}（${errorMessage(error)}）`)
      continue
    }
    entries.sort((left, right) => compareText(left.name, right.name))
    const subdirectories = []
    for (const entry of entries) {
      if (files.length >= limits.maxFiles) {
        truncated = true
        break
      }
      const relative = normalizeRelative([current.relative, entry.name])
      if (entry.isSymbolicLink()) {
        warnings.push(`跳过符号链接：${relative}`)
        continue
      }
      if (entry.isDirectory()) {
        if (SKIP_DIR_NAMES.includes(entry.name)) continue
        if (sourceDirs.length < SCAN_LIMITS.maxSourceDirs && SOURCE_DIR_NAMES.includes(entry.name)) {
          sourceDirs.push(relative)
        } else if (sourceDirs.length >= SCAN_LIMITS.maxSourceDirs && SOURCE_DIR_NAMES.includes(entry.name)) {
          sourceTruncated = true
        }
        directories.push(relative)
        subdirectories.push({ absolute: path.join(current.absolute, entry.name), relative })
        continue
      }
      if (!entry.isFile()) continue
      if (isSkippedFile(entry.name)) continue
      let stat
      try {
        stat = await fs.stat(path.join(current.absolute, entry.name))
      } catch (error) {
        warnings.push(`无法读取文件信息：${relative}（${errorMessage(error)}）`)
        continue
      }
      files.push({
        path: relative,
        absolute: path.join(current.absolute, entry.name),
        size: stat.size,
        language: languageOf(entry.name) ?? null,
      })
    }
    for (let index = subdirectories.length - 1; index >= 0; index -= 1) {
      pending.push(subdirectories[index])
    }
  }

  if (truncated) warnings.push(`达到文件上限 ${limits.maxFiles}，扫描结果已截断。`)
  if (sourceTruncated) warnings.push(`源码目录超过 ${SCAN_LIMITS.maxSourceDirs} 个，已截断。`)
  files.sort((left, right) => compareText(left.path, right.path))
  directories.sort(compareText)
  sortText(sourceDirs)
  return { files, directories, sourceDirs }
}

function errorMessage(error) {
  return String(error?.message ?? error)
}

function createReader(limits, warnings) {
  let totalRead = 0
  let exhausted = false
  return {
    spent() {
      return totalRead
    },
    async read(record) {
      if (record.size > limits.maxFileBytes) {
        warnings.push(`文件超过单文件上限 ${limits.maxFileBytes} 字节，未读取：${record.path}`)
        return undefined
      }
      if (exhausted) return undefined
      if (totalRead + record.size > limits.maxTotalBytes) {
        exhausted = true
        warnings.push(`达到总读取上限 ${limits.maxTotalBytes} 字节，后续文件未读取。`)
        return undefined
      }
      try {
        const text = await fs.readFile(record.absolute, 'utf8')
        totalRead += record.size
        return text
      } catch (error) {
        warnings.push(`读取失败：${record.path}（${errorMessage(error)}）`)
        return undefined
      }
    },
  }
}

function stripQuotes(value) {
  const trimmed = String(value ?? '').trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1)
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1)
  return trimmed
}

function stripTomlComment(value) {
  let quote = ''
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (quote !== '') {
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '#') return value.slice(0, index)
  }
  return value
}

function balancedValue(value) {
  let quote = ''
  let depth = 0
  for (const char of value) {
    if (quote !== '') {
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '[' || char === '{') depth += 1
    if (char === ']' || char === '}') depth -= 1
  }
  return quote === '' && depth <= 0
}

// Deliberately shallow TOML reader: enough for names, scripts and dependency
// keys. Nested inline tables stay text; we never try to be a full parser.
function parseToml(text) {
  const sections = Object.create(null)
  let current = ''
  let pendingKey = ''
  let pendingValue = ''
  const store = (section, key, value) => {
    if (sections[section] === undefined) sections[section] = Object.create(null)
    sections[section][key] = value
  }
  for (const rawLine of String(text ?? '').split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (pendingKey !== '') {
      pendingValue += ` ${line}`
      if (balancedValue(pendingValue)) {
        store(current, pendingKey, stripTomlComment(pendingValue).trim())
        pendingKey = ''
        pendingValue = ''
      }
      continue
    }
    if (line === '' || line.startsWith('#')) continue
    const header = line.match(/^\[\[?([^\]]+)\]\]?$/u)
    if (header !== null) {
      current = header[1].trim()
      if (sections[current] === undefined) sections[current] = Object.create(null)
      continue
    }
    const equals = line.indexOf('=')
    if (equals < 0) continue
    const key = stripQuotes(line.slice(0, equals).trim())
    const value = line.slice(equals + 1).trim()
    if (!balancedValue(value)) {
      pendingKey = key
      pendingValue = value
      continue
    }
    store(current, key, stripTomlComment(value).trim())
  }
  return sections
}

function tomlString(value) {
  return stripQuotes(stripTomlComment(String(value ?? '')).trim())
}

function tomlArray(value) {
  const text = String(value ?? '')
  const result = []
  const pattern = /"([^"]*)"|'([^']*)'/gu
  let match
  while ((match = pattern.exec(text)) !== null) result.push(match[1] ?? match[2] ?? '')
  return result
}

function dependencyName(spec) {
  let value = stripQuotes(spec).trim()
  if (value === '' || value.startsWith('{')) return ''
  value = value.replace(/\[[^\]]*\]/gu, '')
  value = value.split(/\s+/u)[0]
  const cut = value.search(/[<>=!~^@]/u)
  if (cut >= 0) value = value.slice(0, cut)
  if (value === '' || value.includes('/') || value.includes(':') || value.includes('*')) return ''
  return value
}

function parseRequirements(text) {
  const names = []
  for (const rawLine of String(text ?? '').split(/\r?\n/u)) {
    const line = rawLine.replace(/\s+#.*$/u, '').trim()
    if (line === '' || line.startsWith('#') || line.startsWith('-')) continue
    const match = line.match(REQUIREMENT_NAME)
    if (match !== null) names.push(match[1])
  }
  return uniqueSorted(names)
}

function parseGoMod(text) {
  let moduleName = ''
  const requirements = []
  let inRequireBlock = false
  for (const rawLine of String(text ?? '').split(/\r?\n/u)) {
    const line = rawLine.replace(/\/\/.*$/u, '').trim()
    if (line === '') continue
    const moduleMatch = line.match(/^module\s+(\S+)/u)
    if (moduleMatch !== null) {
      moduleName = moduleMatch[1]
      continue
    }
    if (/^require\s*\($/u.test(line)) {
      inRequireBlock = true
      continue
    }
    if (inRequireBlock && line === ')') {
      inRequireBlock = false
      continue
    }
    if (inRequireBlock) {
      const name = line.split(/\s+/u)[0]
      if (name !== '') requirements.push(name)
      continue
    }
    const single = line.match(/^require\s+(\S+)\s+\S+/u)
    if (single !== null) requirements.push(single[1])
  }
  return { module: moduleName, requirements: uniqueSorted(requirements) }
}

function parsePnpmWorkspace(text) {
  const packages = []
  let inPackages = false
  for (const rawLine of String(text ?? '').split(/\r?\n/u)) {
    const line = rawLine.replace(/#.*$/u, '').trim()
    if (line === '') continue
    if (/^packages\s*:/u.test(line)) {
      inPackages = true
      const inline = line.slice(line.indexOf(':') + 1).trim()
      if (inline.startsWith('[')) {
        packages.push(...tomlArray(inline))
        inPackages = false
      }
      continue
    }
    if (inPackages && line.startsWith('-')) {
      packages.push(stripQuotes(line.slice(1).trim()))
      continue
    }
    if (!rawLine.startsWith(' ') && !line.startsWith('-')) inPackages = false
  }
  return uniqueSorted(packages)
}

function parsePomXml(text) {
  const value = String(text ?? '')
  const artifact = value.match(/<artifactId>([^<]+)<\/artifactId>/u)
  const group = value.match(/<groupId>([^<]+)<\/groupId>/u)
  const modules = []
  const modulePattern = /<module>([^<]+)<\/module>/gu
  let match
  while ((match = modulePattern.exec(value)) !== null) modules.push(match[1].trim())
  return {
    name: artifact?.[1]?.trim() ?? '',
    groupId: group?.[1]?.trim() ?? '',
    modules: uniqueSorted(modules),
  }
}

function parseCargoBins(text) {
  const bins = []
  const pattern = /\[\[bin\]\]([\s\S]*?)(?=\n\s*\[|\s*$)/gu
  let match
  while ((match = pattern.exec(String(text ?? ''))) !== null) {
    const block = match[1]
    const name = block.match(/^\s*name\s*=\s*"([^"]+)"/mu)?.[1] ?? ''
    const file = block.match(/^\s*path\s*=\s*"([^"]+)"/mu)?.[1] ?? ''
    if (name !== '' || file !== '') bins.push({ name, path: file })
  }
  return bins
}

function normalizeScripts(raw) {
  const scripts = {}
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return scripts
  for (const key of Object.keys(raw).sort(compareText)) {
    if (typeof raw[key] === 'string') scripts[key] = raw[key]
  }
  return scripts
}

function normalizeBin(raw) {
  if (typeof raw === 'string' && raw.trim() !== '') return { default: raw.trim() }
  const bins = {}
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return bins
  for (const key of Object.keys(raw).sort(compareText)) {
    if (typeof raw[key] === 'string' && raw[key].trim() !== '') bins[key] = raw[key].trim()
  }
  return bins
}

function workspaceEntries(raw) {
  if (Array.isArray(raw)) return uniqueSorted(raw.filter(item => typeof item === 'string'))
  if (raw !== null && typeof raw === 'object' && Array.isArray(raw.packages)) {
    return uniqueSorted(raw.packages.filter(item => typeof item === 'string'))
  }
  return []
}

async function parseManifest(record, reader, warnings) {
  const kind = manifestKindOf(path.basename(record.path))
  if (kind === undefined) return undefined
  const text = await reader.read(record)
  if (text === undefined) {
    return { path: record.path, kind, error: '未读取（超出上限）' }
  }
  const manifest = { path: record.path, kind }
  if (kind === 'npm' || kind === 'composer') {
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      warnings.push(`解析 ${record.path} 失败：${errorMessage(error)}`)
      manifest.error = 'JSON 解析失败'
      return manifest
    }
    manifest.name = typeof parsed.name === 'string' ? parsed.name : ''
    manifest.scripts = normalizeScripts(parsed.scripts)
    if (kind === 'npm') {
      manifest.workspaces = workspaceEntries(parsed.workspaces)
      manifest.main = typeof parsed.main === 'string' ? parsed.main : ''
      manifest.bin = normalizeBin(parsed.bin)
      manifest.dependencies = uniqueSorted(Object.keys(parsed.dependencies ?? {}))
      manifest.devDependencies = uniqueSorted(Object.keys(parsed.devDependencies ?? {}))
    } else {
      manifest.dependencies = uniqueSorted(Object.keys(parsed.require ?? {}))
      manifest.devDependencies = uniqueSorted(Object.keys(parsed['require-dev'] ?? {}))
    }
    return manifest
  }
  if (kind === 'pnpm-workspace') {
    manifest.packages = parsePnpmWorkspace(text)
    manifest.text = text
    return manifest
  }
  if (kind === 'requirements') {
    manifest.packages = parseRequirements(text)
    manifest.text = text
    return manifest
  }
  if (kind === 'go') {
    const parsed = parseGoMod(text)
    manifest.name = parsed.module
    manifest.dependencies = parsed.requirements
    manifest.text = text
    return manifest
  }
  if (kind === 'maven') {
    Object.assign(manifest, parsePomXml(text))
    manifest.text = text
    return manifest
  }
  if (kind === 'gradle') {
    manifest.text = text
    return manifest
  }
  if (kind === 'python' || kind === 'rust') {
    const sections = parseToml(text)
    manifest.text = text
    if (kind === 'python') {
      manifest.name = tomlString(sections.project?.name ?? sections['tool.poetry']?.name ?? '')
      const scripts = {}
      for (const section of ['project.scripts', 'tool.poetry.scripts']) {
        for (const [key, value] of Object.entries(sections[section] ?? {})) {
          scripts[key] = tomlString(value)
        }
      }
      manifest.scripts = normalizeScripts(scripts)
      const dependencies = []
      for (const spec of tomlArray(sections.project?.dependencies ?? '')) {
        const name = dependencyName(spec)
        if (name !== '') dependencies.push(name)
      }
      for (const key of Object.keys(sections['tool.poetry.dependencies'] ?? {})) {
        if (key !== 'python') dependencies.push(key)
      }
      manifest.dependencies = uniqueSorted(dependencies)
      manifest.pytest = Object.keys(sections).some(key => key.startsWith('tool.pytest'))
        || manifest.dependencies.includes('pytest')
    } else {
      manifest.name = tomlString(sections.package?.name ?? '')
      manifest.workspaces = tomlArray(sections.workspace?.members ?? '')
      const dependencies = []
      for (const key of Object.keys(sections.dependencies ?? {})) dependencies.push(key)
      manifest.dependencies = uniqueSorted(dependencies)
      manifest.bins = parseCargoBins(text)
    }
    return manifest
  }
  return manifest
}

function parseGitConfig(text) {
  const remotes = {}
  let current = ''
  for (const rawLine of String(text ?? '').split(/\r?\n/u)) {
    const line = rawLine.trim()
    const header = line.match(GIT_REMOTE_SECTION)
    if (header !== null) {
      current = header[1]
      remotes[current] = remotes[current] ?? ''
      continue
    }
    const url = line.match(/^url\s*=\s*(.+)$/u)
    if (url !== null && current !== '' && remotes[current] === '') {
      remotes[current] = url[1].trim()
      continue
    }
    if (line.startsWith('[')) current = ''
  }
  return remotes
}

async function readGit(root) {
  const dotGit = path.join(root, '.git')
  let gitDir = dotGit
  try {
    const metadata = await fs.stat(dotGit)
    if (metadata.isFile()) {
      // Linked worktrees store a "gitdir: <path>" pointer instead of a directory.
      const pointer = (await fs.readFile(dotGit, 'utf8')).trim()
      if (!pointer.startsWith('gitdir:')) return undefined
      const target = pointer.slice('gitdir:'.length).trim()
      if (target === '') return undefined
      gitDir = path.isAbsolute(target) ? target : path.resolve(root, target)
    }
  } catch {
    return undefined
  }
  let head
  try {
    head = await fs.readFile(path.join(gitDir, 'HEAD'), 'utf8')
  } catch {
    return undefined
  }
  const git = {}
  const headText = head.trim()
  if (headText.startsWith('ref: ')) {
    const ref = headText.slice(5).trim()
    git.branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref
  } else if (headText !== '') {
    git.commit = headText
  }
  let configDir = gitDir
  try {
    const commonDir = (await fs.readFile(path.join(gitDir, 'commondir'), 'utf8')).trim()
    if (commonDir !== '') configDir = path.isAbsolute(commonDir) ? commonDir : path.resolve(gitDir, commonDir)
  } catch {
    // A plain repository has no commondir file.
  }
  try {
    const config = await fs.readFile(path.join(configDir, 'config'), 'utf8')
    const remotes = parseGitConfig(config)
    const names = Object.keys(remotes).sort(compareText)
    git.remote = remotes.origin ?? (names.length > 0 ? remotes[names[0]] : '')
    git.remotes = remotes
  } catch {
    // Missing or unreadable config is ignored by design.
  }
  return git
}

function packagePriority(kind) {
  return kind === 'npm' ? 0 : kind === 'python' ? 1 : kind === 'rust' ? 2 : 3
}

function packageNameFromManifest(manifest, directory) {
  if (typeof manifest.name === 'string' && manifest.name.trim() !== '') return manifest.name.trim()
  const base = directory === '' ? path.basename(manifest.path) : path.posix.basename(directory)
  return base === '' ? 'root' : base
}

function buildPackages(manifests) {
  const byDirectory = new Map()
  const packages = []
  for (const manifest of manifests) {
    if (manifest.error !== undefined) continue
    if (!['npm', 'python', 'rust', 'go'].includes(manifest.kind)) continue
    const directory = path.posix.dirname(manifest.path)
    const relativePath = directory === '.' ? '' : directory
    const kind = manifest.kind
    let entry = byDirectory.get(relativePath)
    if (entry === undefined) {
      entry = {
        name: packageNameFromManifest(manifest, relativePath),
        relativePath,
        kind,
        scripts: {},
        deps: [],
        devDeps: [],
        manifests: [],
        dependencies: [],
        devDependencies: [],
        pythonScripts: {},
        cargoBins: [],
        pytest: false,
        moduleName: '',
      }
      byDirectory.set(relativePath, entry)
      packages.push(entry)
    }
    if (packagePriority(kind) < packagePriority(entry.kind)) {
      entry.kind = kind
      entry.name = packageNameFromManifest(manifest, relativePath)
    }
    entry.manifests.push(manifest.path)
    entry.scripts = { ...entry.scripts, ...(manifest.scripts ?? {}) }
    entry.dependencies.push(...(manifest.dependencies ?? []))
    entry.devDependencies.push(...(manifest.devDependencies ?? []))
    if (kind === 'python') {
      entry.pythonScripts = { ...entry.pythonScripts, ...(manifest.scripts ?? {}) }
      entry.pytest = entry.pytest || manifest.pytest === true
    }
    if (kind === 'rust') entry.cargoBins.push(...(manifest.bins ?? []))
    if (kind === 'go') entry.moduleName = manifest.name ?? ''
  }
  for (const entry of packages) {
    entry.manifests = uniqueSorted(entry.manifests)
    entry.dependencies = uniqueSorted(entry.dependencies)
    entry.devDependencies = uniqueSorted(entry.devDependencies)
    entry.deps = uniqueSorted([...entry.dependencies, ...entry.devDependencies])
    entry.devDeps = entry.devDependencies
    entry.relativePath = entry.relativePath === '' ? '.' : entry.relativePath
  }
  packages.sort((left, right) => compareText(left.relativePath, right.relativePath))
  return packages
}

function packageTestCommands(entry) {
  const commands = []
  const prefix = entry.relativePath === '.' ? '' : entry.relativePath
  for (const name of Object.keys(entry.scripts).sort(compareText)) {
    if (!TEST_SCRIPT_NAMES.has(name)) continue
    commands.push(prefix === '' ? `npm run ${name}` : `npm --prefix ${prefix} run ${name}`)
  }
  if (entry.pytest) commands.push('pytest')
  if (entry.kind === 'rust' || entry.manifests.some(item => item.endsWith('Cargo.toml'))) commands.push('cargo test')
  if (entry.kind === 'go' || entry.manifests.some(item => item.endsWith('go.mod'))) commands.push('go test ./...')
  return uniqueSorted(commands)
}

function existingFile(fileSet, candidate) {
  const normalized = String(candidate ?? '').replace(/\\/gu, '/').replace(/^\.\//u, '')
  return fileSet.has(normalized) ? normalized : ''
}

function scriptEntryCandidates(command) {
  const candidates = []
  const pattern = /(?:^|[\s"'=])((?:\.\/)?[\w@./\\-]+\.[A-Za-z0-9]+)/gu
  let match
  while ((match = pattern.exec(String(command ?? ''))) !== null) candidates.push(match[1])
  return candidates
}

function collectEntryPoints(packages, files, manifestDetails) {
  const fileSet = new Set(files.map(file => file.path))
  const entries = []
  for (const entry of packages) {
    const directory = entry.relativePath === '.' ? '' : entry.relativePath
    for (const [name, target] of Object.entries(entry.scripts)) {
      if (name !== 'start' && name !== 'dev') continue
      for (const candidate of scriptEntryCandidates(target)) {
        const resolved = existingFile(fileSet, normalizeRelative([directory, candidate]))
        if (resolved !== '') entries.push(resolved)
      }
    }
    if (entry.kind === 'rust') {
      for (const bin of entry.cargoBins) {
        const target = bin.path !== '' ? bin.path : bin.name !== '' ? `src/bin/${bin.name}.rs` : ''
        const resolved = target === '' ? '' : existingFile(fileSet, normalizeRelative([directory, target]))
        if (resolved !== '') entries.push(resolved)
        else if (bin.name !== '') {
          const main = existingFile(fileSet, normalizeRelative([directory, 'src/main.rs']))
          if (main !== '') entries.push(main)
        }
      }
    }
    for (const target of Object.values(entry.pythonScripts)) {
      const moduleName = String(target).split(':')[0].trim().replace(/\./gu, '/')
      if (moduleName === '') continue
      for (const candidate of [`${moduleName}.py`, `src/${moduleName}.py`]) {
        const resolved = existingFile(fileSet, normalizeRelative([directory, candidate]))
        if (resolved !== '') entries.push(resolved)
      }
    }
  }
  // package.json main/bin values recorded while reading manifests.
  for (const detail of manifestDetails) {
    for (const target of detail.targets) {
      const resolved = existingFile(fileSet, normalizeRelative([detail.directory, target]))
      if (resolved !== '') entries.push(resolved)
    }
  }
  const convention = /^(?:index|main|server|app)\.(?:js|mjs|cjs|ts|tsx|jsx|py|go|rs)$/u
  for (const file of files) {
    if (convention.test(path.posix.basename(file.path))) entries.push(file.path)
  }
  return uniqueSorted(entries).slice(0, SCAN_LIMITS.maxEntryPoints)
}

// package.json main/bin values gathered while reading manifests. The collector
// is fed this list so entry points keep their package-relative base.

function collectManifestEntryTargets(manifest) {
  const targets = []
  if (typeof manifest.main === 'string' && manifest.main.trim() !== '') targets.push(manifest.main.trim())
  for (const target of Object.values(manifest.bin ?? {})) targets.push(target)
  return targets
}

export async function scanWorkspace(root, options = {}) {
  if (typeof root !== 'string' || root.trim() === '') throw new TypeError('scanWorkspace 需要 root 路径。')
  const absoluteRoot = path.resolve(root)
  let stat
  try {
    stat = await fs.stat(absoluteRoot)
  } catch (error) {
    throw new Error(`无法读取扫描根目录：${absoluteRoot}（${errorMessage(error)}）`)
  }
  if (!stat.isDirectory()) throw new Error(`扫描根目录不是目录：${absoluteRoot}`)

  const limits = normalizeLimits(options)
  const warnings = []
  const walked = await walkRepository(absoluteRoot, limits, warnings)
  const read = createReader(limits, warnings)

  const manifestDetails = []
  const manifests = []
  for (const file of walked.files) {
    const kind = manifestKindOf(path.basename(file.path))
    if (kind === undefined) continue
    const manifest = await parseManifest(file, read, warnings)
    if (manifest === undefined) continue
    manifests.push(manifest)
    if (kind === 'npm') {
      const targets = collectManifestEntryTargets(manifest)
      if (targets.length > 0) {
        const directory = path.posix.dirname(file.path)
        manifestDetails.push({ directory: directory === '.' ? '' : directory, targets })
      }
    }
  }
  manifests.sort((left, right) => compareText(left.path, right.path))

  const languages = {}
  for (const file of walked.files) {
    if (file.language === null) continue
    const bucket = languages[file.language] ?? { files: 0, bytes: 0 }
    bucket.files += 1
    bucket.bytes += file.size
    languages[file.language] = bucket
  }
  const sortedLanguages = {}
  for (const key of Object.keys(languages).sort(compareText)) sortedLanguages[key] = languages[key]

  const packages = buildPackages(manifests)
  for (const entry of packages) entry.testCommands = packageTestCommands(entry)

  const externalDeps = []
  for (const entry of packages) externalDeps.push(...entry.dependencies, ...entry.devDependencies)
  for (const manifest of manifests) {
    if (manifest.kind === 'requirements') externalDeps.push(...(manifest.packages ?? []))
    if (manifest.kind === 'go') externalDeps.push(...(manifest.dependencies ?? []))
  }

  const entryPoints = collectEntryPoints(packages, walked.files, manifestDetails)
  if (entryPoints.length >= SCAN_LIMITS.maxEntryPoints && warnings.indexOf(`入口点超过 ${SCAN_LIMITS.maxEntryPoints} 个，已截断。`) < 0) {
    warnings.push(`入口点超过 ${SCAN_LIMITS.maxEntryPoints} 个，已截断。`)
  }

  const testCommands = uniqueSorted(packages.flatMap(entry => entry.testCommands))

  const git = await readGit(absoluteRoot)

  const scan = {
    root: absoluteRoot,
    limits,
    git,
    files: walked.files.map(file => ({ path: file.path, size: file.size, language: file.language })),
    fileCount: walked.files.length,
    totalBytes: walked.files.reduce((total, file) => total + file.size, 0),
    readBytes: read.spent(),
    directories: walked.directories,
    languages: sortedLanguages,
    manifests,
    packages,
    sourceDirs: walked.sourceDirs,
    entryPoints,
    testCommands,
    externalDeps: uniqueSorted(externalDeps),
    warnings: uniqueSorted(warnings),
  }
  return scan
}

function slugify(value, fallback = 'root') {
  let slug = String(value ?? '')
    .replace(/\\/gu, '/')
    .replace(/[^A-Za-z0-9_-]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase()
  if (slug === '') slug = fallback
  if (!/^[A-Za-z]/u.test(slug)) slug = `pkg-${slug}`
  return slug
}

function uniqueId(base, used) {
  let id = base
  let index = 2
  while (used.has(id)) {
    id = `${base}-${index}`
    index += 1
  }
  used.add(id)
  return id
}

function mountForPackage(entry) {
  const rootPath = entry.relativePath === '.' ? '.' : entry.relativePath
  return {
    id: slugify(rootPath === '.' ? 'root' : rootPath),
    label: entry.name,
    root: rootPath,
    kind: 'working',
    access: 'rw',
  }
}

function sourceDirPriority(directory) {
  const base = path.posix.basename(directory)
  const index = SOURCE_DIR_PRIORITY.indexOf(base)
  return index < 0 ? SOURCE_DIR_PRIORITY.length : index
}

function chooseRootSinglePackageDirs(scan) {
  const usable = scan.sourceDirs.filter(directory => !directory.startsWith('.') && path.posix.basename(directory) !== 'docs')
  const fallback = scan.sourceDirs.filter(directory => !directory.startsWith('.') && path.posix.basename(directory) === 'docs')
  const candidates = usable.length >= 2 ? usable : [...usable, ...fallback]
  candidates.sort((left, right) => {
    const priority = sourceDirPriority(left) - sourceDirPriority(right)
    return priority !== 0 ? priority : compareText(left, right)
  })
  const selected = candidates.slice(0, 5)
  if (selected.length >= 2) return selected
  if (selected.length === 1) {
    const parent = selected[0]
    const children = scan.directories
      .filter(directory => directory.startsWith(`${parent}/`))
      .filter(directory => !directory.slice(parent.length + 1).includes('/'))
      .filter(directory => !['docs', 'tests', 'test'].includes(path.posix.basename(directory)))
      .sort(compareText)
      .slice(0, 4)
    if (children.length > 0) return children
  }
  return selected
}

function moduleSummary(entry, files) {
  const count = files.length
  return `${entry.kind} package at ${entry.relativePath}; ${count} scanned file${count === 1 ? '' : 's'}`
}

function filesUnder(scan, directory) {
  const prefix = directory === '.' ? '' : `${directory}/`
  return scan.files
    .filter(file => (prefix === '' ? true : file.path.startsWith(prefix)))
    .map(file => file.path)
    .slice(0, 20)
}

export function suggestBlueprint(scan) {
  if (scan === null || typeof scan !== 'object') throw new TypeError('suggestBlueprint 需要 scan 结果对象。')
  const packages = Array.isArray(scan.packages) ? scan.packages : []
  const files = Array.isArray(scan.files) ? scan.files : []
  const sourceDirs = Array.isArray(scan.sourceDirs) ? scan.sourceDirs : []
  const notes = []
  const mounts = []
  const mountByPath = new Map()
  const usedMountIds = new Set()
  const mountForPackageMap = new Map()

  for (const entry of packages) {
    const mount = mountForPackage(entry)
    mount.id = uniqueId(mount.id, usedMountIds)
    mounts.push(mount)
    mountByPath.set(entry.relativePath, mount)
    mountForPackageMap.set(entry, mount)
  }
  if (mounts.length === 0) {
    const mount = { id: 'root', label: path.posix.basename(scan.root ?? '') || 'root', root: '.', kind: 'working', access: 'rw' }
    mounts.push(mount)
    notes.push('未发现包清单，已为仓库根目录创建单一 working/rw 挂载。')
  }

  const modules = []
  const usedModuleIds = new Set()
  const moduleIdByPackage = new Map()
  const rootSinglePackage = packages.length === 1 && packages[0].relativePath === '.'

  const pushModule = (module, mount) => {
    module.layerId = 'A'
    module.parentId = null
    module.mountIds = [mount.id]
    if (!Array.isArray(module.acceptance)) module.acceptance = ['tests / reviewer / human 三层验证通过']
    module.status = 'pending'
    module.verification = {
      tests: { status: 'pending', evidence: [] },
      reviewer: { status: 'pending', evidence: [] },
      human: { status: 'pending', evidence: [] },
    }
    modules.push(module)
  }

  if (packages.length === 0) {
    const mount = mounts[0]
    pushModule({
      id: uniqueId('root', usedModuleIds),
      name: path.posix.basename(scan.root ?? '') || 'root',
      code: 'A1',
      summary: 'Repository root module (no package manifest detected).',
      files: files.slice(0, 20).map(file => file.path),
    }, mount)
  } else if (rootSinglePackage) {
    const entry = packages[0]
    const mount = mountForPackageMap.get(entry)
    const dirs = chooseRootSinglePackageDirs(scan)
    if (dirs.length === 0) {
      pushModule({
        id: uniqueId(slugify(entry.name), usedModuleIds),
        name: entry.name,
        code: 'A1',
        summary: moduleSummary(entry, files),
        files: filesUnder(scan, '.'),
      }, mount)
      notes.push('单包仓库没有可识别的源码目录，已生成单一模块。')
    } else {
      for (const directory of dirs) {
        const base = path.posix.basename(directory)
        pushModule({
          id: uniqueId(slugify(directory), usedModuleIds),
          name: base,
          code: `A${modules.length + 1}`,
          summary: `Source directory ${directory} of ${entry.name}.`,
          files: filesUnder(scan, directory),
        }, mount)
      }
      notes.push(`单包仓库按源码目录生成了 ${modules.length} 个模块（上限 5）。`)
    }
  } else {
    for (const entry of packages) {
      const mount = mountForPackageMap.get(entry)
      const moduleFiles = filesUnder(scan, entry.relativePath)
      const module = {
        id: uniqueId(slugify(entry.relativePath === '.' ? 'root' : entry.relativePath), usedModuleIds),
        name: entry.name,
        code: `A${modules.length + 1}`,
        summary: `${entry.kind} package at ${entry.relativePath}; ${moduleFiles.length} sampled file${moduleFiles.length === 1 ? '' : 's'}`,
        files: moduleFiles,
      }
      pushModule(module, mount)
      moduleIdByPackage.set(entry, module)
    }
    notes.push(`检测到 ${packages.length} 个包，已按包生成模块与挂载。`)
  }

  // Internal package dependencies become module dependencies and diagram edges.
  const moduleNameToModule = new Map()
  for (const [entry, module] of moduleIdByPackage) moduleNameToModule.set(entry.name, module)
  for (const [entry, module] of moduleIdByPackage) {
    const dependencies = []
    for (const dependency of entry.dependencies) {
      const target = moduleNameToModule.get(dependency)
      if (target !== undefined && target.id !== module.id) dependencies.push(target.id)
    }
    if (dependencies.length > 0) module.dependsOn = uniqueSorted(dependencies)
  }
  if (moduleIdByPackage.size > 0) {
    const connected = [...moduleIdByPackage.values()].filter(module => (module.dependsOn ?? []).length > 0)
    if (connected.length === 0) notes.push('未发现包之间的内部依赖，模块图暂无依赖边。')
  }

  if (modules.length > SUGGEST_LIMITS.maxModules) {
    notes.push(`模块数 ${modules.length} 超过建议上限 ${SUGGEST_LIMITS.maxModules}，分派前建议合并。`)
  }

  // Module diagram: one node per module, depends edges for workspace dependencies.
  const moduleNodes = modules.map(module => ({
    id: module.id,
    type: 'module',
    label: module.name,
    description: module.summary,
  }))
  const moduleEdges = []
  for (const module of modules) {
    for (const dependency of module.dependsOn ?? []) {
      moduleEdges.push({ from: module.id, to: dependency, label: 'depends', kind: 'depends' })
    }
  }
  moduleEdges.sort((left, right) => compareText(`${left.from}|${left.to}`, `${right.from}|${right.to}`))

  const diagrams = [{
    key: 'module',
    layerId: 'A',
    type: 'module',
    title: 'Package / directory modules',
    nodes: moduleNodes,
    edges: moduleEdges,
  }]

  // C4 diagram: a container per package plus external dependency nodes.
  const c4Nodes = []
  const c4Edges = []
  const containerByPackage = new Map()
  const technologies = { npm: 'Node.js', python: 'Python', rust: 'Rust', go: 'Go' }
  for (const entry of packages) {
    const mount = mountForPackageMap.get(entry)
    const id = `${mount.id}-container`
    containerByPackage.set(entry, id)
    c4Nodes.push({
      id,
      type: 'container',
      label: entry.name,
      technology: technologies[entry.kind] ?? entry.kind,
      description: `${entry.kind} package at ${entry.relativePath}`,
    })
  }
  if (packages.length === 0) {
    c4Nodes.push({
      id: 'root-container',
      type: 'container',
      label: path.posix.basename(scan.root ?? '') || 'root',
      technology: 'unknown',
      description: 'Repository root',
    })
  }
  const external = Array.isArray(scan.externalDeps) ? scan.externalDeps : []
  const workspaceNames = new Set(packages.map(entry => entry.name))
  const externalOnly = external.filter(name => !workspaceNames.has(name))
  const shownExternal = externalOnly.slice(0, SUGGEST_LIMITS.maxExternalNodes)
  if (externalOnly.length > shownExternal.length) {
    notes.push(`外部依赖共 ${externalOnly.length} 个，C4 图仅展示前 ${shownExternal.length} 个。`)
  }
  const externalIds = new Map()
  for (const name of shownExternal) {
    const id = `ext-${slugify(name, 'dep')}`
    externalIds.set(name, id)
    c4Nodes.push({ id, type: 'external', label: name, technology: 'dependency', description: 'External dependency' })
  }
  for (const entry of packages) {
    const layerId = containerByPackage.get(entry)
    for (const dependency of entry.deps) {
      const externalId = externalIds.get(dependency)
      if (externalId === undefined) continue
      c4Edges.push({ from: layerId, to: externalId, label: 'uses', kind: 'depends' })
    }
  }
  c4Edges.sort((left, right) => compareText(`${left.from}|${left.to}`, `${right.from}|${right.to}`))
  diagrams.push({
    key: 'c4',
    layerId: 'A',
    type: 'c4',
    title: 'Packages and external dependencies',
    nodes: c4Nodes,
    edges: c4Edges,
  })

  notes.push(`扫描根目录：${scan.root ?? ''}；文件 ${files.length} 个；检测到 ${packages.length} 个包。`)
  notes.push('建议只读生成，未写入蓝图；请由 Agent 使用 blueprint(action="update") 应用，scan apply 尚未实现。')

  return { mounts, modules, diagrams, notes }
}
