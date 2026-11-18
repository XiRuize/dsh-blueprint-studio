// Compile a module into an executable context pack: the exact files, exported
// symbols, import edges, tests and acceptance criteria a subagent needs. Unlike
// a diagram, every line here is derived from the workspace instead of invented
// by the model, so a missing file is reported instead of looking complete.

import fs from 'node:fs/promises'
import path from 'node:path'
import { buildDispatchPacket } from './blueprint.js'
import { extractSymbols, languageOfFile } from './symbols.js'

export const CONTEXT_PACK_LIMITS = Object.freeze({
  maxFiles: 40,
  maxGlobFiles: 200,
  maxWalkEntries: 20000,
  maxSymbolsPerFile: 24,
  maxImportEdges: 24,
  maxChars: 12000,
  maxTotalChars: 80000,
  maxFileBytes: 262144,
})

const SKIP_DIR_NAMES = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out', 'coverage',
  '.next', '.nuxt', '.cache', '.turbo', '.venv', 'venv', '__pycache__',
  'target', 'vendor', '.idea', '.vscode',
])

function text(value) {
  return typeof value === 'string' ? value : ''
}

function stringList(value) {
  if (!Array.isArray(value)) return []
  return value.map(item => text(item).trim()).filter(item => item !== '')
}

function posix(value) {
  return String(value ?? '').replace(/\\/gu, '/')
}

function stripDotSlash(value) {
  return posix(value).replace(/^\.\//u, '').replace(/\/+$/u, '')
}

function samePath(left, right) {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
}

// A blueprint must never make the Host read outside its declared mount. Globs
// walk inside the root by construction, but a literal `../secret` would otherwise
// escape; containment is checked on the resolved absolute path.
function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function isTestPath(value) {
  const file = posix(value)
  return /(^|\/)(test|tests|__tests__|spec)\//u.test(file) || /\.(test|spec)\.[^./]+$/u.test(file)
}

function moduleFiles(module) {
  return stringList(module?.files)
}

// --- path resolution -------------------------------------------------------

export function resolveMountRoots(packet, cwd) {
  const base = path.resolve(cwd ?? process.cwd())
  const mounts = Array.isArray(packet?.mounts) ? packet.mounts : []
  const roots = []
  for (const mount of mounts) {
    const root = text(mount?.root).trim()
    if (root === '') continue
    roots.push({
      mountId: text(mount?.id).trim(),
      root,
      absolute: path.resolve(base, root),
      kind: text(mount?.kind).trim() || 'working',
      access: text(mount?.access).trim() || 'rw',
    })
  }
  if (roots.length === 0) {
    roots.push({ mountId: '', root: '.', absolute: base, kind: 'working', access: 'rw', implicit: true })
  }
  return roots
}

function globToRegExp(pattern) {
  let out = '^'
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        out += '.*'
        index += 1
        if (pattern[index + 1] === '/') {
          out += '/?'
          index += 1
        }
      } else {
        out += '[^/]*'
      }
    } else if (char === '?') {
      out += '[^/]'
    } else if ('\\^$+.[]{}()|'.includes(char)) {
      out += `\\${char}`
    } else {
      out += char
    }
  }
  return new RegExp(`${out}$`, 'u')
}

function hasWildcard(pattern) {
  return pattern.includes('*') || pattern.includes('?')
}

function staticBase(pattern) {
  const index = pattern.search(/[*?]/u)
  const prefix = index === -1 ? pattern : pattern.slice(0, index)
  const slash = prefix.lastIndexOf('/')
  return slash === -1 ? '' : prefix.slice(0, slash)
}

async function walkRelative(rootAbsolute, baseRelative, limits) {
  const found = []
  let entriesSeen = 0
  const stack = [baseRelative]
  while (stack.length > 0 && found.length < limits.maxGlobFiles && entriesSeen < limits.maxWalkEntries) {
    const relative = stack.pop()
    const directory = relative === '' ? rootAbsolute : path.join(rootAbsolute, relative)
    let entries
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch {
      continue
    }
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      entriesSeen += 1
      if (entriesSeen >= limits.maxWalkEntries) break
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (SKIP_DIR_NAMES.has(entry.name)) continue
        stack.push(relative === '' ? entry.name : `${relative}/${entry.name}`)
        continue
      }
      if (!entry.isFile()) continue
      found.push(relative === '' ? entry.name : `${relative}/${entry.name}`)
      if (found.length >= limits.maxGlobFiles) break
    }
  }
  return found
}

