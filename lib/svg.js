// Blueprint Studio v0.13 - deterministic inline SVG for review pages.
//
// `renderDiagramSvg` is a pure string projector: no DOM, no external asset, no
// animation and no script. Every label and attribute is escaped, the node count
// is capped at SVG_MAX_NODES so one diagram cannot grow without bound, and the
// same diagram always renders to the same string. The review page embeds the
// result inline, so the standalone SVG intentionally omits xmlns (inline SVG in
// HTML does not need it); the output therefore contains no http(s) URL at all.
//
// Layout is deliberately simple and read-only: a layered layout for connected
// diagrams, a grid for isolated nodes, and a dedicated track layout for
// sequence diagrams. It is not pixel-identical to the interactive canvas.

export const SVG_MAX_NODES = 300

const SUPPORTED_TYPES = new Set([
  'usecase',
  'dfd',
  'module',
  'sequence',
  'er',
  'c4',
  'class',
  'state',
  'flowchart',
])

const SVG_PAD = 24
const INNER = 16
const FONT_SIZE = 13
const LINE_HEIGHT = 17
const INK = '#1f2430'
const MUTED = '#5f6878'
const EDGE = '#64748b'
const FONT_FAMILY = '-apple-system, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif'

// Layout gaps are derived from measured node sizes instead of being fixed, so a
// diagram of tall ER cards and a diagram of small pills do not share the same
// whitespace. The bounds keep dense diagrams compact and spacious ones legible.
const MIN_GAP_X = 44
const MAX_GAP_X = 96
const MIN_GAP_Y = 26
const MAX_GAP_Y = 64

const TYPE_COLORS = Object.freeze({
  actor: '#7c3aed',
  usecase: '#2f55d4',
  system: '#475569',
  entity: '#0f766e',
  process: '#2563eb',
  store: '#7c3aed',
  module: '#0f766e',
  external: '#64748b',
  participant: '#2f55d4',
  relationship: '#b45309',
  person: '#7c3aed',
  container: '#2563eb',
  component: '#0891b2',
  database: '#0f766e',
  class: '#b45309',
  interface: '#7c3aed',
  state: '#2563eb',
  initial: '#111827',
  final: '#111827',
  choice: '#b45309',
  start: '#15803d',
  end: '#b91c1c',
  decision: '#b45309',
  group: '#64748b',
  note: '#a16207',
  node: '#475569',
})

// --- theme tokens -----------------------------------------------------------
//
// Every colour used by a shape resolves through a CSS custom property emitted
// in an inline <style> scoped to `svg.diagram-svg`. The presentation attributes
// stay as a light fallback, so the SVG is still readable in a viewer that drops
// or ignores the style element. With no `options.theme` the inline CSS follows
// the host page's `prefers-color-scheme`; an explicit theme pins `data-theme`.

const LIGHT_FILLS = Object.freeze({
  surface: '#ffffff',
  panel: '#f8fafc',
  cool: '#eef2ff',
  teal: '#f0fdfa',
  cyan: '#ecfeff',
  note: '#fef9c3',
  warm: '#fffbeb',
  decision: '#fef3c7',
  choice: '#fff7ed',
  blue: '#eff6ff',
  violet: '#f5f3ff',
  purple: '#faf5ff',
  start: '#dcfce7',
  end: '#fee2e2',
  code: '#f0f2f7',
  slate: '#f1f5f9',
})

const DARK_FILLS = Object.freeze({
  surface: '#1c2029',
  panel: '#1f2530',
  cool: '#1e2740',
  teal: '#102e2b',
  cyan: '#102b30',
  note: '#3a3517',
  warm: '#33290f',
  decision: '#3a2f12',
  choice: '#3a2a16',
  blue: '#18243d',
  violet: '#271f3d',
  purple: '#261c33',
  start: '#12301d',
  end: '#3a1d1d',
  code: '#232936',
  slate: '#232936',
})

const LIGHT_INKS = Object.freeze({
  ink: INK,
  muted: MUTED,
  edge: EDGE,
  line: '#94a3b8',
  white: '#ffffff',
})

const DARK_INKS = Object.freeze({
  ink: '#e6e9f0',
  muted: '#9aa4b5',
  edge: '#8b96a8',
  line: '#4b5568',
  white: '#ffffff',
})

// Mix a light palette stroke toward white for dark surfaces. This is deliberately
// arithmetic (not CSS color-mix) so the output is deterministic everywhere.
function lightenHex(hex, amount) {
  const match = /^#([0-9a-f]{6})$/iu.exec(String(hex))
  if (match === null) return hex
  const value = Number.parseInt(match[1], 16)
  const channel = shift => {
    const part = (value >> shift) & 0xff
    return Math.round(part + (255 - part) * amount)
  }
  const toHex = part => part.toString(16).padStart(2, '0')
  return `#${toHex(channel(16))}${toHex(channel(8))}${toHex(channel(0))}`
}

const DARK_TYPE_COLORS = Object.freeze(Object.fromEntries(
  Object.entries(TYPE_COLORS).map(([type, color]) => [type, lightenHex(color, 0.38)]),
))

function palette(theme) {
  const fills = theme === 'dark' ? DARK_FILLS : LIGHT_FILLS
  const inks = theme === 'dark' ? DARK_INKS : LIGHT_INKS
  const types = theme === 'dark' ? DARK_TYPE_COLORS : TYPE_COLORS
  const result = { ...fills, ...inks }
  for (const [type, color] of Object.entries(types)) result[`c-${type}`] = color
  return result
}

const THEMES = Object.freeze({ light: palette('light'), dark: palette('dark') })

const THEME_KEYS = Object.freeze(Object.keys(THEMES.light))

const FILL_TOKEN_BY_HEX = new Map()
for (const key of Object.keys(LIGHT_FILLS)) {
  const token = LIGHT_FILLS[key].toLowerCase()
  if (!FILL_TOKEN_BY_HEX.has(token)) FILL_TOKEN_BY_HEX.set(token, key)
}

const STROKE_TOKEN_BY_HEX = new Map()
for (const [type, color] of Object.entries(TYPE_COLORS)) {
  const token = String(color).toLowerCase()
  if (!STROKE_TOKEN_BY_HEX.has(token)) STROKE_TOKEN_BY_HEX.set(token, `c-${type}`)
}
STROKE_TOKEN_BY_HEX.set(EDGE.toLowerCase(), 'edge')
STROKE_TOKEN_BY_HEX.set('#94a3b8', 'line')
STROKE_TOKEN_BY_HEX.set('#e2e8f0', 'line')
STROKE_TOKEN_BY_HEX.set('#ffffff', 'white')

function paintStyle(fillValue, strokeValue) {
  const declarations = []
  if (fillValue !== undefined) {
    const token = FILL_TOKEN_BY_HEX.get(String(fillValue).toLowerCase())
    if (token !== undefined) declarations.push(`fill:var(--bp-${token})`)
  }
  if (strokeValue !== undefined) {
    const token = STROKE_TOKEN_BY_HEX.get(String(strokeValue).toLowerCase())
    if (token !== undefined) declarations.push(`stroke:var(--bp-${token})`)
  }
  return declarations.length === 0 ? '' : ` style="${declarations.join(';')}"`
}

function themeBlock(theme) {
  const tokens = THEMES[theme]
  return THEME_KEYS.map(key => `--bp-${key}:${tokens[key]}`).join(';')
}

function themeStyle(theme) {
  let css = `svg.diagram-svg{${themeBlock('light')}}`
  if (theme === 'dark') {
    css += `svg.diagram-svg[data-theme="dark"]{${themeBlock('dark')}}`
  } else if (theme === '') {
    css += `@media (prefers-color-scheme: dark){svg.diagram-svg{${themeBlock('dark')}}}`
  }
  // A printed review should always use ink on paper, even when the screen is dark.
  css += `@media print{svg.diagram-svg{${themeBlock('light')}}}`
  return `<style>${css}</style>`
}

function themeOf(options) {
  const value = clean(options?.theme).toLowerCase()
  return value === 'light' || value === 'dark' ? value : ''
}

