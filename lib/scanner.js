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
  maxImportFiles: 2000,
  maxImportBytes: 5 * 1024 * 1024,
})

export const SUGGEST_LIMITS = Object.freeze({
  maxModules: 50,
  maxExternalNodes: 30,
  maxChildLayers: 4,
  maxLayerModules: 8,
})

export const TREE_LIMITS = Object.freeze({
  maxDepth: 8,
  maxChildren: 80,
})

const LARGE_FILE_BYTES = 300 * 1024
const MAX_UNRESOLVED_IMPORTS = 100
const MAX_HOTSPOTS = 10
const HIGH_FANOUT_THRESHOLD = 25
const MAX_ALIAS_CONFIGS = 20
const MAX_ALIAS_CONFIG_BYTES = 64 * 1024
const MAX_EXTENDS_DEPTH = 8
const MAX_REFERENCE_CONFIGS = 20

const ALIAS_CONFIG_NAMES = new Set(['tsconfig.json', 'jsconfig.json'])
const IMPORT_LANGUAGES = new Set(['js', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs'])
const JS_TARGET_EXTENSIONS = Object.freeze(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'])

// Top-level CPython modules. A repository-local file is not allowed to shadow
// these for `import os` style absolute imports; they stay external.
const PYTHON_STDLIB = new Set([
  '__future__', 'abc', 'argparse', 'array', 'ast', 'asyncio', 'atexit', 'base64',
  'bisect', 'builtins', 'bz2', 'calendar', 'cmath', 'cmd', 'codecs', 'collections',
  'concurrent', 'configparser', 'contextlib', 'copy', 'csv', 'ctypes', 'dataclasses',
  'datetime', 'decimal', 'difflib', 'dis', 'email', 'enum', 'errno', 'fcntl', 'filecmp',
  'fileinput', 'fnmatch', 'fractions', 'ftplib', 'functools', 'gc', 'getopt', 'getpass',
  'gettext', 'glob', 'grp', 'gzip', 'hashlib', 'heapq', 'hmac', 'html', 'http',
  'imaplib', 'importlib', 'inspect', 'io', 'ipaddress', 'itertools', 'json', 'keyword',
  'linecache', 'locale', 'logging', 'lzma', 'mailbox', 'math', 'mimetypes', 'mmap',
  'multiprocessing', 'netrc', 'operator', 'optparse', 'os', 'pathlib', 'pickle',
  'pipes', 'pkgutil', 'platform', 'plistlib', 'poplib', 'pprint', 'profile', 'pstats',
  'pty', 'pwd', 'py_compile', 'queue', 'quopri', 'random', 're', 'readline', 'reprlib',
  'sched', 'secrets', 'select', 'selectors', 'shelve', 'shlex', 'shutil', 'signal',
  'site', 'smtplib', 'socket', 'socketserver', 'sqlite3', 'ssl', 'stat', 'statistics',
  'string', 'stringprep', 'struct', 'subprocess', 'sys', 'sysconfig', 'tarfile',
  'tempfile', 'textwrap', 'threading', 'time', 'timeit', 'tkinter', 'token', 'tokenize',
  'trace', 'traceback', 'tracemalloc', 'types', 'typing', 'unicodedata', 'unittest',
  'urllib', 'uuid', 'venv', 'warnings', 'wave', 'weakref', 'webbrowser', 'xml',
  'xmlrpc', 'zipapp', 'zipfile', 'zipimport', 'zlib', 'zoneinfo',
])
const TEST_DIRECTORY_NAMES = new Set(['test', 'tests', 'spec', 'specs', '__tests__'])
const DOC_DIRECTORY_NAMES = new Set(['docs', 'doc'])
const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.rst', '.adoc'])
const LAYER_SKIP_DIRECTORIES = new Set([
  'node_modules', 'dist', 'build', '.next', 'coverage', '.git',
  'tests', 'test', 'spec', 'specs', '__tests__', 'docs', 'doc',
])
const VENDOR_DIRECTORY_NAMES = new Set([
  'vendor', 'vendors', 'third_party', 'third-party', 'external', 'bower_components', 'jspm_packages',
])
const SEVERITY_RANK = Object.freeze({ error: 0, warn: 1, info: 2 })

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
    maxImportFiles: number(input.maxImportFiles, SCAN_LIMITS.maxImportFiles),
    maxImportBytes: number(input.maxImportBytes, SCAN_LIMITS.maxImportBytes),
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
  const fileRecords = walked.files.map(file => ({ path: file.path, size: file.size, language: file.language }))

  const scan = {
    root: absoluteRoot,
    limits,
    git,
    files: fileRecords,
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
    warnings: [],
  }
  scan.imports = await buildImportGraph(scan, limits, warnings)
  scan.metrics = buildMetrics(scan)
  scan.tree = buildFileTree(scan)
  scan.warnings = uniqueSorted(warnings)
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

function filesUnder(scan, directory) {
  const prefix = directory === '.' ? '' : `${directory}/`
  return scan.files
    .filter(file => (prefix === '' ? true : file.path.startsWith(prefix)))
    .map(file => file.path)
    .slice(0, 20)
}

// ---------------------------------------------------------------------------
// Repository graph (v0.15): file classification, tree, metrics and imports.

function normalizeRepoDirectory(filePath) {
  const dir = path.posix.dirname(String(filePath ?? ''))
  return dir === '.' ? '' : dir
}

function isTestFile(filePath) {
  const segments = String(filePath ?? '').split('/')
  const base = segments.pop() ?? ''
  if (segments.some(segment => TEST_DIRECTORY_NAMES.has(segment.toLowerCase()))) return true
  if (/(?:\.(?:test|spec)\.[^./]+|_test\.[^./]+)$/iu.test(base)) return true
  if (/^test_.*\.py$/iu.test(base)) return true
  return false
}

function isDocFile(filePath) {
  const segments = String(filePath ?? '').split('/')
  const base = segments.pop() ?? ''
  if (/^readme(?:\.[^./]+)?$/iu.test(base)) return true
  if (segments.some(segment => DOC_DIRECTORY_NAMES.has(segment.toLowerCase()))) return true
  return DOC_EXTENSIONS.has(extensionOf(base))
}

function classifyFile(file) {
  if (isTestFile(file?.path)) return 'test'
  if (isDocFile(file?.path)) return 'docs'
  if (file?.language !== null && file?.language !== undefined) return 'source'
  return 'other'
}

function percentOf(bytes, total) {
  if (!total) return 0
  return Math.round((bytes / total) * 1000) / 10
}

function languageDistribution(files) {
  const buckets = new Map()
  let total = 0
  for (const file of files) {
    if (file.language === null || file.language === undefined) continue
    const bucket = buckets.get(file.language) ?? { files: 0, bytes: 0 }
    bucket.files += 1
    bucket.bytes += file.size
    total += file.size
    buckets.set(file.language, bucket)
  }
  return [...buckets.entries()]
    .sort((left, right) => (
      right[1].bytes - left[1].bytes
      || right[1].files - left[1].files
      || compareText(left[0], right[0])
    ))
    .map(([name, bucket]) => ({
      name,
      files: bucket.files,
      bytes: bucket.bytes,
      percent: percentOf(bucket.bytes, total),
    }))
}

function packageDirectory(entry) {
  const relative = String(entry?.relativePath ?? '.')
  return relative === '.' ? '' : relative.replace(/^\.\//u, '')
}

function fileUnderDirectory(filePath, directory) {
  if (directory === '') return true
  return filePath === directory || filePath.startsWith(`${directory}/`)
}

function packageForPath(filePath, packages) {
  let root
  let best
  let bestLength = -1
  for (const entry of packages) {
    const directory = packageDirectory(entry)
    if (directory === '') {
      root = entry
      continue
    }
    if (!fileUnderDirectory(filePath, directory)) continue
    if (directory.length > bestLength) {
      best = entry
      bestLength = directory.length
    }
  }
  return best ?? root
}

function packageHealth(stats) {
  let score = 100
  const reasons = []
  if (stats.source === 0) {
    score -= 30
    reasons.push('没有源码文件')
  }
  if (stats.test === 0) {
    score -= 20
    reasons.push('没有测试文件')
  } else if (stats.testCommands.length === 0) {
    score -= 10
    reasons.push('没有测试命令')
  }
  if (stats.docs === 0) {
    score -= 10
    reasons.push('没有文档')
  }
  if (stats.entryPoints.length === 0 && stats.source > 0) {
    score -= 5
    reasons.push('没有入口点')
  }
  if (stats.dependencies.length > HIGH_FANOUT_THRESHOLD) {
    score -= 15
    reasons.push(`外部依赖过多（${stats.dependencies.length}）`)
  }
  if (stats.largeFiles > 0) {
    score -= Math.min(15, stats.largeFiles * 5)
    reasons.push(`存在大文件（${stats.largeFiles}）`)
  }
  score = Math.max(0, Math.min(100, score))
  return {
    score,
    level: score >= 80 ? 'good' : score >= 50 ? 'watch' : 'risk',
    reasons: reasons.sort(compareText),
  }
}

function pushInsight(insights, code, severity, message, subject, fix) {
  insights.push({ code, severity, message, subject, fix })
}

function buildMetrics(scan) {
  const files = Array.isArray(scan?.files) ? scan.files : []
  const entries = Array.isArray(scan?.packages) ? scan.packages : []
  const manifests = Array.isArray(scan?.manifests) ? scan.manifests : []
  const entryPoints = Array.isArray(scan?.entryPoints) ? scan.entryPoints : []

  const totals = {
    totalFiles: 0,
    totalBytes: 0,
    sourceFiles: 0,
    sourceBytes: 0,
    testFiles: 0,
    testBytes: 0,
    docsFiles: 0,
    docsBytes: 0,
  }
  const statByEntry = new Map()
  for (const entry of entries) {
    statByEntry.set(entry, {
      files: [],
      filesCount: 0,
      bytes: 0,
      source: 0,
      sourceBytes: 0,
      test: 0,
      testBytes: 0,
      docs: 0,
      docsBytes: 0,
      largeFiles: 0,
    })
  }

  for (const file of files) {
    totals.totalFiles += 1
    totals.totalBytes += file.size
    const kind = classifyFile(file)
    if (kind === 'source') {
      totals.sourceFiles += 1
      totals.sourceBytes += file.size
    } else if (kind === 'test') {
      totals.testFiles += 1
      totals.testBytes += file.size
    } else if (kind === 'docs') {
      totals.docsFiles += 1
      totals.docsBytes += file.size
    }
    const owner = packageForPath(file.path, entries)
    const stats = owner === undefined ? undefined : statByEntry.get(owner)
    if (stats === undefined) continue
    stats.files.push(file)
    stats.filesCount += 1
    stats.bytes += file.size
    if (kind === 'source') {
      stats.source += 1
      stats.sourceBytes += file.size
    } else if (kind === 'test') {
      stats.test += 1
      stats.testBytes += file.size
    } else if (kind === 'docs') {
      stats.docs += 1
      stats.docsBytes += file.size
    }
    if (file.size > LARGE_FILE_BYTES) stats.largeFiles += 1
  }

  const packages = entries.map(entry => {
    const directory = packageDirectory(entry)
    const stats = statByEntry.get(entry)
    const packageEntryPoints = entryPoints.filter(point => fileUnderDirectory(point, directory))
    const testCommands = uniqueSorted(Array.isArray(entry.testCommands) ? entry.testCommands : [])
    const dependencies = uniqueSorted(
      Array.isArray(entry.deps)
        ? entry.deps
        : [...(entry.dependencies ?? []), ...(entry.devDependencies ?? [])],
    )
    const health = packageHealth({
      source: stats.source,
      test: stats.test,
      docs: stats.docs,
      testCommands,
      entryPoints: packageEntryPoints,
      dependencies,
      largeFiles: stats.largeFiles,
    })
    return {
      name: entry.name ?? (directory === '' ? 'root' : path.posix.basename(directory)),
      path: directory === '' ? '.' : directory,
      files: stats.filesCount,
      bytes: stats.bytes,
      source: stats.source,
      sourceBytes: stats.sourceBytes,
      test: stats.test,
      testBytes: stats.testBytes,
      docs: stats.docs,
      docsBytes: stats.docsBytes,
      languages: languageDistribution(stats.files),
      entryPoints: packageEntryPoints,
      testCommands,
      dependencies,
      health,
    }
  })

  const hotspotBuckets = new Map()
  for (const file of files) {
    if (isTestFile(file.path)) continue
    const directory = normalizeRepoDirectory(file.path)
    const segments = directory === '' ? [] : directory.split('/')
    if (segments.some(segment => SKIP_DIR_NAMES.includes(segment))) continue
    const key = directory === '' ? '.' : directory
    const bucket = hotspotBuckets.get(key) ?? { path: key, files: 0, bytes: 0, languages: new Set() }
    bucket.files += 1
    bucket.bytes += file.size
    if (file.language !== null && file.language !== undefined) bucket.languages.add(file.language)
    hotspotBuckets.set(key, bucket)
  }
  const hotspots = [...hotspotBuckets.values()]
    .sort((left, right) => (
      right.bytes - left.bytes
      || right.files - left.files
      || compareText(left.path, right.path)
    ))
    .slice(0, MAX_HOTSPOTS)
    .map(item => ({
      path: item.path,
      files: item.files,
      bytes: item.bytes,
      languages: [...item.languages].sort(compareText),
    }))

  const insights = []
  for (const entry of entries) {
    const stats = statByEntry.get(entry)
    const directory = packageDirectory(entry)
    const subject = directory === '' ? (entry.name ?? 'root') : directory
    const entryPointCount = entryPoints.filter(point => fileUnderDirectory(point, directory)).length
    const testCommands = Array.isArray(entry.testCommands) ? entry.testCommands : []
    const dependencies = Array.isArray(entry.deps)
      ? entry.deps
      : [...(entry.dependencies ?? []), ...(entry.devDependencies ?? [])]
    if (stats.source > 0 && stats.test === 0) {
      pushInsight(insights, 'no-tests', 'warn', `包 ${subject} 有源码但没有测试文件。`, subject, '补充测试文件并纳入测试命令。')
    }
    if (stats.test > 0 && testCommands.length === 0) {
      pushInsight(insights, 'no-test-command', 'warn', `包 ${subject} 有测试文件但没有测试命令。`, subject, '在 manifest 中声明 test 脚本或 pytest/cargo/go test。')
    }
    if (stats.source > 0 && stats.docs === 0) {
      pushInsight(insights, 'no-docs', 'info', `包 ${subject} 缺少 README 或 docs 文档。`, subject, '补充 README 或 docs/ 目录。')
    }
    if (stats.source > 0 && entryPointCount === 0) {
      pushInsight(insights, 'no-entry', 'warn', `包 ${subject} 有源码但没有识别到入口点。`, subject, '声明 main/bin/scripts 或提供 index/main 入口文件。')
    }
    if (dependencies.length > HIGH_FANOUT_THRESHOLD) {
      pushInsight(insights, 'high-fanout', 'warn', `包 ${subject} 有 ${dependencies.length} 个外部依赖，扇出偏高。`, subject, '评估依赖是否必要，必要时拆分或隔离。')
    }
  }

  const largeFiles = files
    .filter(file => file.size > LARGE_FILE_BYTES)
    .sort((left, right) => right.size - left.size || compareText(left.path, right.path))
  for (const file of largeFiles.slice(0, MAX_HOTSPOTS)) {
    pushInsight(
      insights,
      'large-files',
      'warn',
      `大文件 ${file.path}（${Math.round(file.size / 1024)} KB）超过 300 KB。`,
      file.path,
      '拆分文件或改为按需加载/生成。',
    )
  }

  const vendorBuckets = new Map()
  for (const file of files) {
    const segments = file.path.split('/')
    const index = segments.findIndex(segment => VENDOR_DIRECTORY_NAMES.has(segment.toLowerCase()))
    if (index < 0) continue
    const key = segments.slice(0, index + 1).join('/')
    const bucket = vendorBuckets.get(key) ?? { path: key, files: 0, bytes: 0 }
    bucket.files += 1
    bucket.bytes += file.size
    vendorBuckets.set(key, bucket)
  }
  for (const bucket of [...vendorBuckets.values()].sort((left, right) => compareText(left.path, right.path))) {
    const bytesShare = totals.totalBytes === 0 ? 0 : bucket.bytes / totals.totalBytes
    if (bucket.files < 10 && bytesShare < 0.1) continue
    pushInsight(
      insights,
      'vendor-heavy',
      'warn',
      `目录 ${bucket.path} 含 ${bucket.files} 个 vendored 文件（${bucket.bytes} 字节）。`,
      bucket.path,
      '确认是否必须提交依赖副本，或改用包管理器缓存。',
    )
  }

  const rootManifest = manifests.find(manifest => manifest.kind === 'npm' && manifest.path === 'package.json')
  const pnpmWorkspace = manifests.some(manifest => manifest.kind === 'pnpm-workspace')
  const workspaceConfigured = (Array.isArray(rootManifest?.workspaces) && rootManifest.workspaces.length > 0) || pnpmWorkspace
  const nestedPackages = entries.filter(entry => packageDirectory(entry) !== '')
  if (workspaceConfigured && nestedPackages.length === 0) {
    pushInsight(
      insights,
      'monorepo-root-only',
      'warn',
      '仓库声明了 workspace，但没有发现子包清单。',
      '.',
      '补充子包 package.json，或移除 workspace 声明。',
    )
  }

  const unboundSource = files.filter(file => classifyFile(file) === 'source' && packageForPath(file.path, entries) === undefined)
  if (unboundSource.length > 0) {
    pushInsight(
      insights,
      'unbound-source',
      'warn',
      `有 ${unboundSource.length} 个源码文件不属于任何包清单。`,
      '.',
      '为源码目录添加 package/pyproject/go.mod/Cargo.toml，或创建根包清单。',
    )
  }

  insights.sort((left, right) => (
    (SEVERITY_RANK[left.severity] ?? 9) - (SEVERITY_RANK[right.severity] ?? 9)
    || compareText(left.code, right.code)
    || compareText(left.subject, right.subject)
    || compareText(left.message, right.message)
  ))

  return {
    totals: { ...totals, languages: languageDistribution(files) },
    packages,
    hotspots,
    insights,
  }
}

function positiveInteger(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

function repositoryAncestors(directory) {
  const ancestors = []
  let current = directory
  while (true) {
    ancestors.push(current)
    if (current === '') break
    current = normalizeRepoDirectory(current)
  }
  return ancestors
}

export function buildFileTree(scan, options = {}) {
  if (scan === null || typeof scan !== 'object') throw new TypeError('buildFileTree 需要 scan 结果对象。')
  const input = options !== null && typeof options === 'object' ? options : {}
  const maxDepth = positiveInteger(input.maxDepth, TREE_LIMITS.maxDepth)
  const maxChildren = positiveInteger(input.maxChildren, TREE_LIMITS.maxChildren)
  const includeFiles = input.includeFiles === true
  const files = Array.isArray(scan.files) ? scan.files : []
  const directories = Array.isArray(scan.directories) ? scan.directories : []
  const entryPoints = new Set(Array.isArray(scan.entryPoints) ? scan.entryPoints : [])
  const rootName = path.posix.basename(String(scan.root ?? '').replace(/\\/gu, '/')) || 'root'

  const directoryChildren = new Map()
  const fileChildren = new Map()
  const stats = new Map()
  const flags = new Map()
  const ensureStats = directory => {
    let value = stats.get(directory)
    if (value === undefined) {
      value = { files: 0, bytes: 0 }
      stats.set(directory, value)
    }
    return value
  }
  const ensureFlags = directory => {
    let value = flags.get(directory)
    if (value === undefined) {
      value = { entry: false, test: false, doc: false }
      flags.set(directory, value)
    }
    return value
  }
  ensureStats('')
  ensureFlags('')

  for (const directory of directories) {
    if (directory === '') continue
    const segments = directory.split('/')
    if (segments.some(segment => SKIP_DIR_NAMES.includes(segment))) continue
    const parent = normalizeRepoDirectory(directory)
    ensureStats(directory)
    ensureStats(parent)
    ensureFlags(directory)
    ensureFlags(parent)
    const list = directoryChildren.get(parent) ?? []
    list.push(directory)
    directoryChildren.set(parent, list)
  }

  for (const file of files) {
    const parent = normalizeRepoDirectory(file.path)
    ensureStats(parent)
    ensureFlags(parent)
    const list = fileChildren.get(parent) ?? []
    list.push(file)
    fileChildren.set(parent, list)
    const fileFlags = {
      entry: entryPoints.has(file.path),
      test: isTestFile(file.path),
      doc: isDocFile(file.path),
    }
    for (const ancestor of repositoryAncestors(parent)) {
      const bucket = ensureStats(ancestor)
      bucket.files += 1
      bucket.bytes += file.size
      if (fileFlags.entry) ensureFlags(ancestor).entry = true
      if (fileFlags.test) ensureFlags(ancestor).test = true
      if (fileFlags.doc) ensureFlags(ancestor).doc = true
    }
  }

  const build = (directory, depth) => {
    const bucket = stats.get(directory) ?? { files: 0, bytes: 0 }
    const directoryFlags = flags.get(directory) ?? { entry: false, test: false, doc: false }
    const node = {
      name: directory === '' ? rootName : path.posix.basename(directory),
      path: directory,
      type: 'dir',
      children: [],
      entry: directoryFlags.entry,
      test: directoryFlags.test,
      doc: directoryFlags.doc,
      files: bucket.files,
      bytes: bucket.bytes,
    }
    const childDirectories = (directoryChildren.get(directory) ?? []).slice().sort(compareText)
    if (depth >= maxDepth) {
      if (bucket.files > 0 || childDirectories.length > 0) node.truncated = true
      return node
    }
    const directoryNodes = childDirectories.map(child => build(child, depth + 1))
    const allFiles = (fileChildren.get(directory) ?? []).slice().sort((left, right) => compareText(left.path, right.path))
    let selectedFiles = allFiles
    if (!includeFiles) {
      selectedFiles = allFiles.filter(file => {
        const fileFlags = {
          entry: entryPoints.has(file.path),
          test: isTestFile(file.path),
          doc: isDocFile(file.path),
        }
        return fileFlags.entry
          || fileFlags.test
          || fileFlags.doc
          || manifestKindOf(path.posix.basename(file.path)) !== undefined
      })
      if (selectedFiles.length === 0 && allFiles.length > 0) selectedFiles = [allFiles[0]]
    }
    const fileNodes = selectedFiles.map(file => ({
      name: path.posix.basename(file.path),
      path: file.path,
      type: 'file',
      children: [],
      entry: entryPoints.has(file.path),
      test: isTestFile(file.path),
      doc: isDocFile(file.path),
      files: 1,
      bytes: file.size,
    }))
    const children = [...directoryNodes, ...fileNodes]
    node.children = children.slice(0, maxChildren)
    if (children.length > node.children.length) node.truncated = true
    return node
  }

  return build('', 0)
}

function parseJsSpecifiers(text) {
  const found = []
  const push = (specifier, kind) => {
    const value = String(specifier ?? '').trim()
    if (value !== '') found.push({ specifier: value, kind })
  }
  const staticImport = /(?:^|[\n;])\s*import\s+(?:[^'";]*?from\s+)?['"]([^'"]+)['"]/gu
  const exportFrom = /(?:^|[\n;])\s*export\s+(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/gu
  const requireCall = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gu
  const dynamicImport = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/gu
  for (const [pattern, kind] of [
    [staticImport, 'import'],
    [exportFrom, 'export'],
    [requireCall, 'require'],
    [dynamicImport, 'dynamic'],
  ]) {
    let match
    pattern.lastIndex = 0
    while ((match = pattern.exec(String(text ?? ''))) !== null) push(match[1], kind)
  }
  const seen = new Set()
  return found.filter(item => {
    const key = `${item.kind}|${item.specifier}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function parsePythonSpecifiers(text) {
  const found = []
  const seen = new Set()
  const push = specifier => {
    const value = String(specifier ?? '').trim()
    if (value === '') return
    if (seen.has(value)) return
    seen.add(value)
    found.push({ specifier: value, kind: 'import' })
  }
  const fromPattern = /^[ \t]*from[ \t]+([.\w]+)[ \t]+import[ \t]+[^\n#]+/gmu
  let match
  while ((match = fromPattern.exec(String(text ?? ''))) !== null) push(match[1])
  const importPattern = /^[ \t]*import[ \t]+([.\w]+(?:[ \t]*,[ \t]*[.\w]+)*)/gmu
  while ((match = importPattern.exec(String(text ?? ''))) !== null) {
    for (const item of match[1].split(',')) push(item.trim().split(/\s+/u)[0])
  }
  return found
}

function parseGoSpecifiers(text) {
  const found = []
  const seen = new Set()
  const push = specifier => {
    const value = String(specifier ?? '').trim()
    if (value === '' || seen.has(value)) return
    seen.add(value)
    found.push({ specifier: value, kind: 'import' })
  }
  const blockPattern = /(?:^|\n)[ \t]*import[ \t]*\(([\s\S]*?)\)/gu
  let match
  while ((match = blockPattern.exec(String(text ?? ''))) !== null) {
    const quoted = /"([^"]+)"/gu
    let quotedMatch
    while ((quotedMatch = quoted.exec(match[1])) !== null) push(quotedMatch[1])
  }
  const singlePattern = /(?:^|\n)[ \t]*import[ \t]+(?:[._A-Za-z][\w.]*[ \t]+)?["']([^"']+)["']/gu
  while ((match = singlePattern.exec(String(text ?? ''))) !== null) push(match[1])
  return found
}

function splitRustUseItems(value) {
  const items = []
  let depth = 0
  let current = ''
  for (const char of String(value ?? '')) {
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (char === ',' && depth === 0) {
      items.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim() !== '') items.push(current.trim())
  return items
}

function expandRustUseClause(clause) {
  const value = String(clause ?? '').replace(/\/\/.*$/u, '').trim()
  const brace = value.indexOf('{')
  if (brace >= 0 && value.endsWith('}')) {
    const prefix = value.slice(0, brace).replace(/::$/u, '').trim()
    const inner = value.slice(brace + 1, -1)
    const expanded = []
    for (const item of splitRustUseItems(inner)) {
      const cleaned = item.replace(/^self::/u, '').trim()
      if (cleaned === '') continue
      expanded.push(prefix === '' ? cleaned : `${prefix}::${cleaned}`)
    }
    return expanded
  }
  return [value]
}

function parseRustSpecifiers(text) {
  const found = []
  const seen = new Set()
  const push = (specifier, kind) => {
    const value = String(specifier ?? '').trim()
    if (value === '' || seen.has(`${kind}|${value}`)) return
    seen.add(`${kind}|${value}`)
    found.push({ specifier: value, kind })
  }
  const modPattern = /^[ \t]*(?:pub(?:\([^)]*\))?[ \t]+)?mod[ \t]+([A-Za-z_]\w*)[ \t]*;/gmu
  let match
  while ((match = modPattern.exec(String(text ?? ''))) !== null) push(match[1], 'mod')
  const usePattern = /^[ \t]*(?:pub[ \t]+)?use[ \t]+([^;]+);/gmu
  while ((match = usePattern.exec(String(text ?? ''))) !== null) {
    for (const clause of splitRustUseItems(match[1])) {
      for (const expanded of expandRustUseClause(clause)) push(expanded, 'use')
    }
  }
  return found
}

// Remove JSONC comments and trailing commas without touching string contents.
// Deliberately small: tsconfig/jsconfig files are configuration, not user data.
function stripJsonc(text) {
  const input = String(text ?? '').replace(/^\uFEFF/u, '')
  let withoutComments = ''
  let quote = ''
  let escaped = false
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (quote !== '') {
      withoutComments += char
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"') {
      quote = char
      withoutComments += char
      continue
    }
    if (char === '/' && input[index + 1] === '/') {
      while (index < input.length && input[index] !== '\n') index += 1
      withoutComments += '\n'
      continue
    }
    if (char === '/' && input[index + 1] === '*') {
      index += 2
      while (index < input.length && !(input[index] === '*' && input[index + 1] === '/')) index += 1
      index += 1
      withoutComments += ' '
      continue
    }
    withoutComments += char
  }
  let result = ''
  quote = ''
  escaped = false
  for (let index = 0; index < withoutComments.length; index += 1) {
    const char = withoutComments[index]
    if (quote !== '') {
      result += char
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"') {
      quote = char
      result += char
      continue
    }
    if (char === ',') {
      let next = index + 1
      while (next < withoutComments.length && /\s/u.test(withoutComments[next])) next += 1
      if (withoutComments[next] === '}' || withoutComments[next] === ']') continue
    }
    result += char
  }
  return result
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeAliasPath(value) {
  return String(value ?? '').trim().replace(/\\/gu, '/')
}

function parseAliasPatterns(compilerOptions) {
  const patterns = []
  if (!isRecord(compilerOptions)) return patterns
  const rawPaths = compilerOptions.paths
  if (!isRecord(rawPaths)) return patterns
  for (const pattern of Object.keys(rawPaths).sort(compareText)) {
    if (pattern === '' || !Array.isArray(rawPaths[pattern])) continue
    const targets = rawPaths[pattern]
      .filter(target => typeof target === 'string' && target.trim() !== '')
      .map(target => normalizeAliasPath(target))
    if (targets.length > 0) patterns.push({ pattern, targets })
  }
  return patterns
}

function parseReferencePaths(value) {
  if (!Array.isArray(value)) return []
  const paths = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const refPath = normalizeAliasPath(item.path)
    if (refPath !== '') paths.push(refPath)
  }
  return paths
}

// Read-only tsconfig/jsconfig loader with recursive `extends` support.
// It never executes project code: configs are parsed as JSONC and node_modules
// lookups are plain file reads. Caches make repeated extends/reference reads cheap.
function createAliasConfigLoader(scan, warnings) {
  const parsedCache = new Map()
  const configCache = new Map()
  const warned = new Set()

  const warnOnce = (key, message) => {
    if (warned.has(key)) return
    warned.add(key)
    warnings.push(message)
  }
  const toRelative = absolute => {
    const relative = path.relative(scan.root, absolute)
    if (relative === '') return ''
    if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`)) return undefined
    return relative.split(path.sep).join('/')
  }
  const toAbsolute = relative => path.join(scan.root, ...relative.split('/'))
  const exists = async relative => {
    try {
      await fs.access(toAbsolute(relative))
      return true
    } catch {
      return false
    }
  }

  async function readParsed(relative) {
    if (parsedCache.has(relative)) return parsedCache.get(relative)
    let parsed
    let text
    try {
      text = await fs.readFile(toAbsolute(relative), 'utf8')
    } catch (error) {
      warnOnce(`read:${relative}`, `读取别名配置失败：${relative}（${errorMessage(error)}）`)
      parsedCache.set(relative, undefined)
      return undefined
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_ALIAS_CONFIG_BYTES) {
      warnOnce(`size:${relative}`, `别名配置超过 ${MAX_ALIAS_CONFIG_BYTES} 字节，未读取：${relative}`)
      parsed = undefined
    } else {
      try {
        const value = JSON.parse(stripJsonc(text))
        parsed = isRecord(value) ? value : undefined
      } catch (error) {
        warnOnce(`parse:${relative}`, `解析别名配置失败：${relative}（${errorMessage(error)}）`)
        parsed = undefined
      }
    }
    parsedCache.set(relative, parsed)
    return parsed
  }

  async function configCandidate(candidatePath) {
    let relative = candidatePath
    if (relative === undefined || relative === '' || relative.startsWith('..')) return undefined
    if (!/\.json$/iu.test(relative)) relative = `${relative}.json`
    const absolute = path.isAbsolute(relative) ? relative : toAbsolute(relative)
    const normalized = toRelative(path.normalize(absolute))
    if (normalized === undefined) return undefined
    if (!(await exists(normalized))) return undefined
    return normalized
  }

  async function resolveExtendsTarget(specifier, fromConfig) {
    const value = normalizeAliasPath(specifier)
    if (value === '') return undefined
    const fromDirectory = normalizeRepoDirectory(fromConfig)
    if (value.startsWith('.') || value.startsWith('/')) {
      const relative = value.startsWith('/')
        ? value.replace(/^\/+/u, '')
        : path.posix.join(fromDirectory === '' ? '.' : fromDirectory, value)
      return configCandidate(relative)
    }
    const segments = value.split('/')
    const packageName = value.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]
    const subpath = segments.slice(value.startsWith('@') ? 2 : 1).join('/')
    let directory = fromDirectory
    for (;;) {
      const modulesDirectory = path.posix.join(directory === '' ? '.' : directory, 'node_modules')
      if (subpath !== '') {
        const found = await configCandidate(path.posix.join(modulesDirectory, packageName, subpath))
        if (found !== undefined) return found
      } else {
        const packageDirectory = path.posix.join(modulesDirectory, packageName)
        const manifestPath = path.posix.join(packageDirectory, 'package.json')
        if (await exists(manifestPath)) {
          const manifest = await readParsed(manifestPath)
          const manifestTsconfig = isRecord(manifest) ? normalizeAliasPath(manifest.tsconfig) : ''
          if (manifestTsconfig !== '') {
            const found = await configCandidate(path.posix.join(packageDirectory, manifestTsconfig))
            if (found !== undefined) return found
          }
        }
        const found = await configCandidate(path.posix.join(packageDirectory, 'tsconfig.json'))
        if (found !== undefined) return found
      }
      if (directory === '') break
      directory = normalizeRepoDirectory(directory)
    }
    return undefined
  }

  async function load(relative, stack = []) {
    const cached = configCache.get(relative)
    if (cached !== undefined) return cached
    if (stack.includes(relative)) {
      warnOnce(`cycle:${relative}`, `别名配置 extends 出现循环，已忽略：${[...stack, relative].join(' -> ')}`)
      return undefined
    }
    if (stack.length > MAX_EXTENDS_DEPTH) {
      warnOnce(`depth:${relative}`, `别名配置 extends 超过 ${MAX_EXTENDS_DEPTH} 层，已忽略：${relative}`)
      return undefined
    }
    const parsed = await readParsed(relative)
    if (parsed === undefined) return undefined
    const compilerOptions = isRecord(parsed.compilerOptions) ? parsed.compilerOptions : {}
    const directory = normalizeRepoDirectory(relative)
    const hasOwnBaseUrl = typeof compilerOptions.baseUrl === 'string'
    const rawBaseUrl = hasOwnBaseUrl ? normalizeAliasPath(compilerOptions.baseUrl) : ''
    const hasOwnPaths = isRecord(compilerOptions.paths)
    const ownPatterns = parseAliasPatterns(compilerOptions)
    const rawExtends = parsed.extends
    const extendSpecs = Array.isArray(rawExtends)
      ? rawExtends.filter(item => typeof item === 'string')
      : typeof rawExtends === 'string' ? [rawExtends] : []

    let inheritedBaseUrl
    let inheritedBaseUrlDefined = false
    let inheritedPatterns = []
    let inheritedPathsDefined = false
    let inheritedPathsDirectory
    const extendsChain = []
    for (const spec of extendSpecs) {
      const target = await resolveExtendsTarget(spec, relative)
      if (target === undefined) {
        warnOnce(
          `extends:${relative}:${spec}`,
          `extends 配置未找到：${normalizeAliasPath(spec)}（来自 ${relative}）`,
        )
        continue
      }
      const base = await load(target, [...stack, relative])
      if (base === undefined) continue
      for (const item of [...base.extends, base.path]) {
        if (!extendsChain.includes(item)) extendsChain.push(item)
      }
      if (base.baseUrlDefined) {
        inheritedBaseUrl = base.baseUrl
        inheritedBaseUrlDefined = true
      }
      if (base.pathsDefined) {
        inheritedPatterns = base.patterns
        inheritedPathsDefined = true
        inheritedPathsDirectory = base.pathsDirectory
      }
    }

    const patterns = hasOwnPaths ? ownPatterns : inheritedPatterns
    // TypeScript 4.1+: without an explicit baseUrl, `paths` resolve relative to
    // the config file that declares them (which may be an extended parent).
    const pathsDirectory = hasOwnPaths
      ? directory
      : inheritedPathsDefined
        ? inheritedPathsDirectory ?? directory
        : directory
    let baseUrl
    let baseUrlDefined
    if (hasOwnBaseUrl) {
      baseUrlDefined = true
      if (rawBaseUrl === '' || rawBaseUrl === '.') {
        baseUrl = directory
      } else {
        baseUrl = path.posix.normalize(path.posix.join(directory === '' ? '.' : directory, rawBaseUrl))
        if (baseUrl === '.') baseUrl = ''
      }
    } else if (inheritedBaseUrlDefined) {
      baseUrl = inheritedBaseUrl
      baseUrlDefined = true
    } else {
      baseUrl = pathsDirectory
      baseUrlDefined = false
    }
    if (baseUrl.startsWith('..')) {
      warnOnce(`baseUrl:${relative}`, `别名配置 baseUrl 位于仓库外，已跳过：${relative}`)
      return undefined
    }
    const config = {
      path: relative,
      directory,
      baseUrl,
      baseUrlDefined,
      patterns,
      pathsDefined: hasOwnPaths || inheritedPathsDefined,
      pathsDirectory,
      extends: extendsChain,
      references: parseReferencePaths(parsed.references),
      fromReference: false,
    }
    configCache.set(relative, config)
    return config
  }

  async function resolveReferenceTarget(fromConfig, referencePath) {
    const fromDirectory = normalizeRepoDirectory(fromConfig)
    let relative = normalizeAliasPath(referencePath)
    if (relative === '') return undefined
    if (relative.startsWith('/')) relative = relative.replace(/^\/+/u, '')
    else relative = path.posix.join(fromDirectory === '' ? '.' : fromDirectory, relative)
    relative = path.posix.normalize(relative)
    if (!/\.json$/iu.test(relative)) {
      relative = path.posix.join(relative, 'tsconfig.json')
    }
    return configCandidate(relative)
  }

  return { load, resolveReferenceTarget, warnOnce }
}

async function readAliasConfigs(scan, files, warnings) {
  const loader = createAliasConfigLoader(scan, warnings)
  const configs = []
  const seen = new Set()
  const configFiles = files
    .filter(file => ALIAS_CONFIG_NAMES.has(path.posix.basename(file.path)))
    .filter(file => !file.path.split('/').includes('node_modules'))
    .sort((left, right) => compareText(left.path, right.path))
    .slice(0, MAX_ALIAS_CONFIGS)
  for (const file of configFiles) {
    const config = await loader.load(file.path)
    if (config === undefined || seen.has(config.path)) continue
    seen.add(config.path)
    configs.push(config)
  }

  // `references` contribute extra candidate configs (directory or tsconfig file),
  // capped and read once. They are not recursively expanded: only the config
  // files named by a directly scanned root config are loaded.
  const referenceTargets = []
  for (const config of configs) {
    for (const referencePath of config.references) {
      referenceTargets.push({ from: config.path, referencePath })
    }
  }
  const referenced = new Set()
  for (const { from, referencePath } of referenceTargets) {
    if (referenced.size >= MAX_REFERENCE_CONFIGS) {
      loader.warnOnce(
        'references:limit',
        `references 配置超过 ${MAX_REFERENCE_CONFIGS} 个，后续引用未读取。`,
      )
      break
    }
    const target = await loader.resolveReferenceTarget(from, referencePath)
    if (target === undefined) {
      loader.warnOnce(
        `reference:${from}:${referencePath}`,
        `references 配置未找到：${referencePath}（来自 ${from}）`,
      )
      continue
    }
    referenced.add(target)
    const existing = configs.find(config => config.path === target)
    if (existing !== undefined) {
      if (existing.baseUrlDefined || existing.patterns.length > 0) existing.fromReference = true
      continue
    }
    const config = await loader.load(target)
    if (config === undefined) continue
    // A referenced config without aliases would only add false positives.
    if (!config.baseUrlDefined && config.patterns.length === 0) continue
    config.fromReference = true
    seen.add(config.path)
    configs.push(config)
  }
  return configs
}

function aliasCandidatesForFile(filePath, configs) {
  const primary = aliasConfigForFile(filePath, configs)
  const candidates = primary === undefined ? [] : [primary]
  // Referenced configs act as a secondary candidate list so an import from a
  // sibling package can still resolve through a project reference. Directly
  // scanned configs keep the original nearest-config-only behavior.
  const fallbacks = configs
    .filter(config => config !== primary && config.fromReference === true)
    .filter(config => config.baseUrlDefined || config.patterns.length > 0)
    .sort((left, right) => (
      Number(right.patterns.length > 0) - Number(left.patterns.length > 0)
      || right.directory.length - left.directory.length
      || compareText(left.path, right.path)
    ))
  candidates.push(...fallbacks)
  return candidates
}

function aliasConfigForFile(filePath, configs) {
  const rank = config => (path.posix.basename(config.path) === 'tsconfig.json' ? 0 : 1)
  let best
  for (const config of configs) {
    if (config.directory !== '' && filePath !== config.directory && !filePath.startsWith(`${config.directory}/`)) continue
    if (
      best === undefined
      || config.directory.length > best.directory.length
      || (
        config.directory.length === best.directory.length
        && (
          rank(config) < rank(best)
          || (rank(config) === rank(best) && compareText(config.path, best.path) < 0)
        )
      )
    ) {
      best = config
    }
  }
  return best
}

function matchAliasPattern(specifier, patterns) {
  let best
  let bestPrefix = -1
  for (const entry of patterns) {
    const star = entry.pattern.indexOf('*')
    if (star < 0) {
      if (entry.pattern === specifier && bestPrefix < specifier.length) {
        best = { entry, capture: '' }
        bestPrefix = specifier.length
      }
      continue
    }
    const prefix = entry.pattern.slice(0, star)
    const suffix = entry.pattern.slice(star + 1)
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue
    if (specifier.length < prefix.length + suffix.length) continue
    if (prefix.length < bestPrefix) continue
    if (prefix.length === bestPrefix && best !== undefined && compareText(entry.pattern, best.entry.pattern) >= 0) continue
    best = { entry, capture: specifier.slice(prefix.length, specifier.length - suffix.length) }
    bestPrefix = prefix.length
  }
  return best
}

function aliasTargetPath(baseUrl, target, capture) {
  const value = target.replace(/\*/gu, capture)
  const joined = path.posix.normalize(path.posix.join(baseUrl === '' ? '.' : baseUrl, value))
  if (joined === '.') return ''
  return joined
}

function findJsFile(target, fileSet) {
  if (target === '' || target.startsWith('..')) return undefined
  const candidates = []
  if (path.posix.extname(target) !== '') candidates.push(target)
  for (const extension of JS_TARGET_EXTENSIONS) candidates.push(`${target}${extension}`)
  for (const extension of JS_TARGET_EXTENSIONS) candidates.push(path.posix.join(target, `index${extension}`))
  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate
  }
  return undefined
}

function resolveAliasImport(specifier, config, fileSet) {
  const match = matchAliasPattern(specifier, config.patterns)
  if (match !== undefined) {
    for (const target of match.entry.targets) {
      const found = findJsFile(aliasTargetPath(config.baseUrl, target, match.capture), fileSet)
      if (found !== undefined) return { target: found, alias: true }
    }
    return { unresolved: 'alias' }
  }
  // Without paths, baseUrl still supports absolute imports such as `src/foo`.
  const found = findJsFile(aliasTargetPath(config.baseUrl, specifier, ''), fileSet)
  if (found !== undefined) return { target: found, alias: true }
  return undefined
}

function resolveJsImport(specifier, fromFile, fileSet, aliasCandidates = []) {
  const cleaned = String(specifier ?? '').split(/[?#]/u)[0]
  let target
  if (cleaned.startsWith('/')) {
    target = cleaned.replace(/^\/+/u, '')
  } else if (cleaned.startsWith('.')) {
    target = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), cleaned))
  } else {
    let aliasFailure
    for (const aliasConfig of aliasCandidates) {
      const alias = resolveAliasImport(cleaned, aliasConfig, fileSet)
      if (alias === undefined) continue
      if (alias.unresolved === 'alias') {
        if (aliasFailure === undefined) aliasFailure = alias
        continue
      }
      return alias
    }
    if (aliasFailure !== undefined) return aliasFailure
    return { external: specifier }
  }
  if (target.startsWith('..')) return { unresolved: 'outside-root' }
  const found = findJsFile(target, fileSet)
  if (found !== undefined) return { target: found }
  return { unresolved: 'not-found' }
}

// Python import roots: the repository root, parents of regular packages
// (`__init__.py`) and every `src/` directory that participates in a src layout.
function pythonPackageRoots(files) {
  const roots = new Set([''])
  for (const file of files) {
    const filePath = String(file?.path ?? '')
    if (filePath === '') continue
    const segments = filePath.split('/')
    const base = segments[segments.length - 1]
    if (base === '__init__.py') {
      const packageDir = segments.slice(0, -1).join('/')
      const parent = normalizeRepoDirectory(packageDir)
      roots.add(parent === '.' ? '' : parent)
    }
    for (let index = 0; index < segments.length - 1; index += 1) {
      if (segments[index] !== 'src') continue
      roots.add(segments.slice(0, index + 1).join('/'))
    }
  }
  return [...roots].sort((left, right) => right.length - left.length || compareText(left, right))
}

function pythonTargetExists(root, parts, fileSet) {
  const target = parts.length === 0
    ? root
    : path.posix.normalize(path.posix.join(root === '' ? '.' : root, ...parts))
  if (target.startsWith('..')) return ''
  const candidates = parts.length === 0
    ? [path.posix.join(target, '__init__.py')]
    : [`${target}.py`, path.posix.join(target, '__init__.py')]
  return candidates.find(candidate => fileSet.has(candidate)) ?? ''
}

function resolvePythonAbsolute(specifier, roots, fileSet) {
  const value = String(specifier ?? '').split(/\s+/u)[0]
  const parts = value.split('.').filter(Boolean)
  if (parts.length === 0) return { external: value }
  const top = parts[0]
  if (PYTHON_STDLIB.has(top)) return { external: top }
  for (const root of roots) {
    const found = pythonTargetExists(root, parts, fileSet)
    if (found !== '') return { target: found }
  }
  // A locally visible top-level package with a missing submodule is a real
  // unresolved local import, not a third-party module.
  for (const root of roots) {
    if (pythonTargetExists(root, [top], fileSet) !== '') return { unresolved: 'not-found' }
  }
  return { external: top }
}

function resolvePythonImport(specifier, fromFile, fileSet, roots = []) {
  const value = String(specifier ?? '')
  if (!value.startsWith('.')) return resolvePythonAbsolute(value, roots, fileSet)
  const dotCount = /^\.+/u.exec(value)[0].length
  const rest = value.slice(dotCount)
  let base = path.posix.dirname(fromFile)
  for (let index = 1; index < dotCount; index += 1) base = path.posix.dirname(base)
  const parts = rest === '' ? [] : rest.split('.').filter(Boolean)
  const target = parts.length === 0 ? base : path.posix.normalize(path.posix.join(base, ...parts))
  if (target.startsWith('..')) return { unresolved: 'outside-root' }
  const candidates = parts.length === 0
    ? [path.posix.join(target, '__init__.py')]
    : [`${target}.py`, path.posix.join(target, '__init__.py')]
  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return { target: candidate }
  }
  return { unresolved: 'not-found' }
}

function resolveRustUse(specifier, fromFile, srcRoot, fileSet) {
  let rest = String(specifier ?? '').trim()
  let base = path.posix.dirname(fromFile)
  if (rest.startsWith('crate::')) {
    rest = rest.slice('crate::'.length)
    base = srcRoot
  } else if (rest.startsWith('super::')) {
    while (rest.startsWith('super::')) {
      rest = rest.slice('super::'.length)
      const parent = path.posix.dirname(base)
      if (srcRoot === '') {
        base = parent === '.' ? '' : parent
      } else if (parent === srcRoot || parent.startsWith(`${srcRoot}/`)) {
        base = parent
      } else {
        base = srcRoot
      }
    }
  } else if (rest.startsWith('self::')) {
    rest = rest.slice('self::'.length)
  } else if (rest.startsWith('::')) {
    rest = rest.slice(2)
    base = srcRoot
  } else {
    return { external: rest.split('::')[0] }
  }
  rest = rest.replace(/[<{].*$/u, '').trim()
  const segments = rest.split('::').filter(Boolean)
  if (segments.length === 0) return { unresolved: 'not-found' }
  for (let length = segments.length; length >= 1; length -= 1) {
    const target = path.posix.normalize(path.posix.join(base, ...segments.slice(0, length)))
    for (const candidate of [`${target}.rs`, path.posix.join(target, 'mod.rs')]) {
      if (fileSet.has(candidate)) return { target: candidate }
    }
  }
  return { unresolved: 'not-found' }
}

function goModuleForPath(filePath, modules) {
  let best
  for (const module of modules) {
    if (module.root === '' || fileUnderDirectory(filePath, module.root)) {
      if (best === undefined || module.root.length > best.root.length) best = module
    }
  }
  return best
}

function cargoRootForPath(filePath, roots) {
  let best
  for (const root of roots) {
    if (fileUnderDirectory(filePath, root.directory)) {
      if (best === undefined || root.directory.length > best.directory.length) best = root
    }
  }
  return best
}

async function buildImportGraph(scan, limits, warnings) {
  const files = Array.isArray(scan.files) ? scan.files : []
  const manifests = Array.isArray(scan.manifests) ? scan.manifests : []
  const fileSet = new Set(files.map(file => file.path))
  const goModules = manifests
    .filter(manifest => manifest.kind === 'go' && typeof manifest.name === 'string' && manifest.name.trim() !== '')
    .map(manifest => ({ name: manifest.name.trim(), root: normalizeRepoDirectory(manifest.path) }))
  const cargoRoots = manifests
    .filter(manifest => manifest.kind === 'rust')
    .map(manifest => {
      const directory = normalizeRepoDirectory(manifest.path)
      const sourceRoot = path.posix.join(directory === '' ? '.' : directory, 'src').replace(/^\.\//u, '')
      const hasSourceRoot = files.some(file => fileUnderDirectory(file.path, sourceRoot))
      return { directory, srcRoot: hasSourceRoot ? sourceRoot : directory }
    })
  const goFilesByDirectory = new Map()
  for (const file of files) {
    if (file.language !== 'go') continue
    const directory = normalizeRepoDirectory(file.path)
    const list = goFilesByDirectory.get(directory) ?? []
    list.push(file.path)
    goFilesByDirectory.set(directory, list)
  }
  for (const list of goFilesByDirectory.values()) list.sort(compareText)

  const aliasConfigs = await readAliasConfigs(scan, files, warnings)
  const aliasSummaries = aliasConfigs
    .map(config => {
      const summary = {
        config: config.path,
        baseUrl: config.baseUrl === '' ? '.' : config.baseUrl,
        patterns: config.patterns.map(entry => entry.pattern).sort(compareText),
      }
      if (config.extends.length > 0) summary.extends = config.extends
      return summary
    })
    .sort((left, right) => compareText(left.config, right.config))
  const pythonRoots = pythonPackageRoots(files)

  const edgeMap = new Map()
  const external = new Set()
  const unresolved = []
  let unresolvedDropped = 0
  let parsedFiles = 0
  let readBytes = 0
  let budgetWarned = false

  const importFiles = files
    .filter(file => IMPORT_LANGUAGES.has(file.language))
    .sort((left, right) => compareText(left.path, right.path))

  for (const file of importFiles) {
    if (parsedFiles >= limits.maxImportFiles) {
      if (!budgetWarned) warnings.push(`达到 import 文件上限 ${limits.maxImportFiles}，后续源码未解析。`)
      budgetWarned = true
      break
    }
    if (readBytes + file.size > limits.maxImportBytes) {
      if (!budgetWarned) warnings.push(`达到 import 读取上限 ${limits.maxImportBytes} 字节，后续源码未解析。`)
      budgetWarned = true
      break
    }
    let text
    try {
      text = await fs.readFile(path.join(scan.root, ...file.path.split('/')), 'utf8')
    } catch (error) {
      warnings.push(`读取 import 失败：${file.path}（${errorMessage(error)}）`)
      continue
    }
    parsedFiles += 1
    readBytes += file.size
    let specifiers = []
    if (['js', 'ts', 'tsx', 'jsx'].includes(file.language)) specifiers = parseJsSpecifiers(text)
    else if (file.language === 'py') specifiers = parsePythonSpecifiers(text)
    else if (file.language === 'go') specifiers = parseGoSpecifiers(text)
    else if (file.language === 'rs') specifiers = parseRustSpecifiers(text)

    const aliasCandidates = ['js', 'ts', 'tsx', 'jsx'].includes(file.language)
      ? aliasCandidatesForFile(file.path, aliasConfigs)
      : []
    for (const item of specifiers) {
      let resolution
      if (['js', 'ts', 'tsx', 'jsx'].includes(file.language)) {
        resolution = resolveJsImport(
          item.specifier,
          file.path,
          fileSet,
          aliasCandidates,
        )
      } else if (file.language === 'py') {
        resolution = resolvePythonImport(item.specifier, file.path, fileSet, pythonRoots)
      } else if (file.language === 'go') {
        const module = goModuleForPath(file.path, goModules)
        if (module === undefined || !(item.specifier === module.name || item.specifier.startsWith(`${module.name}/`))) {
          resolution = { external: item.specifier }
        } else {
          const rest = item.specifier === module.name ? '' : item.specifier.slice(module.name.length + 1)
          const targetDirectory = rest === ''
            ? module.root
            : path.posix.normalize(path.posix.join(module.root === '' ? '.' : module.root, rest))
          const currentDirectory = normalizeRepoDirectory(file.path)
          if (targetDirectory === currentDirectory) {
            resolution = { skip: true }
          } else {
            const targetFiles = goFilesByDirectory.get(targetDirectory) ?? []
            resolution = targetFiles.length > 0 ? { target: targetFiles[0] } : { unresolved: 'not-found' }
          }
        }
      } else if (file.language === 'rs') {
        if (item.kind === 'mod') {
          const base = path.posix.dirname(file.path)
          const candidates = [
            path.posix.join(base, `${item.specifier}.rs`),
            path.posix.join(base, item.specifier, 'mod.rs'),
          ]
          const target = candidates.find(candidate => fileSet.has(candidate))
          resolution = target === undefined ? { unresolved: 'not-found' } : { target }
        } else {
          const cargo = cargoRootForPath(file.path, cargoRoots)
          const srcRoot = cargo?.srcRoot ?? ''
          resolution = resolveRustUse(item.specifier, file.path, srcRoot, fileSet)
        }
      }
      if (resolution === undefined) continue
      if (resolution.external !== undefined) {
        external.add(resolution.external)
        continue
      }
      if (resolution.skip === true) continue
      if (resolution.unresolved !== undefined) {
        if (unresolved.length < MAX_UNRESOLVED_IMPORTS) {
          unresolved.push({ from: file.path, specifier: item.specifier, reason: resolution.unresolved })
        } else {
          unresolvedDropped += 1
        }
        continue
      }
      if (resolution.target === undefined || resolution.target === file.path) continue
      const key = `${file.path}|${resolution.target}|${item.kind}`
      if (!edgeMap.has(key)) {
        const edge = { from: file.path, to: resolution.target, kind: item.kind, specifier: item.specifier }
        if (resolution.alias === true) edge.alias = true
        edgeMap.set(key, edge)
      }
    }
  }

  if (unresolvedDropped > 0) {
    warnings.push(`无法解析的 import 超过 ${MAX_UNRESOLVED_IMPORTS} 条，已截断 ${unresolvedDropped} 条。`)
  }

  const edges = [...edgeMap.values()].sort((left, right) => (
    compareText(left.from, right.from)
    || compareText(left.to, right.to)
    || compareText(left.kind, right.kind)
    || compareText(left.specifier, right.specifier)
  ))
  const directoryWeights = new Map()
  for (const edge of edges) {
    const fromDirectory = normalizeRepoDirectory(edge.from) || '.'
    const toDirectory = normalizeRepoDirectory(edge.to) || '.'
    const key = `${fromDirectory}|${toDirectory}`
    const bucket = directoryWeights.get(key)
    if (bucket === undefined) directoryWeights.set(key, { from: fromDirectory, to: toDirectory, weight: 1 })
    else bucket.weight += 1
  }
  const byDirectory = [...directoryWeights.values()].sort((left, right) => (
    compareText(left.from, right.from)
    || compareText(left.to, right.to)
  ))
  unresolved.sort((left, right) => (
    compareText(left.from, right.from)
    || compareText(left.specifier, right.specifier)
    || compareText(left.reason, right.reason)
  ))
  return {
    files: parsedFiles,
    edges,
    unresolved,
    external: [...external].sort(compareText),
    byDirectory,
    aliases: aliasSummaries,
  }
}

// ---------------------------------------------------------------------------
// Import graph diagram (v0.16): deterministic, renderable directory/module view.

export const IMPORT_DIAGRAM_LIMITS = Object.freeze({
  maxNodes: 40,
  maxEdges: 80,
})

function capDiagramEdges(edges, maxEdges) {
  let kept = edges.slice().sort((left, right) => (
    compareText(left.from, right.from) || compareText(left.to, right.to)
  ))
  let truncated = false
  if (kept.length > maxEdges) {
    kept = kept
      .slice()
      .sort((left, right) => (
        right.weight - left.weight
        || compareText(left.from, right.from)
        || compareText(left.to, right.to)
      ))
      .slice(0, maxEdges)
      .sort((left, right) => compareText(left.from, right.from) || compareText(left.to, right.to))
    truncated = true
  }
  return { edges: kept, truncated }
}

function aggregateDiagramEdges(pairs, maxEdges) {
  const weights = new Map()
  for (const pair of pairs) {
    if (pair.from === pair.to) continue
    const key = `${pair.from}|${pair.to}`
    const bucket = weights.get(key)
    if (bucket === undefined) weights.set(key, { from: pair.from, to: pair.to, weight: 1 })
    else bucket.weight += 1
  }
  return capDiagramEdges([...weights.values()], maxEdges)
}

function fileImportDiagram(pairs, files, maxNodes, maxEdges, diagram) {
  let filesKept = files
  let truncated = false
  if (files.length > maxNodes) {
    const weightByFile = new Map()
    for (const pair of pairs) {
      weightByFile.set(pair.from, (weightByFile.get(pair.from) ?? 0) + 1)
      weightByFile.set(pair.to, (weightByFile.get(pair.to) ?? 0) + 1)
    }
    filesKept = files
      .slice()
      .sort((left, right) => (
        (weightByFile.get(right) ?? 0) - (weightByFile.get(left) ?? 0) || compareText(left, right)
      ))
      .slice(0, maxNodes)
      .sort(compareText)
    truncated = true
  }
  const fileSet = new Set(filesKept)
  const keptPairs = pairs.filter(pair => fileSet.has(pair.from) && fileSet.has(pair.to))
  const aggregated = aggregateDiagramEdges(keptPairs, maxEdges)
  diagram.nodes = filesKept.map(file => ({ id: file, type: 'module', label: file.split(/[\\/]/).filter(Boolean).pop() || file }))
  diagram.edges = aggregated.edges.map(edge => ({
    from: edge.from,
    to: edge.to,
    label: 'imports',
    kind: 'depends',
    weight: edge.weight,
  }))
  diagram.truncated = truncated || aggregated.truncated
  return diagram
}

function directoryAtDepth(directory, depth) {
  if (directory === '') return ''
  const segments = directory.split('/')
  return segments.slice(0, Math.min(depth, segments.length)).join('/')
}

function directoryNodeId(directory) {
  return directory === '' ? '.' : directory
}

function directoryImportDiagram(scan, pairs, directories, maxNodes, maxEdges, diagram) {
  const rootName = path.posix.basename(String(scan.root ?? '').replace(/\\/gu, '/')) || 'root'
  // Keep full directory paths while they fit; only then roll up toward the
  // repository root. This keeps `src/core` distinct from `src/ui`.
  let collapseDepth = null
  let maxDepth = 1
  for (const directory of directories) maxDepth = Math.max(maxDepth, directory === '' ? 1 : directory.split('/').length)
  if (new Set(directories).size > maxNodes) {
    collapseDepth = 1
    while (
      new Set(directories.map(directory => directoryAtDepth(directory, collapseDepth))).size > maxNodes
      && collapseDepth < maxDepth
    ) {
      collapseDepth += 1
    }
  }
  const mapDirectory = directory => (
    collapseDepth === null ? directory : directoryAtDepth(directory, collapseDepth)
  )
  const collapsedPairs = pairs.map(pair => ({
    from: directoryNodeId(mapDirectory(normalizeRepoDirectory(pair.from))),
    to: directoryNodeId(mapDirectory(normalizeRepoDirectory(pair.to))),
  }))
  const aggregated = aggregateDiagramEdges(collapsedPairs, maxEdges)
  const nodeWeight = new Map()
  for (const edge of aggregated.edges) {
    nodeWeight.set(edge.from, (nodeWeight.get(edge.from) ?? 0) + edge.weight)
    nodeWeight.set(edge.to, (nodeWeight.get(edge.to) ?? 0) + edge.weight)
  }
  let nodeIds = [...new Set(directories.map(directory => directoryNodeId(mapDirectory(directory))))]
  let truncated = collapseDepth !== null
    && new Set(directories.map(directory => directoryNodeId(directory))).size
      > new Set(directories.map(directory => directoryNodeId(mapDirectory(directory)))).size
  if (nodeIds.length > maxNodes) {
    nodeIds = nodeIds
      .slice()
      .sort((left, right) => (
        (nodeWeight.get(right) ?? 0) - (nodeWeight.get(left) ?? 0) || compareText(left, right)
      ))
      .slice(0, maxNodes)
      .sort(compareText)
    truncated = true
  }
  const keptIds = new Set(nodeIds)
  const edges = aggregated.edges
    .filter(edge => keptIds.has(edge.from) && keptIds.has(edge.to))
    .sort((left, right) => compareText(left.from, right.from) || compareText(left.to, right.to))
  // The filter can drop edges when nodes were truncated; re-cap defensively.
  const edgeCap = capDiagramEdges(edges, maxEdges)
  diagram.nodes = nodeIds.map(id => ({
    id,
    type: 'module',
    label: id === '.' ? rootName : (id.split(/[\\/]/).filter(Boolean).pop() || id),
  }))
  diagram.edges = edgeCap.edges.map(edge => ({
    from: edge.from,
    to: edge.to,
    label: 'imports',
    kind: 'depends',
    weight: edge.weight,
  }))
  diagram.truncated = truncated || aggregated.truncated || edgeCap.truncated
  return diagram
}

export function buildImportDiagram(scan, options = {}) {
  if (scan === null || typeof scan !== 'object') throw new TypeError('buildImportDiagram 需要 scan 结果对象。')
  const input = options !== null && typeof options === 'object' ? options : {}
  const maxNodes = positiveInteger(input.maxNodes, IMPORT_DIAGRAM_LIMITS.maxNodes)
  const maxEdges = positiveInteger(input.maxEdges, IMPORT_DIAGRAM_LIMITS.maxEdges)
  const level = input.level === 'file' || input.level === 'directory' ? input.level : 'auto'
  const sourceEdges = Array.isArray(scan.imports?.edges) ? scan.imports.edges : []
  const pairs = []
  for (const edge of sourceEdges) {
    const from = String(edge?.from ?? '')
    const to = String(edge?.to ?? '')
    if (from === '' || to === '' || from === to) continue
    pairs.push({ from, to })
  }
  const diagram = {
    key: 'imports',
    layerId: 'A',
    type: 'module',
    title: 'File import graph',
    nodes: [],
    edges: [],
    truncated: false,
  }
  if (pairs.length === 0) return diagram
  const files = uniqueSorted(pairs.flatMap(pair => [pair.from, pair.to]))
  const directories = uniqueSorted(files.map(file => normalizeRepoDirectory(file)))
  const useFiles = level === 'file'
    || (level === 'auto' && directories.length <= 1 && files.length <= maxNodes)
  if (useFiles) return fileImportDiagram(pairs, files, maxNodes, maxEdges, diagram)
  return directoryImportDiagram(scan, pairs, directories, maxNodes, maxEdges, diagram)
}

function topLevelPackageDirectories(scan, entry) {
  const base = packageDirectory(entry)
  const prefix = base === '' ? '' : `${base}/`
  const directories = Array.isArray(scan.directories) ? scan.directories : []
  const files = Array.isArray(scan.files) ? scan.files : []
  const selected = directories.filter(directory => {
    if (!fileUnderDirectory(directory, base)) return false
    const rest = base === '' ? directory : directory.slice(prefix.length)
    if (rest === '' || rest.includes('/')) return false
    if (LAYER_SKIP_DIRECTORIES.has(path.posix.basename(directory).toLowerCase())) return false
    return files.some(file => (
      file.path.startsWith(`${directory}/`)
      && file.language !== null
      && file.language !== undefined
      && !isTestFile(file.path)
      && !isDocFile(file.path)
    ))
  })
  selected.sort((left, right) => sourceDirPriority(left) - sourceDirPriority(right) || compareText(left, right))
  return selected.slice(0, SUGGEST_LIMITS.maxLayerModules)
}

function moduleCandidateForDirectory(directory, candidates) {
  const normalized = directory === '.' ? '' : String(directory ?? '')
  let fallback
  let best
  let bestLength = -1
  for (const candidate of candidates) {
    if (candidate.directory === '') {
      fallback = candidate
      continue
    }
    if (normalized === candidate.directory || normalized.startsWith(`${candidate.directory}/`)) {
      if (candidate.directory.length > bestLength) {
        best = candidate
        bestLength = candidate.directory.length
      }
    }
  }
  return best ?? fallback
}

function aggregateImportEdges(byDirectory, candidates) {
  const weights = new Map()
  for (const item of byDirectory) {
    const from = moduleCandidateForDirectory(item.from, candidates)
    const to = moduleCandidateForDirectory(item.to, candidates)
    if (from === undefined || to === undefined || from.module.id === to.module.id) continue
    const key = `${from.module.id}|${to.module.id}`
    const bucket = weights.get(key)
    if (bucket === undefined) {
      weights.set(key, { from: from.module.id, to: to.module.id, weight: item.weight })
    } else {
      bucket.weight += item.weight
    }
  }
  return [...weights.values()].sort((left, right) => compareText(`${left.from}|${left.to}`, `${right.from}|${right.to}`))
}

// Directory aggregates are preferred; a scan that only exposes file edges still
// gets grouped locally so child layers keep real import weights.
function directoryImportPairs(scan) {
  const byDirectory = Array.isArray(scan?.imports?.byDirectory) ? scan.imports.byDirectory : []
  if (byDirectory.length > 0) return byDirectory
  const edges = Array.isArray(scan?.imports?.edges) ? scan.imports.edges : []
  const weights = new Map()
  for (const edge of edges) {
    const from = normalizeRepoDirectory(edge?.from) || '.'
    const to = normalizeRepoDirectory(edge?.to) || '.'
    const key = `${from}|${to}`
    const bucket = weights.get(key)
    if (bucket === undefined) weights.set(key, { from, to, weight: 1 })
    else bucket.weight += 1
  }
  return [...weights.values()].sort((left, right) => (
    compareText(left.from, right.from) || compareText(left.to, right.to)
  ))
}

function layerDefinition(letter, title, parentModuleId, modules, diagrams) {
  return {
    letter,
    title,
    parentModuleId,
    modules,
    diagrams,
  }
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

  const freshVerification = () => ({
    tests: { status: 'pending', evidence: [] },
    reviewer: { status: 'pending', evidence: [] },
    human: { status: 'pending', evidence: [] },
  })
  const pushModule = (module, mount) => {
    module.layerId = 'A'
    module.parentId = null
    module.mountIds = [mount.id]
    if (!Array.isArray(module.acceptance)) module.acceptance = ['tests / reviewer / human 三层验证通过']
    module.status = 'pending'
    module.verification = freshVerification()
    modules.push(module)
    return module
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
    if (rootSinglePackage) {
      notes.push('单包仓库生成 A 层总览模块，源码目录放入子层。')
    } else {
      notes.push(`检测到 ${packages.length} 个包，已按包生成模块与挂载。`)
    }
  }

  // Real import aggregates win over manifest dependency edges.
  const byDirectory = directoryImportPairs(scan)
  const packageModuleCandidates = [...moduleIdByPackage]
    .map(([entry, module]) => ({ directory: packageDirectory(entry), module }))
  const importModuleEdges = aggregateImportEdges(byDirectory, packageModuleCandidates)
  const moduleEdgeWeights = new Map()

  if (importModuleEdges.length > 0) {
    for (const module of modules) module.dependsOn = []
    for (const edge of importModuleEdges) {
      moduleEdgeWeights.set(`${edge.from}|${edge.to}`, edge.weight)
      const source = modules.find(module => module.id === edge.from)
      if (source !== undefined && !source.dependsOn.includes(edge.to)) source.dependsOn.push(edge.to)
    }
    for (const module of modules) {
      if ((module.dependsOn ?? []).length > 0) module.dependsOn = uniqueSorted(module.dependsOn)
    }
    notes.push(`A 层模块依赖使用 ${importModuleEdges.length} 条真实 import 聚合边。`)
  } else {
    const moduleNameToModule = new Map()
    for (const [entry, module] of moduleIdByPackage) moduleNameToModule.set(entry.name, module)
    for (const [entry, module] of moduleIdByPackage) {
      const dependencies = []
      for (const dependency of entry.dependencies ?? []) {
        const target = moduleNameToModule.get(dependency)
        if (target !== undefined && target.id !== module.id) dependencies.push(target.id)
      }
      if (dependencies.length > 0) module.dependsOn = uniqueSorted(dependencies)
    }
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
      const edge = { from: module.id, to: dependency, label: 'depends', kind: 'depends' }
      const weight = moduleEdgeWeights.get(`${module.id}|${dependency}`)
      if (weight !== undefined) edge.weight = weight
      moduleEdges.push(edge)
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

  // Child layers: one per leaf package, modules from its top-level source dirs.
  const layers = [{ letter: 'A', title: '总览', parentModuleId: null }]
  const leafPackages = packages.filter(entry => {
    const directory = packageDirectory(entry)
    return !packages.some(other => {
      if (other === entry) return false
      const otherDirectory = packageDirectory(other)
      if (otherDirectory === '') return false
      if (directory === '') return true
      return otherDirectory.startsWith(`${directory}/`)
    })
  })
  const layerCandidates = leafPackages
    .filter(entry => moduleIdByPackage.has(entry))
    .sort((left, right) => compareText(left.relativePath, right.relativePath))
  const selectedLayerPackages = layerCandidates.slice(0, SUGGEST_LIMITS.maxChildLayers)
  let layerIndex = 0
  for (const entry of selectedLayerPackages) {
    const parent = moduleIdByPackage.get(entry)
    const directories = topLevelPackageDirectories(scan, entry)
    if (directories.length === 0) {
      notes.push(`包 ${entry.name} 没有可识别的顶层源码目录，未生成子层。`)
      continue
    }
    const letter = String.fromCharCode('B'.charCodeAt(0) + layerIndex)
    const childCandidates = []
    const childModules = []
    for (const directory of directories) {
      const child = {
        id: uniqueId(slugify(`${packageDirectory(entry) || 'root'}-${directory}`), usedModuleIds),
        name: path.posix.basename(directory),
        code: `${letter}${childModules.length + 1}`,
        layerId: letter,
        parentId: parent.id,
        mountIds: [...parent.mountIds],
        summary: `Source directory ${directory} of ${entry.name}.`,
        files: filesUnder(scan, directory),
        dependsOn: [],
        acceptance: ['tests / reviewer / human 三层验证通过'],
        status: 'pending',
        verification: freshVerification(),
      }
      childModules.push(child)
      childCandidates.push({ directory, module: child })
    }
    const childImportEdges = aggregateImportEdges(byDirectory, childCandidates)
    const childWeights = new Map()
    const childNodeIds = new Set(childModules.map(module => module.id))
    for (const edge of childImportEdges) {
      if (!childNodeIds.has(edge.from) || !childNodeIds.has(edge.to)) continue
      childWeights.set(`${edge.from}|${edge.to}`, edge.weight)
      const source = childModules.find(module => module.id === edge.from)
      if (source !== undefined && !source.dependsOn.includes(edge.to)) source.dependsOn.push(edge.to)
    }
    for (const module of childModules) {
      if (module.dependsOn.length > 0) module.dependsOn = uniqueSorted(module.dependsOn)
    }
    const childEdges = []
    for (const module of childModules) {
      for (const dependency of module.dependsOn) {
        if (!childNodeIds.has(dependency)) continue
        const edge = { from: module.id, to: dependency, label: 'depends', kind: 'depends' }
        const weight = childWeights.get(`${module.id}|${dependency}`)
        if (weight !== undefined) edge.weight = weight
        childEdges.push(edge)
      }
    }
    childEdges.sort((left, right) => compareText(`${left.from}|${left.to}`, `${right.from}|${right.to}`))
    if (childImportEdges.length === 0 && childModules.length > 1) {
      notes.push(`包 ${entry.name} 的 ${letter} 子层没有跨目录 import，模块图保留无依赖边。`)
    }
    const layerDiagrams = [{
      key: `${letter}:module`,
      layerId: letter,
      type: 'module',
      title: `${entry.name} modules`,
      nodes: childModules.map(module => ({
        id: module.id,
        type: 'module',
        label: module.name,
        description: module.summary,
      })),
      edges: childEdges,
    }]
    layers.push(layerDefinition(letter, `${entry.name} package`, parent.id, childModules, layerDiagrams))
    notes.push(`为包 ${entry.name} 生成子层 ${letter}（${childModules.length} 个模块）。`)
    layerIndex += 1
  }
  if (layerCandidates.length > selectedLayerPackages.length) {
    notes.push(`包数超过子层上限 ${SUGGEST_LIMITS.maxChildLayers}，其余 ${layerCandidates.length - selectedLayerPackages.length} 个包保留 A 层模块。`)
  }
  const layerModuleCount = layers.reduce(
    (total, layer) => total + (Array.isArray(layer.modules) ? layer.modules.length : 0),
    0,
  )
  if (modules.length + layerModuleCount > SUGGEST_LIMITS.maxModules) {
    notes.push(`模块数 ${modules.length + layerModuleCount} 超过建议上限 ${SUGGEST_LIMITS.maxModules}，分派前建议合并。`)
  }

  notes.push(`扫描根目录：${scan.root ?? ''}；文件 ${files.length} 个；检测到 ${packages.length} 个包。`)
  notes.push('建议只读生成，未写入蓝图；请由 Agent 使用 blueprint(action="update") 应用，scan apply 尚未实现。')

  return {
    mounts,
    modules,
    diagrams,
    layers,
    notes,
    insights: Array.isArray(scan.metrics?.insights) ? scan.metrics.insights : [],
  }
}