async function statFile(absolute) {
  try {
    const info = await fs.stat(absolute)
    return info
  } catch {
    return undefined
  }
}

async function expandPattern(pattern, roots, limits) {
  const normalized = stripDotSlash(pattern)
  const resolved = []
  if (normalized === '') return { files: resolved, missing: false }
  for (const root of roots) {
    if (!hasWildcard(normalized)) {
      const absolute = path.join(root.absolute, normalized)
      if (!isInside(root.absolute, absolute)) continue
      const info = await statFile(absolute)
      if (info === undefined) continue
      if (info.isFile()) {
        resolved.push({ path: normalized, absolute, mountId: root.mountId, bytes: info.size })
        return { files: resolved, missing: false }
      }
      if (info.isDirectory()) {
        let entries = []
        try {
          entries = await fs.readdir(absolute, { withFileTypes: true })
        } catch {
          continue
        }
        for (const entry of entries) {
          if (!entry.isFile()) continue
          resolved.push({
            path: `${normalized}/${entry.name}`,
            absolute: path.join(absolute, entry.name),
            mountId: root.mountId,
            bytes: 0,
          })
          if (resolved.length >= limits.maxGlobFiles) break
        }
        return { files: resolved, missing: false }
      }
      continue
    }
    const base = staticBase(normalized)
    const walked = await walkRelative(root.absolute, base, limits)
    const matcher = globToRegExp(normalized)
    const matches = walked.filter(file => matcher.test(file))
    if (matches.length === 0) continue
    for (const file of matches) {
      const absolute = path.join(root.absolute, file)
      if (!isInside(root.absolute, absolute)) continue
      const info = await statFile(absolute)
      if (info === undefined || !info.isFile()) continue
      resolved.push({ path: file, absolute, mountId: root.mountId, bytes: info.size })
    }
    return { files: resolved, missing: false }
  }
  return { files: resolved, missing: true }
}

export async function resolveModuleFiles(packet, cwd, limits = CONTEXT_PACK_LIMITS) {
  const roots = resolveMountRoots(packet, cwd)
  const patterns = moduleFiles(packet?.module)
  const files = []
  const seen = new Set()
  const missing = []
  let truncated = false
  for (const pattern of patterns) {
    const expanded = await expandPattern(pattern, roots, limits)
    if (expanded.missing) missing.push(pattern)
    for (const file of expanded.files) {
      const key = file.absolute.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      if (files.length >= limits.maxFiles) {
        truncated = true
        break
      }
      files.push(file)
    }
    if (truncated) break
  }
  files.sort((left, right) => left.path.localeCompare(right.path))
  return { roots, patterns, files, missing, truncated }
}

// --- repository facts ------------------------------------------------------

async function readSymbolsFor(file, limits) {
  const language = languageOfFile(file.path)
  if (language === null) return { language: null, symbols: [], truncated: false, parseable: true, skipped: true }
  if (file.bytes > limits.maxFileBytes) {
    return { language, symbols: [], truncated: false, parseable: false, skipped: true, reason: 'too-large' }
  }
  let source
  try {
    source = await fs.readFile(file.absolute, 'utf8')
  } catch {
    return { language, symbols: [], truncated: false, parseable: false, skipped: true, reason: 'unreadable' }
  }
  const extracted = extractSymbols(source, file.path)
  const symbols = extracted.symbols.slice(0, limits.maxSymbolsPerFile)
  return {
    language,
    symbols,
    truncated: extracted.truncated || extracted.symbols.length > symbols.length,
    parseable: extracted.parseable,
    skipped: false,
  }
}

function testCommandsFor(scan, files) {
  if (scan === null || typeof scan !== 'object') return []
  const commands = new Set()
  const paths = files.map(file => file.path)
  for (const entry of Array.isArray(scan.packages) ? scan.packages : []) {
    const directory = text(entry?.relativePath).replace(/^\.$/u, '')
    const relevant = paths.some(file => directory === '' || file === directory || file.startsWith(`${directory}/`))
    if (!relevant) continue
    for (const command of Array.isArray(entry?.testCommands) ? entry.testCommands : []) {
      if (text(command).trim() !== '') commands.add(text(command).trim())
    }
  }
  if (commands.size === 0) {
    for (const command of Array.isArray(scan.testCommands) ? scan.testCommands : []) {
      if (text(command).trim() !== '') commands.add(text(command).trim())
    }
  }
  return [...commands].slice(0, 4)
}