// --- small value helpers ----------------------------------------------------

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function str(value) {
  return typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

// Strip control characters that XML 1.0 forbids; keep \t \n \r out by folding.
function clean(value) {
  return str(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '').trim()
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;')
}

function num(value) {
  const rounded = Math.round(Number(value) * 10) / 10
  return Number.isFinite(rounded) ? String(rounded) : '0'
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

const WIDE_CHAR = /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/u

function charWidth(char) {
  const code = char.codePointAt(0)
  if (code === undefined) return 0
  if (code < 0x20 || code === 0x7f) return 0
  if (code < 0x80) {
    // Narrow Latin glyphs such as i/l/punctuation need less room; using one
    // conservative width for every ASCII character would over-truncate labels.
    return /[ilI.,:;'`!|jw]/u.test(char) ? 5 : 7
  }
  return 13
}

// Width estimate used for wrapping, sizing and clipping. It mirrors common
// system sans fonts closely enough for CJK and Latin without a browser.
function ascWidth(value) {
  let width = 0
  for (const char of String(value ?? '')) width += charWidth(char)
  return width
}

function ellipsizeToWidth(value, maxWidth) {
  if (ascWidth(value) <= maxWidth) return value
  const chars = [...value]
  let out = ''
  for (const char of chars) {
    if (ascWidth(`${out}${char}…`) > maxWidth) break
    out += char
  }
  return out === '' ? '…' : `${out}…`
}

// Used when a hard line limit drops content: the kept line always receives an
// ellipsis, even when it already fits the width on its own.
function appendEllipsis(value, maxWidth) {
  const ellipsis = '…'
  if (ascWidth(value) + ascWidth(ellipsis) <= maxWidth) return `${value}${ellipsis}`
  let out = ''
  for (const char of [...value]) {
    if (ascWidth(`${out}${char}${ellipsis}`) > maxWidth) break
    out += char
  }
  return `${out}${ellipsis}`
}

// Width-aware wrap with an optional hard line limit and width-aware ellipsis.
// CJK breaks at any character; Latin prefers the last space before the limit.
function wrapText(value, maxWidth = 220, maxLines = 3) {
  const normalized = clean(value).replace(/\s+/gu, ' ').trim()
  if (normalized === '') return ['']
  const width = Math.max(24, Number.isFinite(maxWidth) ? maxWidth : 220)
  const limit = Math.max(1, Number.isFinite(maxLines) ? Math.floor(maxLines) : 3)
  const lines = []
  let line = ''
  let lineWidth = 0
  let tokenWidth = 0
  // Very long unspaced ASCII tokens (URLs, XML snippets, generated ids) still
  // need a break opportunity, otherwise a single token can overflow a card.
  const TOKEN_MAX_WIDTH = 88

  const pushLine = () => {
    if (line.trim() !== '') lines.push(line.trimEnd())
    line = ''
    lineWidth = 0
    tokenWidth = 0
  }

  for (const char of normalized) {
    const charW = charWidth(char)
    if (char === ' ') {
      tokenWidth = 0
      if (line === '') continue
      if (lineWidth + charW <= width) {
        line += ' '
        lineWidth += charW
      } else {
        pushLine()
      }
      continue
    }
    const wide = WIDE_CHAR.test(char)
    if (!wide) {
      if (tokenWidth + charW > TOKEN_MAX_WIDTH && line !== '') {
        pushLine()
      }
      tokenWidth += charW
    } else {
      tokenWidth = 0
    }
    if (lineWidth + charW > width && line !== '') {
      const space = line.lastIndexOf(' ')
      if (space > 0 && !wide) {
        const carry = line.slice(space + 1)
        lines.push(line.slice(0, space).trimEnd())
        line = carry
        lineWidth = ascWidth(carry)
        tokenWidth = lineWidth
      } else {
        pushLine()
      }
    }
    line += char
    lineWidth += charW
  }
  pushLine()
  if (lines.length === 0) return ['']
  if (lines.length > limit) {
    const kept = lines.slice(0, limit)
    const last = kept.length - 1
    kept[last] = appendEllipsis(kept[last], width)
    return kept
  }
  return lines
}

function colorOf(type) {
  return TYPE_COLORS[type] ?? TYPE_COLORS.node
}

function markerIdentifier(key) {
  const raw = clean(str(key) || 'diagram').toLowerCase()
  let slug = raw.replace(/[^a-z0-9_-]+/gu, '-').replace(/^-+|-+$/gu, '')
  if (slug === '') slug = 'diagram'
  let hash = 5381
  for (const char of raw) hash = ((hash << 5) + hash + char.codePointAt(0)) >>> 0
  return `svg-arrow-${slug.slice(0, 32)}-${hash.toString(36)}`
}

// --- text and shape primitives ---------------------------------------------

function textLines(lines, cx, centerY, options = {}) {
  const size = options.size ?? FONT_SIZE
  const lh = options.lh ?? LINE_HEIGHT
  const anchor = options.anchor ?? 'middle'
  const fill = options.fill ?? INK
  const weight = options.weight ?? 400
  const start = centerY - ((lines.length - 1) * lh) / 2
  const style = paintStyle(fill, undefined)
  return lines.map((line, index) => {
    const y = start + index * lh + size * 0.36
    return `<text x="${num(cx)}" y="${num(y)}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="${FONT_FAMILY}"${style}>${esc(line)}</text>`
  }).join('')
}

function lineText(value, x, y, options = {}) {
  const anchor = options.anchor ?? 'start'
  const size = options.size ?? 12
  const fill = options.fill ?? INK
  const weight = options.weight ?? 400
  const style = paintStyle(fill, undefined)
  return `<text x="${num(x)}" y="${num(y)}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="${FONT_FAMILY}"${style}>${esc(value)}</text>`
}

function rect(x, y, w, h, options = {}) {
  const rx = options.rx ?? 8
  const fill = options.fill ?? '#ffffff'
  const stroke = options.stroke ?? '#94a3b8'
  const width = options.strokeWidth ?? 1.6
  const dash = options.dash === true ? ' stroke-dasharray="7 5"' : ''
  const opacity = options.fillOpacity === undefined ? '' : ` fill-opacity="${num(options.fillOpacity)}"`
  return `<rect x="${num(x)}" y="${num(y)}" width="${num(Math.max(1, w))}" height="${num(Math.max(1, h))}" rx="${num(rx)}" fill="${fill}"${opacity} stroke="${stroke}" stroke-width="${num(width)}"${dash}${paintStyle(fill, stroke)}/>`
}

function diamond(x, y, w, h, options = {}) {
  const cx = x + w / 2
  const cy = y + h / 2
  const points = `${num(cx)},${num(y)} ${num(x + w)},${num(cy)} ${num(cx)},${num(y + h)} ${num(x)},${num(cy)}`
  const fill = options.fill ?? '#fef3c7'
  const stroke = options.stroke ?? TYPE_COLORS.decision
  return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${num(options.strokeWidth ?? 1.6)}"${paintStyle(fill, stroke)}/>`
}

function ellipse(x, y, w, h, options = {}) {
  const fill = options.fill ?? '#ffffff'
  const stroke = options.stroke ?? '#94a3b8'
  return `<ellipse cx="${num(x + w / 2)}" cy="${num(y + h / 2)}" rx="${num(w / 2)}" ry="${num(h / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="${num(options.strokeWidth ?? 1.6)}"${paintStyle(fill, stroke)}/>`
}

// --- diagram input model ----------------------------------------------------

function diagramTypeOf(source) {
  const explicit = clean(source?.type).toLowerCase()
  if (explicit !== '') return explicit
  const key = clean(source?.key)
  const tail = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key
  return tail.toLowerCase()
}

function normalizeFields(raw) {
  const fields = []
  for (const entry of list(raw)) {
    const value = typeof entry === 'string' ? { name: entry } : object(entry)
    if (value === undefined) continue
    const name = clean(value.name ?? value.field ?? value.label)
    if (name === '') continue
    fields.push({
      name,
      type: clean(value.type ?? value.dataType),
      key: value.key === true || value.primary === true,
      nullable: value.nullable === true,
      kind: clean(value.kind).toLowerCase() === 'method' ? 'method' : 'field',
    })
  }
  return fields
}

function modelNode(raw, index, usedIds) {
  const node = {
    id: clean(raw?.id) || `n${index + 1}`,
    type: clean(raw?.type).toLowerCase() || 'node',
    label: clean(raw?.label ?? raw?.name ?? raw?.title),
    description: clean(raw?.description ?? raw?.note),
    technology: clean(raw?.technology),
    parentGroup: clean(raw?.parentGroup ?? raw?.group),
    fields: normalizeFields(raw?.fields ?? raw?.attributes ?? raw?.columns),
    order: Number.isFinite(raw?.order) ? raw.order : index,
    index,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  }
  if (node.label === '') node.label = node.id
  if (usedIds.has(node.id)) {
    let suffix = 2
    while (usedIds.has(`${node.id}#${suffix}`)) suffix += 1
    node.id = `${node.id}#${suffix}`
  }
  usedIds.add(node.id)
  return node
}

function modelEdge(raw, index, ids) {
  if (object(raw) === undefined) return undefined
  const from = clean(raw.from ?? raw.source)
  const to = clean(raw.to ?? raw.target)
  if (!ids.has(from) || !ids.has(to) || from === to) return undefined
  return {
    id: clean(raw.id) || `e${index + 1}`,
    from,
    to,
    label: clean(raw.label ?? raw.name ?? raw.message),
    kind: clean(raw.kind ?? raw.type).toLowerCase(),
    cardinality: clean(raw.cardinality ?? raw.card),
    order: Number.isFinite(raw.order) ? raw.order : (Number.isFinite(raw.seq) ? raw.seq : undefined),
    index,
  }
}

// --- measurement ------------------------------------------------------------

function widestOf(lines) {
  let widest = 0
  for (const line of lines) widest = Math.max(widest, ascWidth(line))
  return widest
}

function measureNode(node, diagramType) {
  const type = node.type
  if (type === 'initial') {
    node.lines = ['']
    node.w = 28
    node.h = 28
    return
  }
  if (type === 'final') {
    node.lines = ['']
    node.w = 36
    node.h = 36
    return
  }
  if (type === 'choice') {
    node.lines = ['']
    node.w = 70
    node.h = 70
    return
  }
  if (type === 'decision') {
    // A diamond narrows away from its centre, so the text is wrapped to the
    // usable centre band rather than to the full bounding box.
    let lines = wrapText(node.label, 190, 2)
    let width = clamp(widestOf(lines) * 1.62 + 52, 160, 300)
    lines = wrapText(node.label, Math.max(96, width * 0.72), 2)
    width = clamp(Math.max(width, widestOf(lines) * 1.62 + 52), 160, 300)
    node.lines = lines
    node.w = width
    node.h = Math.max(86, lines.length * LINE_HEIGHT + 54)
    return
  }
  if (type === 'actor') {
    const lines = wrapText(node.label, 160, 2)
    node.lines = lines
    node.w = Math.max(120, widestOf(lines) + 28)
    node.h = 78 + lines.length * LINE_HEIGHT + 8
    return
  }
  if (type === 'usecase' && diagramType === 'usecase') {
    const lines = wrapText(node.label, 210, 3)
    node.lines = lines
    node.w = clamp(widestOf(lines) + 50, 130, 280)
    node.h = Math.max(60, lines.length * LINE_HEIGHT + 30)
    return
  }
  if (type === 'system' && diagramType === 'usecase') {
    const lines = wrapText(node.label, 280, 2)
    node.lines = lines
    node.w = Math.max(200, widestOf(lines) + 40)
    node.h = 120
    return
  }
  if (type === 'entity' && diagramType === 'er') {
    measureEntity(node, wrapText(node.label, 230, 2))
    return
  }
  if (type === 'class' || type === 'interface') {
    measureClass(node, wrapText(node.label, 230, 2))
    return
  }
  if (type === 'note') {
    const lines = wrapText(node.label, 220, 3)
    node.lines = lines
    node.w = clamp(widestOf(lines) + 30, 150, 300)
    node.h = Math.max(52, lines.length * LINE_HEIGHT + 28)
    return
  }
  if (type === 'database') {
    const lines = wrapText(node.label, 200, 3)
    node.lines = lines
    node.w = clamp(widestOf(lines) + 56, 150, 280)
    node.h = Math.max(70, lines.length * LINE_HEIGHT + 50)
    return
  }
  if (type === 'relationship') {
    const lines = wrapText(node.label, 190, 2)
    node.lines = lines
    node.w = clamp(widestOf(lines) + 64, 130, 260)
    node.h = Math.max(66, lines.length * LINE_HEIGHT + 34)
    return
  }
  if (type === 'start' || type === 'end') {
    const lines = wrapText(node.label, 170, 2)
    node.lines = lines
    node.w = clamp(widestOf(lines) + 46, 100, 240)
    node.h = Math.max(42, lines.length * LINE_HEIGHT + 22)
    return
  }
  const lines = wrapText(node.label, 220, 3)
  node.lines = lines
  node.w = clamp(widestOf(lines) + 34, 120, 300)
  node.h = Math.max(46, lines.length * LINE_HEIGHT + 24)
}

function fitFieldRows(node) {
  const inner = Math.max(40, node.w - 24)
  for (const row of [...(node.fieldRows ?? []), ...(node.methodRows ?? [])]) {
    const left = fieldLineLeft(row)
    const right = row.type
    const rightWidth = right === '' ? 0 : ascWidth(right) + 10
    const available = Math.max(28, inner - rightWidth)
    row.leftText = ellipsizeToWidth(left, available)
    row.rightText = right
  }
}

function measureEntity(node, lines) {
  const fields = node.fields.filter(field => field.kind !== 'method')
  node.lines = lines
  node.fieldRows = fields
  let widest = widestOf(lines)
  for (const field of fields) {
    widest = Math.max(widest, ascWidth(fieldLineLeft(field)) + ascWidth(field.type) + 34)
  }
  node.w = clamp(widest + 30, 160, 320)
  node.h = 14 + lines.length * 18 + 8 + (fields.length === 0 ? 10 : fields.length * 22 + 8)
  fitFieldRows(node)
}

function measureClass(node, lines) {
  const fields = node.fields.filter(field => field.kind !== 'method')
  const methods = node.fields.filter(field => field.kind === 'method')
  node.lines = lines
  node.fieldRows = fields
  node.methodRows = methods
  let widest = widestOf(lines)
  for (const row of [...fields, ...methods]) {
    widest = Math.max(widest, ascWidth(fieldLineLeft(row)) + ascWidth(row.type) + 34)
  }
  node.w = clamp(widest + 30, 160, 340)
  let height = 14 + lines.length * 18 + 8
  if (fields.length > 0) height += 8 + fields.length * 22
  if (methods.length > 0) height += 9 + methods.length * 22
  node.h = Math.max(60, height)
  fitFieldRows(node)
}

function fieldLineLeft(field) {
  const prefix = field.key ? '◆ ' : ''
  const suffix = field.kind === 'method' ? '()' : ''
  return `${prefix}${field.name}${suffix}`
}

// --- generic layout ---------------------------------------------------------

function unitFor(node, index) {
  return { id: `u:${node.id}`, node, index, x: 0, y: 0, w: node.w, h: node.h, children: [] }
}

function buildUnits(nodes, diagramType, edges) {
  for (const node of nodes) {
    if (node.type !== 'group' && node.type !== 'note') measureNode(node, diagramType)
  }

  const groupIds = new Set(nodes.filter(node => node.type === 'group').map(node => node.id))
  const children = new Map()
  for (const node of nodes) {
    if (node.type === 'group' || node.type === 'note') continue
    if (node.parentGroup !== '' && groupIds.has(node.parentGroup)) {
      if (!children.has(node.parentGroup)) children.set(node.parentGroup, [])
      children.get(node.parentGroup).push(node)
    }
  }

  const units = []
  const nodeToUnit = new Map()
  for (const node of nodes) {
    if (node.type === 'note') continue
    if (node.type === 'group') {
      node.lines = wrapText(node.label, 200, 1)
      const groupChildren = children.get(node.id) ?? []
      let innerWidth = 0
      let innerHeight = 0
      for (const child of groupChildren) {
        innerWidth = Math.max(innerWidth, child.w)
        innerHeight += child.h + 14
      }
      node.w = Math.max(160, innerWidth + INNER * 2, ascWidth(node.lines[0] ?? '') + 36)
      node.h = Math.max(66, 34 + innerHeight + 12)
      const unit = unitFor(node, units.length)
      unit.w = node.w
      unit.h = node.h
      unit.children = groupChildren
      units.push(unit)
      nodeToUnit.set(node.id, unit.id)
      for (const child of groupChildren) nodeToUnit.set(child.id, unit.id)
    } else if (!node.parentGroup || !groupIds.has(node.parentGroup)) {
      const unit = unitFor(node, units.length)
      units.push(unit)
      nodeToUnit.set(node.id, unit.id)
    }
  }

  units.sort((left, right) => left.index - right.index)

  const edgesByUnit = []
  const seen = new Set()
  for (const edge of edges) {
    const from = nodeToUnit.get(edge.from)
    const to = nodeToUnit.get(edge.to)
    if (from === undefined || to === undefined || from === to) continue
    const signature = `${from}\u0000${to}`
    if (seen.has(signature)) continue
    seen.add(signature)
    edgesByUnit.push([from, to])
  }
  return { units, nodeToUnit, edgesByUnit }
}

function placeUnit(unit, x, y) {
  unit.x = x
  unit.y = y
  if (unit.node.type === 'group') {
    unit.node.x = x
    unit.node.y = y
    let cursor = y + 34
    for (const child of unit.children) {
      child.x = x + INNER
      child.y = cursor
      cursor += child.h + 14
    }
  } else {
    unit.node.x = x
    unit.node.y = y
  }
}

function translateUnit(unit, dx, dy) {
  if (dx === 0 && dy === 0) return
  unit.x += dx
  unit.y += dy
  unit.node.x += dx
  unit.node.y += dy
  for (const child of unit.children) {
    child.x += dx
    child.y += dy
  }
}

// A small deterministic relaxation pass. Ranked columns already separate units,
// but guard rails keep hand-authored note/group mixtures and future layouts from
// stacking two boxes on top of each other.
function relaxOverlaps(units, gapX, gapY) {
  if (units.length < 2) return
  for (let pass = 0; pass < 4; pass += 1) {
    let moved = false
    const ordered = [...units].sort((left, right) => left.y - right.y || left.x - right.x || left.index - right.index)
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const first = ordered[i]
        const second = ordered[j]
        const overlapX = Math.min(first.x + first.w, second.x + second.w) - Math.max(first.x, second.x)
        const overlapY = Math.min(first.y + first.h, second.y + second.h) - Math.max(first.y, second.y)
        if (overlapX <= -gapX || overlapY <= -gapY) continue
        if (overlapX <= 0 || overlapY <= 0) continue
        translateUnit(second, 0, Math.min(96, overlapY + gapY))
        moved = true
      }
    }
    if (!moved) return
  }
}

function boundsOf(units) {
  let maxX = SVG_PAD
  let maxY = SVG_PAD
  for (const unit of units) {
    maxX = Math.max(maxX, unit.x + unit.w)
    maxY = Math.max(maxY, unit.y + unit.h)
  }
  return { width: maxX + SVG_PAD, height: maxY + SVG_PAD }
}

function averageHeight(units) {
  if (units.length === 0) return 40
  return units.reduce((sum, unit) => sum + unit.h, 0) / units.length
}

function layoutUnits(units, edgesByUnit) {
  if (units.length === 0) return { width: SVG_PAD * 2, height: SVG_PAD * 2 }

  if (edgesByUnit.length === 0) {
    const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(units.length))))
    const rows = Math.ceil(units.length / columns)
    const avgWidth = units.reduce((sum, unit) => sum + unit.w, 0) / units.length
    const avgHeight = averageHeight(units)
    const gapX = clamp(36 + avgWidth * 0.1, MIN_GAP_X, MAX_GAP_X)
    const gapY = clamp(20 + avgHeight * 0.12, MIN_GAP_Y, MAX_GAP_Y)
    const columnWidths = new Array(columns).fill(0)
    const rowHeights = new Array(rows).fill(0)
    for (let index = 0; index < units.length; index += 1) {
      const column = index % columns
      const row = Math.floor(index / columns)
      columnWidths[column] = Math.max(columnWidths[column], units[index].w + gapX)
      rowHeights[row] = Math.max(rowHeights[row], units[index].h + gapY)
    }
    let x = SVG_PAD
    let y = SVG_PAD
    for (let index = 0; index < units.length; index += 1) {
      const column = index % columns
      const row = Math.floor(index / columns)
      placeUnit(units[index], x, y)
      x += columnWidths[column]
      if (column === columns - 1) {
        x = SVG_PAD
        y += rowHeights[row]
      }
    }
    relaxOverlaps(units, gapX, gapY)
    return boundsOf(units)
  }

  // Longest-path ranks over layout units. Cycles are tolerated: ranks stop at a
  // small cap instead of growing once per node, so a cyclic blueprint stays
  // readable and deterministic.
  const rank = new Map(units.map(unit => [unit.id, 0]))
  const maxRank = Math.max(1, Math.min(9, units.length - 1))
  for (let pass = 0; pass < units.length + 1; pass += 1) {
    let changed = false
    for (const [from, to] of edgesByUnit) {
      const next = (rank.get(from) ?? 0) + 1
      if (next > maxRank) continue
      if ((rank.get(to) ?? 0) < next) {
        rank.set(to, next)
        changed = true
      }
    }
    if (!changed) break
  }

  const columns = new Map()
  for (const unit of units) {
    const index = rank.get(unit.id) ?? 0
    if (!columns.has(index)) columns.set(index, [])
    columns.get(index).push(unit)
  }
  const keys = [...columns.keys()].sort((a, b) => a - b)
  const maxWidths = keys.map(key => Math.max(...columns.get(key).map(unit => unit.w)))
  const gapXs = keys.map((key, index) => {
    if (index === keys.length - 1) return 0
    const neighbour = maxWidths[index + 1] ?? maxWidths[index]
    return clamp(40 + (maxWidths[index] + neighbour) * 0.045, MIN_GAP_X, MAX_GAP_X)
  })
  const columnHeights = keys.map(key => {
    const items = columns.get(key)
    const gapY = clamp(20 + averageHeight(items) * 0.12, MIN_GAP_Y, MAX_GAP_Y)
    return items.reduce((sum, unit) => sum + unit.h, 0) + gapY * Math.max(0, items.length - 1)
  })
  const totalHeight = Math.max(...columnHeights, 0)

  let x = SVG_PAD
  for (let index = 0; index < keys.length; index += 1) {
    const items = columns.get(keys[index])
    const gapY = clamp(20 + averageHeight(items) * 0.12, MIN_GAP_Y, MAX_GAP_Y)
    let y = SVG_PAD + Math.max(0, (totalHeight - columnHeights[index]) / 2)
    for (const unit of items) {
      placeUnit(unit, x + (maxWidths[index] - unit.w) / 2, y)
      y += unit.h + gapY
    }
    x += maxWidths[index] + gapXs[index]
  }
  relaxOverlaps(units, MIN_GAP_X, MIN_GAP_Y)
  return boundsOf(units)
}

