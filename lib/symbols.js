// Export-signature extraction. Deliberately dependency-free and heuristic: the
// goal is to tell a subagent "what this file exposes", not to build a parser.
// A file that cannot be understood yields an empty list plus `parseable: false`
// so callers can mark the gap instead of silently claiming knowledge.

const JS_EXTENSIONS = Object.freeze(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts'])
const PYTHON_EXTENSIONS = Object.freeze(['.py', '.pyi'])

export const SYMBOL_LIMITS = Object.freeze({
  maxSymbols: 40,
  maxSignatureChars: 160,
  maxParamLines: 3,
})

export function languageOfFile(filePath) {
  const value = String(filePath ?? '').trim().toLowerCase()
  const dot = value.lastIndexOf('.')
  const extension = dot === -1 ? '' : value.slice(dot)
  if (JS_EXTENSIONS.includes(extension)) return 'js'
  if (PYTHON_EXTENSIONS.includes(extension)) return 'python'
  return null
}

function clean(value) {
  return String(value ?? '')
    .replace(/\s+/gu, ' ')
    .replace(/\s*\{\s*$/u, '')
    .trim()
    .slice(0, SYMBOL_LIMITS.maxSignatureChars)
}

function unique(list) {
  const seen = new Set()
  const out = []
  for (const item of list) {
    const key = item.name
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function joinParams(lines, start, openParenIndex) {
  // A heuristic only: join following lines until the parameter list closes, cap
  // at a few lines, so `function foo(\n  a,\n  b\n)` still renders as one line.
  let text = lines[start]
  let depth = (text.slice(openParenIndex).match(/\(/gu) ?? []).length - (text.slice(openParenIndex).match(/\)/gu) ?? []).length
  for (let index = start + 1; index < lines.length && depth > 0 && index - start < SYMBOL_LIMITS.maxParamLines; index += 1) {
    text += ` ${lines[index]}`
    depth += (lines[index].match(/\(/gu) ?? []).length - (lines[index].match(/\)/gu) ?? []).length
  }
  return text
}

function jsSymbols(source) {
  const lines = source.split(/\r?\n/u)
  const symbols = []
  const exportedNames = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    let match

    if ((match = /^\s*export\s+default\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)?\s*\(/u.exec(line)) !== null) {
      symbols.push({ kind: 'function', name: match[1] ?? 'default', signature: clean(joinParams(lines, index, line.indexOf('('))) })
      continue
    }
    if ((match = /^\s*export\s+default\s+class\s+([A-Za-z_$][\w$]*)?/u.exec(line)) !== null) {
      symbols.push({ kind: 'class', name: match[1] ?? 'default', signature: clean(line) })
      continue
    }
    if ((match = /^\s*export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/u.exec(line)) !== null) {
      symbols.push({ kind: 'function', name: match[1], signature: clean(joinParams(lines, index, line.indexOf('('))) })
      continue
    }
    if ((match = /^\s*export\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/u.exec(line)) !== null) {
      symbols.push({ kind: 'class', name: match[1], signature: clean(line) })
      continue
    }
    if ((match = /^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*=>/u.exec(line)) !== null) {
      const name = match[1]
      const params = match[2] ?? match[3] ?? ''
      symbols.push({ kind: 'function', name, signature: clean(`const ${name} = (${params}) =>`) })
      continue
    }
    if ((match = /^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/u.exec(line)) !== null) {
      symbols.push({ kind: 'const', name: match[1], signature: clean(line.split('=')[0]) })
      continue
    }
    if ((match = /^\s*export\s*\{([^}]*)\}/u.exec(line)) !== null) {
      for (const part of match[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/u)[0].trim()
        if (name !== '') exportedNames.push({ kind: 're-export', name, signature: 'export { … }' })
      }
      continue
    }
    if ((match = /^\s*export\s+type\s+([A-Za-z_$][\w$]*)/u.exec(line)) !== null) {
      symbols.push({ kind: 'type', name: match[1], signature: clean(line) })
      continue
    }
    if ((match = /^\s*export\s+interface\s+([A-Za-z_$][\w$]*)/u.exec(line)) !== null) {
      symbols.push({ kind: 'interface', name: match[1], signature: clean(line) })
      continue
    }
    if ((match = /^\s*module\.exports\s*=\s*\{([^}]*)\}/u.exec(line)) !== null) {
      for (const part of match[1].split(',')) {
        const name = part.trim().split(':')[0].trim()
        if (name !== '') exportedNames.push({ kind: 'commonjs', name, signature: 'module.exports = { … }' })
      }
      continue
    }
    if ((match = /^\s*module\.exports\s*=\s*([A-Za-z_$][\w$]*)/u.exec(line)) !== null) {
      exportedNames.push({ kind: 'commonjs', name: match[1], signature: 'module.exports = …' })
      continue
    }
    if ((match = /^\s*exports\.([A-Za-z_$][\w$]*)\s*=/u.exec(line)) !== null) {
      exportedNames.push({ kind: 'commonjs', name: match[1], signature: 'exports.name = …' })
    }
  }

  return unique([...symbols, ...exportedNames])
}

function pythonSymbols(source) {
  const lines = source.split(/\r?\n/u)
  const symbols = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    let match
    if ((match = /^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/u.exec(line)) !== null) {
      symbols.push({ kind: 'function', name: match[1], signature: clean(joinParams(lines, index, line.indexOf('('))) })
      continue
    }
    if ((match = /^class\s+([A-Za-z_]\w*)/u.exec(line)) !== null) {
      symbols.push({ kind: 'class', name: match[1], signature: clean(line) })
      continue
    }
    if ((match = /^([A-Z][A-Z0-9_]{1,})\s*=/u.exec(line)) !== null) {
      symbols.push({ kind: 'const', name: match[1], signature: clean(line.split('=')[0]) })
      continue
    }
    if ((match = /^__all__\s*=\s*\[([^\]]*)\]/u.exec(line)) !== null) {
      for (const part of match[1].split(',')) {
        const name = part.trim().replace(/^['"]|['"]$/gu, '')
        if (name !== '') symbols.push({ kind: 're-export', name, signature: '__all__' })
      }
    }
  }
  return unique(symbols)
}

export function extractSymbols(source, filePath) {
  const language = languageOfFile(filePath)
  if (language === null) return { language: null, symbols: [], truncated: false, parseable: true }
  const text = String(source ?? '')
  const symbols = language === 'js' ? jsSymbols(text) : pythonSymbols(text)
  const truncated = symbols.length > SYMBOL_LIMITS.maxSymbols
  return {
    language,
    symbols: truncated ? symbols.slice(0, SYMBOL_LIMITS.maxSymbols) : symbols,
    truncated,
    parseable: symbols.length > 0,
  }
}