function relatedTests(scan, files) {
  if (scan === null || typeof scan !== 'object') return []
  const stems = new Set()
  const directories = new Set()
  for (const file of files) {
    const base = path.posix.basename(file.path)
    const stem = base.replace(/\.[^.]+$/u, '').replace(/\.(test|spec)$/u, '')
    if (stem !== '') stems.add(stem)
    const directory = path.posix.dirname(file.path)
    if (directory !== '.') directories.add(directory)
  }
  const candidates = []
  for (const record of Array.isArray(scan.files) ? scan.files : []) {
    const file = posix(record?.path)
    if (!isTestPath(file)) continue
    const base = path.posix.basename(file)
    const stem = base.replace(/\.[^.]+$/u, '').replace(/\.(test|spec)$/u, '')
    if (!stems.has(stem) && !directories.has(path.posix.dirname(file))) continue
    candidates.push(file)
  }
  return [...new Set(candidates)].sort().slice(0, 8)
}

function importContext(scan, roots, files, limits) {
  if (scan === null || typeof scan !== 'object') return null
  const edges = Array.isArray(scan?.imports?.edges) ? scan.imports.edges : []
  if (edges.length === 0) return null
  const matchesRoot = roots.some(root => text(scan.root) !== '' && samePath(root.absolute, scan.root))
  if (!matchesRoot) return null
  const inside = new Set(files.map(file => file.path))
  const incoming = []
  const outgoing = []
  for (const edge of edges) {
    const from = posix(edge?.from)
    const to = posix(edge?.to)
    if (inside.has(from) && !inside.has(to)) outgoing.push({ from, to, kind: text(edge?.kind) || 'import' })
    else if (inside.has(to) && !inside.has(from)) incoming.push({ from, to, kind: text(edge?.kind) || 'import' })
    if (incoming.length >= limits.maxImportEdges && outgoing.length >= limits.maxImportEdges) break
  }
  const sortEdges = list => list.sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to))
  return {
    incoming: sortEdges(incoming).slice(0, limits.maxImportEdges),
    outgoing: sortEdges(outgoing).slice(0, limits.maxImportEdges),
  }
}

// --- rendering -------------------------------------------------------------