// --- node rendering ---------------------------------------------------------

function renderGroup(node) {
  return rect(node.x, node.y, node.w, node.h, {
    rx: 12,
    fill: '#f8fafc',
    stroke: TYPE_COLORS.group,
    strokeWidth: 1.4,
    dash: true,
  })
}

function renderNote(node) {
  const fold = 14
  const path = `M ${num(node.x)} ${num(node.y)} L ${num(node.x + node.w - fold)} ${num(node.y)} L ${num(node.x + node.w)} ${num(node.y + fold)} L ${num(node.x + node.w)} ${num(node.y + node.h)} L ${num(node.x)} ${num(node.y + node.h)} Z`
  const parts = [
    `<path d="${path}" fill="#fef9c3" stroke="${TYPE_COLORS.note}" stroke-width="1.4"${paintStyle('#fef9c3', TYPE_COLORS.note)}/>`,
    `<path d="M ${num(node.x + node.w - fold)} ${num(node.y)} L ${num(node.x + node.w - fold)} ${num(node.y + fold)} L ${num(node.x + node.w)} ${num(node.y + fold)}" fill="none" stroke="${TYPE_COLORS.note}" stroke-width="1.2"${paintStyle(undefined, TYPE_COLORS.note)}/>`,
  ]
  const centerY = node.y + node.h / 2 + 4
  parts.push(textLines(node.lines ?? wrapText(node.label, 220, 3), node.x + node.w / 2, centerY, { size: 12 }))
  return parts.join('')
}

function renderActor(node) {
  const cx = node.x + node.w / 2
  const top = node.y + 4
  const color = TYPE_COLORS.actor
  const parts = [
    `<circle cx="${num(cx)}" cy="${num(top + 12)}" r="9" fill="#ffffff" stroke="${color}" stroke-width="1.8"${paintStyle('#ffffff', color)}/>`,
    `<line x1="${num(cx)}" y1="${num(top + 21)}" x2="${num(cx)}" y2="${num(top + 46)}" stroke="${color}" stroke-width="1.8"${paintStyle(undefined, color)}/>`,
    `<line x1="${num(cx - 16)}" y1="${num(top + 31)}" x2="${num(cx + 16)}" y2="${num(top + 31)}" stroke="${color}" stroke-width="1.8"${paintStyle(undefined, color)}/>`,
    `<line x1="${num(cx)}" y1="${num(top + 46)}" x2="${num(cx - 14)}" y2="${num(top + 64)}" stroke="${color}" stroke-width="1.8"${paintStyle(undefined, color)}/>`,
    `<line x1="${num(cx)}" y1="${num(top + 46)}" x2="${num(cx + 14)}" y2="${num(top + 64)}" stroke="${color}" stroke-width="1.8"${paintStyle(undefined, color)}/>`,
  ]
  const labelTop = top + 74
  parts.push(textLines(node.lines, cx, labelTop + (node.h - 74) / 2, { size: 12 }))
  return parts.join('')
}