function formatBytes(value) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function renderContextPack(facts, limits = CONTEXT_PACK_LIMITS) {
  const lines = []
  lines.push(`## 模块 ${facts.name}（${facts.code || facts.moduleId} · ${facts.moduleId}）`)
  lines.push('')
  if (facts.layer) lines.push(`- 层：${facts.layer}`)
  if (facts.status) lines.push(`- 状态：${facts.status}`)
  if (facts.summary) lines.push(`- 范围：${facts.summary}`)

  if (facts.roots.length === 0) {
    lines.push('- 工作区：未绑定 mounts，按会话 cwd 解析')
  } else {
    for (const root of facts.roots) {
      const flags = [root.access || 'rw', root.kind || 'working'].join('/')
      lines.push(`- 工作区：\`${root.absolute}\`（${flags}${root.implicit ? '，未声明 mounts，使用会话 cwd' : ''}）`)
    }
  }

  lines.push('')
  lines.push(`### 文件（${facts.files.length} 个，已校验存在）`)
  if (facts.files.length === 0) {
    lines.push('- （未声明文件，按 greenfield 处理；先与用户确认落点）')
  } else {
    for (const file of facts.files) {
      const size = formatBytes(file.bytes)
      const language = file.language ?? ''
      lines.push(`- \`${file.path}\`${size ? ` · ${size}` : ''}${language ? ` · ${language}` : ''}`)
    }
  }
  if (facts.truncated) lines.push(`- …文件超过上限 ${limits.maxFiles} 个，已截断`)

  const withSymbols = facts.symbols.filter(entry => entry.symbols.length > 0)
  if (withSymbols.length > 0) {
    lines.push('')
    lines.push('### 导出符号')
    for (const entry of withSymbols) {
      lines.push(`- \`${entry.file}\``)
      for (const symbol of entry.symbols) lines.push(`  - \`${symbol.signature}\``)
      if (entry.truncated) lines.push(`  - …超过 ${limits.maxSymbolsPerFile} 个符号，已截断`)
    }
  }
  const unparsed = facts.symbols.filter(entry => !entry.parseable && !entry.skipped)
  if (unparsed.length > 0) {
    lines.push('')
    lines.push('### 无法确认的符号')
    for (const entry of unparsed) lines.push(`- \`${entry.file}\`：启发式解析未发现导出，需人工确认`)
  }
  const skipped = facts.files.filter(entry => entry.skipped === true)
  if (skipped.length > 0) {
    lines.push('')
    lines.push('### 未抽取符号的文件')
    for (const entry of skipped) {
      const reason = entry.reason === 'too-large'
        ? `超过 ${formatBytes(CONTEXT_PACK_LIMITS.maxFileBytes)} 读取上限`
        : entry.reason === 'unreadable' ? '读取失败' : '不是可解析的源码'
      lines.push(`- \`${entry.path}\`：${reason}`)
    }
  }

  if (facts.imports !== null) {
    const { incoming, outgoing } = facts.imports
    if (incoming.length > 0 || outgoing.length > 0) {
      lines.push('')
      lines.push('### 依赖边')
      for (const edge of incoming) lines.push(`- 入：\`${edge.from}\` →（本模块）· ${edge.kind}`)
      for (const edge of outgoing) lines.push(`- 出：（本模块）→ \`${edge.to}\` · ${edge.kind}`)
    }
  }

  if (facts.tests.length > 0 || facts.testCommands.length > 0) {
    lines.push('')
    lines.push('### 测试')
    for (const file of facts.tests) lines.push(`- \`${file}\``)
    if (facts.testCommands.length === 0) lines.push('- 未发现测试命令，需在验收里补一条可执行命令')
    for (const command of facts.testCommands) lines.push(`- 命令：\`${command}\``)
  }

  if (facts.acceptance.length > 0) {
    lines.push('')
    lines.push('### 验收标准')
    for (const item of facts.acceptance) lines.push(`- ${item}`)
  }

  if (facts.requirements.length > 0) {
    lines.push('')
    lines.push('### 关联需求')
    for (const item of facts.requirements) lines.push(`- ${item.code ? `${item.code} ` : ''}${item.text}`)
  }

  if (facts.issues.length > 0) {
    lines.push('')
    lines.push('### 缺口')
    for (const issue of facts.issues) lines.push(`- ${issue.message}`)
  }

  let markdown = lines.join('\n')
  if (markdown.length > limits.maxChars) {
    markdown = `${markdown.slice(0, limits.maxChars)}\n\n…（上下文包已按 ${limits.maxChars} 字符截断）`
  }
  return markdown
}

// --- public API ------------------------------------------------------------

function requirementsFor(blueprint, moduleId) {
  const requirements = []
  for (const section of Array.isArray(blueprint?.sections) ? blueprint.sections : []) {
    for (const item of Array.isArray(section?.items) ? section.items : []) {
      if (text(item?.moduleId).trim() !== moduleId) continue
      const body = text(item?.text).trim()
      if (body === '') continue
      requirements.push({ code: text(item?.code).trim(), text: body })
    }
  }
  return requirements
}

export function leafModules(blueprint) {
  const modules = Array.isArray(blueprint?.modules) ? blueprint.modules : []
  const parents = new Set()
  for (const module of modules) {
    const parentId = text(module?.parentId).trim()
    if (parentId !== '') parents.add(parentId)
  }
  const leaves = modules.filter(module => !parents.has(text(module?.id).trim()))
  return leaves.length > 0 ? leaves : modules
}