function renderStructured(node, kind) {
  const color = colorOf(node.type)
  const lines = node.lines ?? [node.label]
  const headerHeight = 14 + lines.length * 18
  const parts = [rect(node.x, node.y, node.w, node.h, { rx: kind === 'class' ? 6 : 8, fill: '#ffffff', stroke: color, strokeWidth: 1.7 })]
  // Header band, then the divider so the band never paints over it.
  parts.push(`<rect x="${num(node.x)}" y="${num(node.y)}" width="${num(node.w)}" height="${num(headerHeight)}" rx="6" fill="${kind === 'class' ? '#fffbeb' : '#f0fdfa'}" fill-opacity="0.85" stroke="none"${paintStyle(kind === 'class' ? '#fffbeb' : '#f0fdfa', undefined)}/>`)
  parts.push(`<path d="M ${num(node.x)} ${num(node.y + headerHeight)} L ${num(node.x + node.w)} ${num(node.y + headerHeight)}" stroke="${color}" stroke-width="1.2"/>`)
  if (kind === 'class' && node.type === 'interface') {
    parts.push(lineText('«interface»', node.x + node.w / 2, node.y + 15, { anchor: 'middle', size: 10, fill: color }))
    parts.push(textLines(lines, node.x + node.w / 2, node.y + headerHeight / 2 + 8, { size: 12, weight: 600 }))
  } else {
    parts.push(textLines(lines, node.x + node.w / 2, node.y + headerHeight / 2, { size: 12, weight: 600 }))
  }

  let cursor = node.y + headerHeight + 18
  if (node.fieldRows !== undefined && node.fieldRows.length > 0) {
    for (const row of node.fieldRows) {
      parts.push(lineText(row.leftText ?? fieldLineLeft(row), node.x + 12, cursor, { size: 11, weight: row.key ? 600 : 400 }))
      if ((row.rightText ?? row.type) !== '') parts.push(lineText(row.rightText ?? row.type, node.x + node.w - 12, cursor, { anchor: 'end', size: 10, fill: MUTED }))
      cursor += 22
    }
  }
  if (kind === 'class' && node.methodRows !== undefined && node.methodRows.length > 0) {
    cursor += 2
    parts.push(`<line x1="${num(node.x)}" y1="${num(cursor - 14)}" x2="${num(node.x + node.w)}" y2="${num(cursor - 14)}" stroke="${color}" stroke-width="1" stroke-dasharray="4 4"${paintStyle(undefined, color)}/>`)
    for (const row of node.methodRows) {
      parts.push(lineText(row.leftText ?? fieldLineLeft(row), node.x + 12, cursor, { size: 11 }))
      if ((row.rightText ?? row.type) !== '') parts.push(lineText(row.rightText ?? row.type, node.x + node.w - 12, cursor, { anchor: 'end', size: 10, fill: MUTED }))
      cursor += 22
    }
  }
  return parts.join('')
}

function renderBox(node, options = {}) {
  const color = options.color ?? colorOf(node.type)
  const fill = options.fill ?? '#ffffff'
  const rx = options.rx ?? 8
  const parts = [rect(node.x, node.y, node.w, node.h, { rx, fill, stroke: color, strokeWidth: options.strokeWidth ?? 1.7 })]
  if (options.band === true) {
    parts.push(`<rect x="${num(node.x)}" y="${num(node.y)}" width="5" height="${num(node.h)}" rx="2" fill="${color}" stroke="none"${paintStyle(color, undefined)}/>`)
  }
  const cx = node.x + node.w / 2
  const cy = node.y + node.h / 2
  parts.push(textLines(node.lines ?? [node.label], cx, cy, {}))
  if (options.subtitle !== undefined && options.subtitle !== '') {
    const subtitleLines = wrapText(options.subtitle, Math.max(24, node.w - 18), 1)
    parts.push(lineText(subtitleLines[0] ?? '', cx, node.y + node.h - 10, { anchor: 'middle', size: 10, fill: MUTED }))
  }
  return parts.join('')
}

function renderDatabase(node) {
  const color = colorOf(node.type)
  const cx = node.x + node.w / 2
  const ry = 9
  const path = `M ${num(node.x)} ${num(node.y + ry)} C ${num(node.x)} ${num(node.y - 4)} ${num(node.x + node.w)} ${num(node.y - 4)} ${num(node.x + node.w)} ${num(node.y + ry)} L ${num(node.x + node.w)} ${num(node.y + node.h - ry)} C ${num(node.x + node.w)} ${num(node.y + node.h + 4)} ${num(node.x)} ${num(node.y + node.h + 4)} ${num(node.x)} ${num(node.y + node.h - ry)} Z`
  const parts = [
    `<path d="${path}" fill="#ecfeff" stroke="${color}" stroke-width="1.7"${paintStyle('#ecfeff', color)}/>`,
    `<ellipse cx="${num(cx)}" cy="${num(node.y + ry)}" rx="${num(node.w / 2)}" ry="${num(ry)}" fill="#ffffff" stroke="${color}" stroke-width="1.5"${paintStyle('#ffffff', color)}/>`,
  ]
  parts.push(textLines(node.lines ?? [node.label], cx, node.y + node.h / 2 + 6, { size: 12 }))
  return parts.join('')
}

function renderNode(node, diagramType) {
  const type = node.type
  if (type === 'group') return renderGroup(node)
  if (type === 'note') return renderNote(node)
  if (type === 'initial') {
    return `<circle cx="${num(node.x + node.w / 2)}" cy="${num(node.y + node.h / 2)}" r="${num(node.w / 2)}" fill="#111827" stroke="none"${paintStyle(TYPE_COLORS.initial, undefined)}/>`
  }
  if (type === 'final') {
    const cx = node.x + node.w / 2
    const cy = node.y + node.h / 2
    return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(node.w / 2)}" fill="#ffffff" stroke="#111827" stroke-width="2"${paintStyle('#ffffff', TYPE_COLORS.final)}/><circle cx="${num(cx)}" cy="${num(cy)}" r="${num(node.w / 2 - 6)}" fill="#111827" stroke="none"${paintStyle(TYPE_COLORS.final, undefined)}/>`
  }
  if (type === 'choice') {
    return `${diamond(node.x, node.y, node.w, node.h, { fill: '#fff7ed', stroke: TYPE_COLORS.choice })}${textLines(['◆'], node.x + node.w / 2, node.y + node.h / 2, { size: 14, fill: TYPE_COLORS.choice })}`
  }
  if (type === 'decision') {
    const parts = [diamond(node.x, node.y, node.w, node.h)]
    parts.push(textLines(node.lines ?? [node.label], node.x + node.w / 2, node.y + node.h / 2 - 2, { size: 12 }))
    return parts.join('')
  }
  if (type === 'start' || type === 'end') {
    const fill = type === 'start' ? '#dcfce7' : '#fee2e2'
    return renderBox(node, { color: TYPE_COLORS[type], fill, rx: node.h / 2, strokeWidth: 1.8 })
  }
  if (type === 'actor') return renderActor(node)
  if (type === 'usecase' && diagramType === 'usecase') {
    const parts = [ellipse(node.x, node.y, node.w, node.h, { fill: '#eef2ff', stroke: TYPE_COLORS.usecase })]
    parts.push(textLines(node.lines ?? [node.label], node.x + node.w / 2, node.y + node.h / 2, { size: 12 }))
    return parts.join('')
  }
  if (type === 'system' && diagramType === 'usecase') {
    const parts = [rect(node.x, node.y, node.w, node.h, { rx: 10, fill: '#f8fafc', stroke: TYPE_COLORS.system, strokeWidth: 1.4, dash: true, fillOpacity: 0.7 })]
    parts.push(textLines(node.lines ?? [node.label], node.x + 12, node.y + 18, { anchor: 'start', size: 12, weight: 600 }))
    return parts.join('')
  }
  if (type === 'entity' && diagramType === 'er') return renderStructured(node, 'entity')
  if (type === 'relationship') {
    const parts = [diamond(node.x, node.y, node.w, node.h, { fill: '#fffbeb', stroke: TYPE_COLORS.relationship })]
    parts.push(textLines(node.lines ?? [node.label], node.x + node.w / 2, node.y + node.h / 2, { size: 11 }))
    return parts.join('')
  }
  if (type === 'class' || type === 'interface') return renderStructured(node, 'class')
  if (type === 'database') return renderDatabase(node)
  if (type === 'store') {
    const parts = [renderBox(node, { color: TYPE_COLORS.store, fill: '#faf5ff' })]
    parts.push(`<line x1="${num(node.x + 7)}" y1="${num(node.y + 4)}" x2="${num(node.x + 7)}" y2="${num(node.y + node.h - 4)}" stroke="${TYPE_COLORS.store}" stroke-width="1.2"${paintStyle(undefined, TYPE_COLORS.store)}/>`)
    parts.push(`<line x1="${num(node.x + node.w - 7)}" y1="${num(node.y + 4)}" x2="${num(node.x + node.w - 7)}" y2="${num(node.y + node.h - 4)}" stroke="${TYPE_COLORS.store}" stroke-width="1.2"${paintStyle(undefined, TYPE_COLORS.store)}/>`)
    return parts.join('')
  }
  if (type === 'process' && diagramType === 'dfd') {
    return renderBox(node, { color: TYPE_COLORS.process, fill: '#eff6ff', rx: 18 })
  }
  if (type === 'entity' && diagramType === 'dfd') {
    return renderBox(node, { color: TYPE_COLORS.entity, fill: '#f0fdfa', rx: 4, band: false })
  }
  if (type === 'state') return renderBox(node, { color: TYPE_COLORS.state, fill: '#eff6ff', rx: 16 })
  if (type === 'person') return renderBox(node, { color: TYPE_COLORS.person, fill: '#f5f3ff', rx: 24 })
  if (type === 'external') return renderBox(node, { color: TYPE_COLORS.external, fill: '#f8fafc', rx: 8, strokeWidth: 1.4 })
  if (type === 'component' || type === 'container' || type === 'module') {
    const subtitle = node.technology !== '' ? node.technology : (node.description !== '' ? node.description : '')
    return renderBox(node, { color: colorOf(type), fill: type === 'component' ? '#ecfeff' : '#f0fdfa', rx: 8, subtitle })
  }
  return renderBox(node, { color: colorOf(type), fill: '#ffffff', rx: 8 })
}

// --- edge rendering ---------------------------------------------------------

const ROUTE_MARGIN = 6

function obstacleRects(nodes, exclude) {
  const result = []
  for (const node of nodes.values()) {
    if (node.type === 'group') continue
    if (exclude.has(node.id)) continue
    result.push({
      x: node.x - ROUTE_MARGIN,
      y: node.y - ROUTE_MARGIN,
      w: node.w + ROUTE_MARGIN * 2,
      h: node.h + ROUTE_MARGIN * 2,
    })
  }
  return result
}

function pointInsideRect(x, y, rect) {
  return x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h
}

function horizontalHits(x1, x2, y, rect) {
  if (y <= rect.y || y >= rect.y + rect.h) return false
  const left = Math.min(x1, x2)
  const right = Math.max(x1, x2)
  return right > rect.x && left < rect.x + rect.w
}

function verticalHits(x, y1, y2, rect) {
  if (x <= rect.x || x >= rect.x + rect.w) return false
  const top = Math.min(y1, y2)
  const bottom = Math.max(y1, y2)
  return bottom > rect.y && top < rect.y + rect.h
}

function routeStats(points, obstacles) {
  let intersections = 0
  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index - 1]
    const [x2, y2] = points[index]
    length += Math.abs(x2 - x1) + Math.abs(y2 - y1)
    for (const rect of obstacles) {
      if (y1 === y2 ? horizontalHits(x1, x2, y1, rect) : verticalHits(x1, y1, y2, rect)) {
        intersections += 1
      }
    }
  }
  return { intersections, length, bends: Math.max(0, points.length - 2) }
}

function simplifyPath(points) {
  const result = []
  for (const point of points) {
    const [x, y] = point
    const last = result[result.length - 1]
    if (last !== undefined && Math.abs(last[0] - x) < 0.01 && Math.abs(last[1] - y) < 0.01) continue
    const before = result[result.length - 2]
    if (before !== undefined) {
      const sameX = Math.abs(before[0] - last[0]) < 0.01 && Math.abs(last[0] - x) < 0.01
      const sameY = Math.abs(before[1] - last[1]) < 0.01 && Math.abs(last[1] - y) < 0.01
      if (sameX || sameY) result.pop()
    }
    result.push([x, y])
  }
  return result
}

function anchorPair(from, to) {
  const fcx = from.x + from.w / 2
  const fcy = from.y + from.h / 2
  const tcx = to.x + to.w / 2
  const tcy = to.y + to.h / 2
  const dx = tcx - fcx
  const dy = tcy - fcy
  if (Math.abs(dx) >= Math.abs(dy) * 0.7) {
    const rightward = dx >= 0
    return {
      axis: 'h',
      x1: rightward ? from.x + from.w : from.x,
      y1: clamp(fcy, from.y + 6, from.y + from.h - 6),
      x2: rightward ? to.x : to.x + to.w,
      y2: clamp(tcy, to.y + 6, to.y + to.h - 6),
    }
  }
  const downward = dy >= 0
  return {
    axis: 'v',
    x1: clamp(fcx, from.x + 6, from.x + from.w - 6),
    y1: downward ? from.y + from.h : from.y,
    x2: clamp(tcx, to.x + 6, to.x + to.w - 6),
    y2: downward ? to.y : to.y + to.h,
  }
}

function freeChannelX(preferred, yStart, yEnd, obstacles) {
  const top = Math.min(yStart, yEnd)
  const bottom = Math.max(yStart, yEnd)
  const candidates = [preferred]
  for (let step = 1; step <= 8; step += 1) {
    candidates.push(preferred + step * 14, preferred - step * 14)
  }
  for (const rect of obstacles) {
    candidates.push(rect.x - 2, rect.x + rect.w + 2)
  }
  const unique = [...new Set(candidates.map(value => Math.round(value * 10) / 10))]
  unique.sort((left, right) => Math.abs(left - preferred) - Math.abs(right - preferred) || left - right)
  for (const x of unique) {
    let blocked = false
    for (const rect of obstacles) {
      if (verticalHits(x, top, bottom, rect)) {
        blocked = true
        break
      }
    }
    if (!blocked) return x
  }
  return preferred
}

function freeChannelY(preferred, xStart, xEnd, obstacles) {
  const left = Math.min(xStart, xEnd)
  const right = Math.max(xStart, xEnd)
  const candidates = [preferred]
  for (let step = 1; step <= 8; step += 1) {
    candidates.push(preferred + step * 14, preferred - step * 14)
  }
  for (const rect of obstacles) {
    candidates.push(rect.y - 2, rect.y + rect.h + 2)
  }
  const unique = [...new Set(candidates.map(value => Math.round(value * 10) / 10))]
  unique.sort((left, right) => Math.abs(left - preferred) - Math.abs(right - preferred) || left - right)
  for (const y of unique) {
    let blocked = false
    for (const rect of obstacles) {
      if (horizontalHits(left, right, y, rect)) {
        blocked = true
        break
      }
    }
    if (!blocked) return y
  }
  return preferred
}

function boundingBox(obstacles) {
  if (obstacles.length === 0) return { left: SVG_PAD, top: SVG_PAD, right: SVG_PAD * 2, bottom: SVG_PAD * 2 }
  return {
    left: Math.min(...obstacles.map(rect => rect.x)),
    top: Math.min(...obstacles.map(rect => rect.y)),
    right: Math.max(...obstacles.map(rect => rect.x + rect.w)),
    bottom: Math.max(...obstacles.map(rect => rect.y + rect.h)),
  }
}

function routeCandidates(anchor, obstacles, canvas) {
  const candidates = []
  const add = points => {
    const simplified = simplifyPath(points)
    if (simplified.length >= 2) candidates.push(simplified)
  }
  const box = boundingBox(obstacles)
  const edge = 8

  if (anchor.axis === 'h') {
    const midpoint = (anchor.x1 + anchor.x2) / 2
    const quarter = anchor.x1 + (anchor.x2 - anchor.x1) * 0.25
    const threeQuarter = anchor.x1 + (anchor.x2 - anchor.x1) * 0.75
    for (const preferred of [midpoint, quarter, threeQuarter]) {
      const channel = freeChannelX(preferred, anchor.y1, anchor.y2, obstacles)
      add([[anchor.x1, anchor.y1], [channel, anchor.y1], [channel, anchor.y2], [anchor.x2, anchor.y2]])
    }
    // Simple L shapes are compact when only one bend is needed.
    add([[anchor.x1, anchor.y1], [anchor.x2, anchor.y1], [anchor.x2, anchor.y2]])
    add([[anchor.x1, anchor.y1], [anchor.x1, anchor.y2], [anchor.x2, anchor.y2]])
    // Obstacle-free bypass lanes above/below every node. These are longer, so
    // they only win when the Z/L candidates would cross a node.
    const top = Math.max(edge, box.top - 18)
    const bottom = Math.min(canvas.height - edge, box.bottom + 18)
    for (const lane of [top, bottom]) {
      const channel = freeChannelX(midpoint, Math.min(anchor.y1, lane), Math.max(anchor.y1, lane), obstacles)
      add([[anchor.x1, anchor.y1], [channel, anchor.y1], [channel, lane], [anchor.x2, lane], [anchor.x2, anchor.y2]])
      add([[anchor.x1, anchor.y1], [anchor.x1, lane], [anchor.x2, lane], [anchor.x2, anchor.y2]])
    }
  } else {
    const midpoint = (anchor.y1 + anchor.y2) / 2
    const quarter = anchor.y1 + (anchor.y2 - anchor.y1) * 0.25
    const threeQuarter = anchor.y1 + (anchor.y2 - anchor.y1) * 0.75
    for (const preferred of [midpoint, quarter, threeQuarter]) {
      const channel = freeChannelY(preferred, anchor.x1, anchor.x2, obstacles)
      add([[anchor.x1, anchor.y1], [anchor.x1, channel], [anchor.x2, channel], [anchor.x2, anchor.y2]])
    }
    add([[anchor.x1, anchor.y1], [anchor.x2, anchor.y1], [anchor.x2, anchor.y2]])
    add([[anchor.x1, anchor.y1], [anchor.x1, anchor.y2], [anchor.x2, anchor.y2]])
    const left = Math.max(edge, box.left - 18)
    const right = Math.min(canvas.width - edge, box.right + 18)
    for (const lane of [left, right]) {
      const channel = freeChannelY(midpoint, Math.min(anchor.x1, lane), Math.max(anchor.x1, lane), obstacles)
      add([[anchor.x1, anchor.y1], [anchor.x1, channel], [lane, channel], [lane, anchor.y2], [anchor.x2, anchor.y2]])
      add([[anchor.x1, anchor.y1], [lane, anchor.y1], [lane, anchor.y2], [anchor.x2, anchor.y2]])
    }
  }
  return candidates
}