export async function buildContextPack(blueprint, moduleId, options = {}) {
  const id = text(moduleId).trim()
  const modules = Array.isArray(blueprint?.modules) ? blueprint.modules : []
  const module = modules.find(entry => text(entry?.id).trim() === id)
  if (module === undefined) {
    return {
      ok: false,
      moduleId: id,
      issues: [{ code: 'module-unknown', severity: 'error', message: `模块不存在：${id || '(空)'}` }],
    }
  }
  const limits = { ...CONTEXT_PACK_LIMITS, ...(options.limits ?? {}) }
  const packet = buildDispatchPacket(blueprint, id)
  const cwd = options.cwd ?? process.cwd()
  const resolved = await resolveModuleFiles(packet, cwd, limits)
  const fileFacts = []
  for (const file of resolved.files) {
    const extracted = await readSymbolsFor(file, limits)
    fileFacts.push({
      path: file.path,
      bytes: file.bytes,
      language: extracted.language,
      symbols: extracted.symbols,
      truncated: extracted.truncated,
      parseable: extracted.parseable,
      skipped: extracted.skipped,
      reason: extracted.reason,
    })
  }

  const issues = []
  for (const pattern of resolved.missing) {
    issues.push({
      code: 'context-file-missing',
      severity: 'error',
      message: `文件不存在：\`${pattern}\`（在 ${resolved.roots.map(root => root.absolute).join('、')} 下未找到）`,
    })
  }
  if (resolved.roots.every(root => root.implicit === true)) {
    issues.push({
      code: 'context-mount-implicit',
      severity: 'warn',
      message: '未绑定 mounts，按会话 cwd 解析；跨仓库任务请先补 mounts。',
    })
  }
  if (resolved.files.length === 0 && resolved.missing.length === 0) {
    issues.push({
      code: 'context-files-empty',
      severity: 'warn',
      message: '模块未声明 files：子代理只能拿到需求与验收，落点需先确认。',
    })
  }

  const acceptance = stringList(module.acceptance)
  if (acceptance.length === 0) {
    issues.push({ code: 'context-acceptance-empty', severity: 'warn', message: '模块没有任何验收标准。' })
  }

  const facts = {
    moduleId: id,
    code: text(module.code).trim(),
    name: text(module.name).trim() || id,
    layer: text(module.layerId).trim(),
    status: text(module.status).trim(),
    summary: text(module.summary).trim(),
    roots: resolved.roots,
    files: fileFacts,
    symbols: fileFacts.map(entry => ({
      file: entry.path,
      symbols: entry.symbols,
      truncated: entry.truncated,
      parseable: entry.parseable,
      skipped: entry.skipped,
    })),
    imports: importContext(options.scan ?? null, resolved.roots, resolved.files, limits),
    tests: relatedTests(options.scan ?? null, resolved.files),
    testCommands: testCommandsFor(options.scan ?? null, resolved.files),
    acceptance,
    requirements: requirementsFor(blueprint, id),
    issues,
    truncated: resolved.truncated,
  }
  const markdown = renderContextPack(facts, limits)
  return {
    ok: issues.every(issue => issue.severity !== 'error'),
    ...facts,
    markdown,
    chars: markdown.length,
  }
}

export async function buildContextPacks(blueprint, options = {}) {
  const wanted = options.moduleId === undefined ? undefined : text(options.moduleId).trim()
  const modules = wanted === undefined
    ? leafModules(blueprint)
    : (Array.isArray(blueprint?.modules) ? blueprint.modules.filter(module => text(module?.id).trim() === wanted) : [])
  const packs = []
  for (const module of modules) {
    packs.push(await buildContextPack(blueprint, text(module?.id).trim(), options))
  }
  const issues = []
  for (const pack of packs) {
    for (const issue of Array.isArray(pack.issues) ? pack.issues : []) {
      issues.push({ ...issue, moduleId: pack.moduleId })
    }
  }
  if (wanted !== undefined && packs.length === 0) {
    issues.push({ moduleId: wanted, code: 'module-unknown', severity: 'error', message: `模块不存在：${wanted || '(空)'}` })
  }

  // A large blueprint can produce dozens of packs; keep the whole response inside
  // a predictable budget so a single brief/dispatch cannot flood the model context.
  const budget = Number.isFinite(options.maxTotalChars) ? options.maxTotalChars : CONTEXT_PACK_LIMITS.maxTotalChars
  let used = 0
  for (const pack of packs) {
    const markdown = text(pack.markdown)
    if (used + markdown.length <= budget) {
      used += markdown.length
      continue
    }
    const remaining = Math.max(0, budget - used)
    const note = `…（总预算 ${budget} 字符已用尽，用 /blueprint context ${pack.moduleId} 获取完整包）`
    pack.markdown = remaining > 400 ? `${markdown.slice(0, remaining)}\n\n${note}` : note
    pack.chars = pack.markdown.length
    pack.budgetTruncated = true
    used = budget
  }

  return {
    ok: packs.every(pack => pack.ok === true) && !issues.some(issue => issue.severity === 'error'),
    packs,
    issues,
  }
}