function chooseRoute(from, to, nodes, canvas) {
  const anchor = anchorPair(from, to)
  const obstacles = obstacleRects(nodes, new Set([from.id, to.id]))
  const candidates = routeCandidates(anchor, obstacles, canvas)
  let best = null
  for (const points of candidates) {
    const stats = routeStats(points, obstacles)
    const score = stats.intersections * 10000 + stats.bends * 16 + stats.length * 0.05
    if (best === null || score < best.score - 0.001) best = { points, stats, score }
  }
  if (best !== null && best.stats.intersections === 0) {
    return { points: best.points, kind: 'orthogonal' }
  }
  // Fallback: a straight line is preferable to a polyline that would cross a
  // card twice. It is deterministic and keeps the arrow/label semantics.
  return { points: [[anchor.x1, anchor.y1], [anchor.x2, anchor.y2]], kind: 'straight' }
}

function edgeDash(kind) {
  return kind === 'dashed' || kind === 'depends' || kind === 'async' || kind === 'return'
    ? ' stroke-dasharray="7 5"'
    : ''
}

function pathData(points) {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${num(x)} ${num(y)}`).join(' ')
}

function labelAnchor(points) {
  let best = null
  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index - 1]
    const [x2, y2] = points[index]
    const length = Math.abs(x2 - x1) + Math.abs(y2 - y1)
    if (best === null || length > best.length) best = { x1, y1, x2, y2, length }
  }
  if (best === null) return { x: points[0]?.[0] ?? 0, y: points[0]?.[1] ?? 0, horizontal: true }
  const horizontal = best.y1 === best.y2
  const x = (best.x1 + best.x2) / 2
  const y = (best.y1 + best.y2) / 2
  return { x, y, horizontal }
}

function endAnchor(points) {
  const last = points[points.length - 1]
  const before = points[points.length - 2] ?? last
  return { x: (last[0] + before[0]) / 2, y: (last[1] + before[1]) / 2, horizontal: last[1] === before[1] }
}

function edgeLabel(label, x, y, options = {}) {
  if (label === '') return ''
  const maxWidth = options.maxWidth ?? 170
  const lines = wrapText(label, maxWidth, options.maxLines ?? 2)
  const size = options.size ?? 11
  const lh = Math.max(LINE_HEIGHT, size + 4)
  const width = Math.min(maxWidth, widestOf(lines)) + 14
  const height = lines.length * lh + 8
  let cx = x
  let cy = y
  if (Number.isFinite(options.canvasWidth)) {
    cx = clamp(cx, width / 2 + 3, Math.max(width / 2 + 3, options.canvasWidth - width / 2 - 3))
  }
  if (Number.isFinite(options.canvasHeight)) {
    cy = clamp(cy, height / 2 + 3, Math.max(height / 2 + 3, options.canvasHeight - height / 2 - 3))
  }
  return `<g class="edge-label"><rect x="${num(cx - width / 2)}" y="${num(cy - height / 2)}" width="${num(width)}" height="${num(height)}" rx="4" fill="#ffffff" fill-opacity="0.93" stroke="#e2e8f0" stroke-width="1"${paintStyle('#ffffff', '#e2e8f0')}/>${textLines(lines, cx, cy, { size, lh, fill: MUTED })}</g>`
}

function renderEdge(edge, nodes, marker, canvas) {
  const from = nodes.get(edge.from)
  const to = nodes.get(edge.to)
  if (from === undefined || to === undefined) return ''
  const arrow = ` marker-end="url(#${esc(marker)})"`
  const dash = edgeDash(edge.kind)
  const parts = [`<g class="edge" data-edge="${esc(edge.id)}">`]

  if (edge.from === edge.to) {
    const x = from.x + from.w
    const y = from.y + from.h / 2
    parts.push(`<g data-routing="curve"><path d="M ${num(x)} ${num(y - 12)} C ${num(x + 54)} ${num(y - 30)} ${num(x + 54)} ${num(y + 30)} ${num(x)} ${num(y + 12)}" fill="none" stroke="${EDGE}" stroke-width="1.5"${dash}${arrow}${paintStyle(undefined, EDGE)}/></g>`)
    if (edge.label !== '') parts.push(edgeLabel(edge.label, x + 58, y - 20, { canvasWidth: canvas?.width, canvasHeight: canvas?.height }))
    parts.push('</g>')
    return parts.join('')
  }

  const route = chooseRoute(from, to, nodes, canvas ?? { width: 1000, height: 800 })
  const points = route.points
  parts.push(`<g data-routing="${route.kind}"><path d="${pathData(points)}" fill="none" stroke="${EDGE}" stroke-width="1.5" stroke-linejoin="round"${dash}${arrow}${paintStyle(undefined, EDGE)}/></g>`)

  const labelPoint = labelAnchor(points)
  const cardinalityPoint = endAnchor(points)
  if (edge.cardinality !== '') {
    const x = cardinalityPoint.horizontal ? cardinalityPoint.x : cardinalityPoint.x + 14
    const y = cardinalityPoint.horizontal ? cardinalityPoint.y + 14 : cardinalityPoint.y
    parts.push(edgeLabel(edge.cardinality, x, y, { maxWidth: 96, maxLines: 1, size: 10, canvasWidth: canvas?.width, canvasHeight: canvas?.height }))
  }
  if (edge.label !== '') {
    const x = labelPoint.horizontal ? labelPoint.x : labelPoint.x + 14
    const y = labelPoint.horizontal ? labelPoint.y - 10 : labelPoint.y
    parts.push(edgeLabel(edge.label, x, y, { canvasWidth: canvas?.width, canvasHeight: canvas?.height }))
  }
  parts.push('</g>')
  return parts.join('')
}

// --- sequence layout --------------------------------------------------------

function renderSequence(nodes, edges, key, title, theme) {
  const participants = [...nodes].sort((a, b) => a.index - b.index)
  if (participants.length === 0) return emptyState(key, title, '（空图）', theme)

  const headerHeight = 46
  const ordered = [...edges].sort((a, b) => {
    const left = a.order === undefined ? Number.MAX_SAFE_INTEGER : a.order
    const right = b.order === undefined ? Number.MAX_SAFE_INTEGER : b.order
    return left - right || a.index - b.index
  })
  const titleLines = participants.map(node => {
    const lines = wrapText(node.label, 180, 2)
    return { node, lines, width: clamp(widestOf(lines) + 32, 150, 260) }
  })
  const gap = clamp(36 + titleLines.reduce((sum, entry) => sum + entry.width, 0) / Math.max(1, titleLines.length) * 0.08, 44, 72)
  const totalWidth = SVG_PAD * 2 + titleLines.reduce((sum, entry) => sum + entry.width, 0) + gap * Math.max(0, titleLines.length - 1)

  // Each message row is sized by its own wrapped label, so a two-line message
  // gets more vertical room than a one-word arrow instead of colliding.
  const rows = ordered.map(edge => {
    const labelLines = edge.label === '' ? [] : wrapText(edge.label, 170, 2)
    return {
      edge,
      labelLines,
      height: Math.max(42, 26 + labelLines.length * 15 + (edge.from === edge.to ? 10 : 0)),
    }
  })
  const bodyHeight = rows.reduce((sum, row) => sum + row.height, 0)
  const height = SVG_PAD * 2 + headerHeight + 36 + bodyHeight + 8
  const xById = new Map()
  let cursor = SVG_PAD
  for (const entry of titleLines) {
    xById.set(entry.node.id, cursor + entry.width / 2)
    cursor += entry.width + gap
  }

  const parts = [`<rect x="0" y="0" width="${num(totalWidth)}" height="${num(height)}" fill="#ffffff"${paintStyle('#ffffff', undefined)}/>`]
  for (const entry of titleLines) {
    const cx = xById.get(entry.node.id)
    const color = entry.node.type === 'actor' ? TYPE_COLORS.actor : TYPE_COLORS.participant
    const fill = entry.node.type === 'actor' ? '#f5f3ff' : '#eef2ff'
    parts.push(rect(cx - entry.width / 2, SVG_PAD, entry.width, headerHeight, { rx: 7, fill, stroke: color, strokeWidth: 1.7 }))
    parts.push(textLines(entry.lines, cx, SVG_PAD + headerHeight / 2, { size: 12, weight: 600 }))
    parts.push(`<line x1="${num(cx)}" y1="${num(SVG_PAD + headerHeight)}" x2="${num(cx)}" y2="${num(height - SVG_PAD)}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 5"${paintStyle(undefined, '#94a3b8')}/>`)
  }

  const marker = markerIdentifier(key)
  let y = SVG_PAD + headerHeight + 36
  rows.forEach((row, index) => {
    const { edge, labelLines, height: rowHeight } = row
    const fromX = xById.get(edge.from)
    const toX = xById.get(edge.to)
    const centerY = y + Math.max(16, rowHeight / 2 - labelLines.length * 5)
    y += rowHeight
    if (fromX === undefined || toX === undefined) return
    const arrow = ` marker-end="url(#${esc(marker)})"`
    const dash = edgeDash(edge.kind)
    parts.push(`<g class="sequence-message" data-order="${num(index + 1)}">`)
    if (edge.from === edge.to) {
      parts.push(`<path d="M ${num(fromX)} ${num(centerY - 12)} C ${num(fromX + 46)} ${num(centerY - 26)} ${num(fromX + 46)} ${num(centerY + 26)} ${num(fromX)} ${num(centerY + 12)}" fill="none" stroke="${EDGE}" stroke-width="1.5"${dash}${arrow}${paintStyle(undefined, EDGE)}/>`)
      if (labelLines.length > 0) parts.push(edgeLabel(edge.label, fromX + 52, centerY - 22, { canvasWidth: totalWidth, canvasHeight: height }))
    } else {
      parts.push(`<line x1="${num(fromX)}" y1="${num(centerY)}" x2="${num(toX)}" y2="${num(centerY)}" stroke="${EDGE}" stroke-width="1.5"${dash}${arrow}${paintStyle(undefined, EDGE)}/>`)
      if (labelLines.length > 0) parts.push(edgeLabel(edge.label, (fromX + toX) / 2, centerY - 10 - (labelLines.length - 1) * 7, { canvasWidth: totalWidth, canvasHeight: height }))
    }
    parts.push('</g>')
  })

  return svgDocument(title, totalWidth, height, parts.join(''), key, true, theme)
}

// --- document shell ---------------------------------------------------------

function svgDocument(title, width, height, body, key, hasEdges, theme) {
  const w = Math.max(320, Math.ceil(width))
  const h = Math.max(180, Math.ceil(height))
  const marker = markerIdentifier(key)
  const effectiveTheme = theme === 'light' || theme === 'dark' ? theme : ''
  const themeAttribute = effectiveTheme === '' ? '' : ` data-theme="${effectiveTheme}"`
  const defs = hasEdges
    ? `<defs><marker id="${esc(marker)}" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="10" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,4 L0,8 z" fill="${EDGE}"${paintStyle(EDGE, undefined)}/></marker></defs>`
    : ''
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}" data-diagram="${esc(key)}"${themeAttribute} class="diagram-svg"><title>${esc(title)}</title>${themeStyle(effectiveTheme)}<rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff"${paintStyle('#ffffff', undefined)}/>${defs}${body}</svg>`
}

function emptyState(key, title, message, theme) {
  const width = 420
  const height = 180
  const body = `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="14" fill="${MUTED}" font-family="${FONT_FAMILY}"${paintStyle(MUTED, undefined)}>${esc(message)}</text>`
  return svgDocument(title, width, height, body, key, false, theme)
}

// --- public entry point -----------------------------------------------------

function nodeGroupOpen(node) {
  const slug = node.type.replace(/[^a-z0-9_-]+/gu, '-').replace(/^-+|-+$/gu, '') || 'node'
  return `<g class="node node-type-${esc(slug)}" data-node-id="${esc(node.id)}" data-node-type="${esc(node.type)}" data-node-x="${num(node.x)}" data-node-y="${num(node.y)}" data-node-w="${num(node.w)}" data-node-h="${num(node.h)}">`
}

function renderDiagram(source, options) {
  const diagramType = diagramTypeOf(source)
  const key = clean(source?.key) || diagramType || 'diagram'
  const title = clean(source?.title) || diagramType || '图解'
  const theme = themeOf(options)
  const maxNodes = Number.isInteger(options.maxNodes) && options.maxNodes > 0 ? options.maxNodes : SVG_MAX_NODES
  const rawNodes = list(source?.nodes).filter(node => object(node) !== undefined)
  const truncated = rawNodes.length > maxNodes
  const usedIds = new Set()
  const nodes = rawNodes.slice(0, maxNodes).map((node, index) => modelNode(node, index, usedIds))
  const ids = new Set(nodes.map(node => node.id))
  const rawEdges = list(source?.edges).filter(node => object(node) !== undefined)
  const edges = rawEdges.map((edge, index) => modelEdge(edge, index, ids)).filter(edge => edge !== undefined)

  if (!SUPPORTED_TYPES.has(diagramType)) {
    return emptyState(key, title, `不支持的图解类型：${diagramType || '（空）'}`, theme)
  }
  if (nodes.length === 0) {
    return emptyState(key, title, '（空图）', theme)
  }

  if (diagramType === 'sequence') {
    return renderSequence(nodes, edges, key, title, theme)
  }

  const notes = nodes.filter(node => node.type === 'note')
  const layout = buildUnits(nodes, diagramType, edges)
  const bounds = layoutUnits(layout.units, layout.edgesByUnit)

  // Notes are laid out in a strip below the main diagram so they never overlap
  // structural nodes. They are included in the final bounds.
  let maxX = bounds.width
  let maxY = bounds.height
  let noteX = SVG_PAD
  let noteY = bounds.height + 6
  let rowHeight = 0
  const noteGapX = clamp(36 + Math.min(40, bounds.width * 0.01), MIN_GAP_X, 76)
  const noteGapY = clamp(24 + Math.min(32, bounds.height * 0.02), MIN_GAP_Y, 56)
  const noteLimit = Math.max(640, bounds.width)
  for (const note of notes) {
    measureNode(note, diagramType)
    if (noteX + note.w + SVG_PAD > noteLimit && noteX > SVG_PAD) {
      noteX = SVG_PAD
      noteY += rowHeight + noteGapY
      rowHeight = 0
    }
    note.x = noteX
    note.y = noteY
    noteX += note.w + noteGapX
    rowHeight = Math.max(rowHeight, note.h)
    maxX = Math.max(maxX, note.x + note.w + SVG_PAD)
    maxY = Math.max(maxY, note.y + note.h + SVG_PAD)
  }

  let width = Math.max(320, Math.ceil(maxX))
  let height = Math.max(180, Math.ceil(maxY))
  const marker = markerIdentifier(key)

  const allNodes = nodes.filter(node => node.type !== 'note')
  const groupNodes = allNodes.filter(node => node.type === 'group')
  const nodeMap = new Map(nodes.map(node => [node.id, node]))

  const parts = []
  // 1. Group backgrounds, so edges stay visible inside a dashed container.
  for (const group of groupNodes) parts.push(`${nodeGroupOpen(group)}${renderGroup(group)}</g>`)
  // 2. Edges behind nodes.
  const edgeParts = []
  for (const edge of edges) {
    const rendered = renderEdge(edge, nodeMap, marker, { width, height })
    if (rendered !== '') edgeParts.push(rendered)
  }
  parts.push(...edgeParts)
  // 3. Nodes (group labels were drawn with the background; re-draw only titles).
  for (const node of allNodes) {
    if (node.type === 'group') {
      parts.push(textLines(node.lines ?? wrapText(node.label, 200, 1), node.x + 14, node.y + 17, { anchor: 'start', size: 12, weight: 600, fill: TYPE_COLORS.group }))
      continue
    }
    parts.push(`${nodeGroupOpen(node)}${renderNode(node, diagramType)}</g>`)
  }
  // 4. Notes.
  for (const note of notes) parts.push(`${nodeGroupOpen(note)}${renderNote(note)}</g>`)

  if (truncated) {
    const hidden = rawNodes.length - maxNodes
    const message = `已省略 ${hidden} 个节点（上限 ${maxNodes}）`
    height += 28
    parts.push(lineText(message, width / 2, height - 14, { anchor: 'middle', size: 11, fill: MUTED }))
  }

  return svgDocument(title, width, height, parts.join(''), key, edges.length > 0, theme)
}

export function renderDiagramSvg(diagram, options = {}) {
  const source = object(diagram)
  try {
    return renderDiagram(source ?? {}, object(options) ?? {})
  } catch {
    const key = clean(source?.key) || clean(source?.type) || 'diagram'
    const title = clean(source?.title) || '图解'
    return emptyState(key, title, '（渲染失败）', themeOf(options))
  }
}
