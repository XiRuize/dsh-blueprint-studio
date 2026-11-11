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
const GAP_X = 52
const GAP_Y = 30
const INNER = 16
const FONT_SIZE = 13
const LINE_HEIGHT = 17
const INK = '#1f2430'
const MUTED = '#5f6878'
const EDGE = '#64748b'
const FONT_FAMILY = '-apple-system, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif'

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

function ascWidth(value) {
  let width = 0
  for (const char of String(value ?? '')) {
    const code = char.codePointAt(0)
    width += code < 128 ? 7 : 13
  }
  return width
}

// Character-aware wrap with an optional hard line limit and ellipsis. This is
// used for every label so node dimensions never depend on a browser font.
function wrapText(value, maxChars = 16, maxLines = 3) {
  const normalized = clean(value).replace(/\s+/gu, ' ').trim()
  if (normalized === '') return ['']
  const lines = []
  let line = ''
  for (const char of normalized) {
    if (char === ' ') {
      if (line !== '' && line.length < maxChars) {
        line += ' '
        continue
      }
      if (line.trim() !== '') lines.push(line.trimEnd())
      line = ''
      continue
    }
    if ([...line].length >= maxChars) {
      lines.push(line.trimEnd())
      line = ''
    }
    line += char
  }
  if (line.trim() !== '') lines.push(line.trimEnd())
  if (lines.length === 0) return ['']
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    const last = kept[kept.length - 1]
    kept[kept.length - 1] = `${[...last].slice(0, Math.max(1, maxChars - 1)).join('')}…`
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
  return lines.map((line, index) => {
    const y = start + index * lh + size * 0.36
    return `<text x="${num(cx)}" y="${num(y)}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="${FONT_FAMILY}">${esc(line)}</text>`
  }).join('')
}

function lineText(value, x, y, options = {}) {
  const anchor = options.anchor ?? 'start'
  const size = options.size ?? 12
  const fill = options.fill ?? INK
  const weight = options.weight ?? 400
  return `<text x="${num(x)}" y="${num(y)}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}" font-family="${FONT_FAMILY}">${esc(value)}</text>`
}

function rect(x, y, w, h, options = {}) {
  const rx = options.rx ?? 8
  const fill = options.fill ?? '#ffffff'
  const stroke = options.stroke ?? '#94a3b8'
  const width = options.strokeWidth ?? 1.6
  const dash = options.dash === true ? ' stroke-dasharray="7 5"' : ''
  const opacity = options.fillOpacity === undefined ? '' : ` fill-opacity="${num(options.fillOpacity)}"`
  return `<rect x="${num(x)}" y="${num(y)}" width="${num(Math.max(1, w))}" height="${num(Math.max(1, h))}" rx="${num(rx)}" fill="${fill}"${opacity} stroke="${stroke}" stroke-width="${num(width)}"${dash}/>`
}

function diamond(x, y, w, h, options = {}) {
  const cx = x + w / 2
  const cy = y + h / 2
  const points = `${num(cx)},${num(y)} ${num(x + w)},${num(cy)} ${num(cx)},${num(y + h)} ${num(x)},${num(cy)}`
  return `<polygon points="${points}" fill="${options.fill ?? '#fef3c7'}" stroke="${options.stroke ?? TYPE_COLORS.decision}" stroke-width="${num(options.strokeWidth ?? 1.6)}"/>`
}

function ellipse(x, y, w, h, options = {}) {
  return `<ellipse cx="${num(x + w / 2)}" cy="${num(y + h / 2)}" rx="${num(w / 2)}" ry="${num(h / 2)}" fill="${options.fill ?? '#ffffff'}" stroke="${options.stroke ?? '#94a3b8'}" stroke-width="${num(options.strokeWidth ?? 1.6)}"/>`
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

function measureNode(node, diagramType) {
  const type = node.type
  const lines = wrapText(node.label, type === 'decision' ? 18 : 18, type === 'decision' ? 2 : 3)
  node.lines = lines

  if (type === 'initial') {
    node.w = 28
    node.h = 28
    return
  }
  if (type === 'final') {
    node.w = 36
    node.h = 36
    return
  }
  if (type === 'choice') {
    node.w = 70
    node.h = 70
    return
  }
  if (type === 'decision') {
    node.w = clamp(ascWidth(lines.reduce((a, b) => (ascWidth(a) >= ascWidth(b) ? a : b), '')) + 72, 160, 300)
    node.h = Math.max(86, lines.length * LINE_HEIGHT + 48)
    return
  }
  if (type === 'actor') {
    node.w = Math.max(110, ascWidth(lines.reduce((a, b) => (ascWidth(a) >= ascWidth(b) ? a : b), '')) + 24)
    node.h = 78 + lines.length * LINE_HEIGHT + 8
    return
  }
  if (type === 'usecase' && diagramType === 'usecase') {
    node.w = clamp(ascWidth(lines.reduce((a, b) => (ascWidth(a) >= ascWidth(b) ? a : b), '')) + 54, 130, 280)
    node.h = Math.max(60, lines.length * LINE_HEIGHT + 30)
    return
  }
  if (type === 'system' && diagramType === 'usecase') {
    node.w = Math.max(200, ascWidth(lines[0] ?? '') + 40)
    node.h = 120
    return
  }
  if (type === 'entity' && diagramType === 'er') {
    measureEntity(node, lines)
    return
  }
  if (type === 'class' || type === 'interface') {
    measureClass(node, lines)
    return
  }
  if (type === 'note') {
    node.w = clamp(ascWidth(lines.reduce((a, b) => (ascWidth(a) >= ascWidth(b) ? a : b), '')) + 30, 150, 280)
    node.h = Math.max(46, lines.length * LINE_HEIGHT + 26)
    return
  }
  if (type === 'database') {
    node.w = clamp(ascWidth(lines.reduce((a, b) => (ascWidth(a) >= ascWidth(b) ? a : b), '')) + 56, 150, 260)
    node.h = Math.max(70, lines.length * LINE_HEIGHT + 50)
    return
  }
  if (type === 'relationship') {
    node.w = clamp(ascWidth(lines.reduce((a, b) => (ascWidth(a) >= ascWidth(b) ? a : b), '')) + 64, 130, 240)
    node.h = Math.max(66, lines.length * LINE_HEIGHT + 34)
    return
  }
  const widest = lines.reduce((a, b) => (ascWidth(a) >= ascWidth(b) ? a : b), '')
  node.w = clamp(ascWidth(widest) + 34, 120, 280)
  node.h = Math.max(46, lines.length * LINE_HEIGHT + 24)
}

function measureEntity(node, lines) {
  const fields = node.fields.filter(field => field.kind !== 'method')
  node.fieldRows = fields
  let widest = ascWidth(lines.reduce((a, b) => (ascWidth(a) >= ascWidth(b) ? a : b), ''))
  for (const field of fields) {
    widest = Math.max(widest, ascWidth(fieldLineLeft(field)) + ascWidth(field.type) + 34)
  }
  node.w = clamp(widest + 30, 160, 320)
  node.h = 14 + lines.length * 18 + 8 + (fields.length === 0 ? 10 : fields.length * 22 + 8)
}

function measureClass(node, lines) {
  const fields = node.fields.filter(field => field.kind !== 'method')
  const methods = node.fields.filter(field => field.kind === 'method')
  node.fieldRows = fields
  node.methodRows = methods
  let widest = ascWidth(lines.reduce((a, b) => (ascWidth(a) >= ascWidth(b) ? a : b), ''))
  for (const row of [...fields, ...methods]) {
    widest = Math.max(widest, ascWidth(fieldLineLeft(row)) + ascWidth(row.type) + 34)
  }
  node.w = clamp(widest + 30, 160, 340)
  let height = 14 + lines.length * 18 + 8
  if (fields.length > 0) height += 8 + fields.length * 22
  if (methods.length > 0) height += 9 + methods.length * 22
  node.h = Math.max(60, height)
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
      node.lines = wrapText(node.label, 20, 1)
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

function layoutUnits(units, edgesByUnit) {
  if (units.length === 0) return { width: SVG_PAD * 2, height: SVG_PAD * 2 }

  if (edgesByUnit.length === 0) {
    const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(units.length))))
    const rows = Math.ceil(units.length / columns)
    const columnWidths = new Array(columns).fill(0)
    const rowHeights = new Array(rows).fill(0)
    for (let index = 0; index < units.length; index += 1) {
      const column = index % columns
      const row = Math.floor(index / columns)
      columnWidths[column] = Math.max(columnWidths[column], units[index].w + GAP_X)
      rowHeights[row] = Math.max(rowHeights[row], units[index].h + GAP_Y)
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
    return { width: SVG_PAD + columnWidths.reduce((a, b) => a + b, 0), height: SVG_PAD + rowHeights.reduce((a, b) => a + b, 0) }
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
  const columnWidths = keys.map(key => Math.max(...columns.get(key).map(unit => unit.w)) + GAP_X)
  const columnHeights = keys.map(key => {
    const items = columns.get(key)
    return items.reduce((sum, unit) => sum + unit.h, 0) + GAP_Y * Math.max(0, items.length - 1)
  })
  const totalHeight = Math.max(...columnHeights, 0)

  let x = SVG_PAD
  let maxX = SVG_PAD
  for (let index = 0; index < keys.length; index += 1) {
    const items = columns.get(keys[index])
    let y = SVG_PAD + Math.max(0, (totalHeight - columnHeights[index]) / 2)
    for (const unit of items) {
      placeUnit(unit, x + (columnWidths[index] - GAP_X - unit.w) / 2, y)
      y += unit.h + GAP_Y
      maxX = Math.max(maxX, unit.x + unit.w)
    }
    x += columnWidths[index]
  }
  return { width: maxX + SVG_PAD, height: totalHeight + SVG_PAD * 2 }
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
    `<path d="${path}" fill="#fef9c3" stroke="${TYPE_COLORS.note}" stroke-width="1.4"/>`,
    `<path d="M ${num(node.x + node.w - fold)} ${num(node.y)} L ${num(node.x + node.w - fold)} ${num(node.y + fold)} L ${num(node.x + node.w)} ${num(node.y + fold)}" fill="none" stroke="${TYPE_COLORS.note}" stroke-width="1.2"/>`,
  ]
  const centerY = node.y + node.h / 2 + 4
  parts.push(textLines(node.lines ?? wrapText(node.label, 18, 3), node.x + node.w / 2, centerY, { size: 12 }))
  return parts.join('')
}

function renderActor(node) {
  const cx = node.x + node.w / 2
  const top = node.y + 4
  const color = TYPE_COLORS.actor
  const parts = [
    `<circle cx="${num(cx)}" cy="${num(top + 12)}" r="9" fill="#ffffff" stroke="${color}" stroke-width="1.8"/>`,
    `<line x1="${num(cx)}" y1="${num(top + 21)}" x2="${num(cx)}" y2="${num(top + 46)}" stroke="${color}" stroke-width="1.8"/>`,
    `<line x1="${num(cx - 16)}" y1="${num(top + 31)}" x2="${num(cx + 16)}" y2="${num(top + 31)}" stroke="${color}" stroke-width="1.8"/>`,
    `<line x1="${num(cx)}" y1="${num(top + 46)}" x2="${num(cx - 14)}" y2="${num(top + 64)}" stroke="${color}" stroke-width="1.8"/>`,
    `<line x1="${num(cx)}" y1="${num(top + 46)}" x2="${num(cx + 14)}" y2="${num(top + 64)}" stroke="${color}" stroke-width="1.8"/>`,
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
  parts.push(`<rect x="${num(node.x)}" y="${num(node.y)}" width="${num(node.w)}" height="${num(headerHeight)}" rx="6" fill="${kind === 'class' ? '#fffbeb' : '#f0fdfa'}" fill-opacity="0.85" stroke="none"/>`)
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
      parts.push(lineText(fieldLineLeft(row), node.x + 12, cursor, { size: 11, weight: row.key ? 600 : 400 }))
      if (row.type !== '') parts.push(lineText(row.type, node.x + node.w - 12, cursor, { anchor: 'end', size: 10, fill: MUTED }))
      cursor += 22
    }
  }
  if (kind === 'class' && node.methodRows !== undefined && node.methodRows.length > 0) {
    cursor += 2
    parts.push(`<line x1="${num(node.x)}" y1="${num(cursor - 14)}" x2="${num(node.x + node.w)}" y2="${num(cursor - 14)}" stroke="${color}" stroke-width="1" stroke-dasharray="4 4"/>`)
    for (const row of node.methodRows) {
      parts.push(lineText(fieldLineLeft(row), node.x + 12, cursor, { size: 11 }))
      if (row.type !== '') parts.push(lineText(row.type, node.x + node.w - 12, cursor, { anchor: 'end', size: 10, fill: MUTED }))
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
    parts.push(`<rect x="${num(node.x)}" y="${num(node.y)}" width="5" height="${num(node.h)}" rx="2" fill="${color}" stroke="none"/>`)
  }
  const cx = node.x + node.w / 2
  const cy = node.y + node.h / 2
  parts.push(textLines(node.lines ?? [node.label], cx, cy, {}))
  if (options.subtitle !== undefined && options.subtitle !== '') {
    parts.push(lineText(options.subtitle, cx, node.y + node.h - 10, { anchor: 'middle', size: 10, fill: MUTED }))
  }
  return parts.join('')
}

function renderDatabase(node) {
  const color = colorOf(node.type)
  const cx = node.x + node.w / 2
  const ry = 9
  const path = `M ${num(node.x)} ${num(node.y + ry)} C ${num(node.x)} ${num(node.y - 4)} ${num(node.x + node.w)} ${num(node.y - 4)} ${num(node.x + node.w)} ${num(node.y + ry)} L ${num(node.x + node.w)} ${num(node.y + node.h - ry)} C ${num(node.x + node.w)} ${num(node.y + node.h + 4)} ${num(node.x)} ${num(node.y + node.h + 4)} ${num(node.x)} ${num(node.y + node.h - ry)} Z`
  const parts = [
    `<path d="${path}" fill="#ecfeff" stroke="${color}" stroke-width="1.7"/>`,
    `<ellipse cx="${num(cx)}" cy="${num(node.y + ry)}" rx="${num(node.w / 2)}" ry="${num(ry)}" fill="#ffffff" stroke="${color}" stroke-width="1.5"/>`,
  ]
  parts.push(textLines(node.lines ?? [node.label], cx, node.y + node.h / 2 + 6, { size: 12 }))
  return parts.join('')
}

function renderNode(node, diagramType) {
  const type = node.type
  if (type === 'group') return renderGroup(node)
  if (type === 'note') return renderNote(node)
  if (type === 'initial') {
    return `<circle cx="${num(node.x + node.w / 2)}" cy="${num(node.y + node.h / 2)}" r="${num(node.w / 2)}" fill="#111827" stroke="none"/>`
  }
  if (type === 'final') {
    const cx = node.x + node.w / 2
    const cy = node.y + node.h / 2
    return `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(node.w / 2)}" fill="#ffffff" stroke="#111827" stroke-width="2"/><circle cx="${num(cx)}" cy="${num(cy)}" r="${num(node.w / 2 - 6)}" fill="#111827" stroke="none"/>`
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
    parts.push(`<line x1="${num(node.x + 7)}" y1="${num(node.y + 4)}" x2="${num(node.x + 7)}" y2="${num(node.y + node.h - 4)}" stroke="${TYPE_COLORS.store}" stroke-width="1.2"/>`)
    parts.push(`<line x1="${num(node.x + node.w - 7)}" y1="${num(node.y + 4)}" x2="${num(node.x + node.w - 7)}" y2="${num(node.y + node.h - 4)}" stroke="${TYPE_COLORS.store}" stroke-width="1.2"/>`)
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

function borderPoint(node, towardX, towardY) {
  const cx = node.x + node.w / 2
  const cy = node.y + node.h / 2
  const dx = towardX - cx
  const dy = towardY - cy
  if (dx === 0 && dy === 0) return [cx, cy]
  const hw = node.w / 2
  const hh = node.h / 2
  const scaleX = dx === 0 ? Infinity : hw / Math.abs(dx)
  const scaleY = dy === 0 ? Infinity : hh / Math.abs(dy)
  const scale = Math.min(scaleX, scaleY)
  return [cx + dx * scale, cy + dy * scale]
}

function edgeDash(kind) {
  return kind === 'dashed' || kind === 'depends' || kind === 'async' || kind === 'return'
    ? ' stroke-dasharray="7 5"'
    : ''
}

function edgeLabel(label, x, y, options = {}) {
  if (label === '') return ''
  const width = ascWidth(label) + 12
  const size = options.size ?? 11
  return `<g class="edge-label"><rect x="${num(x - width / 2)}" y="${num(y - 12)}" width="${num(width)}" height="18" rx="4" fill="#ffffff" fill-opacity="0.93" stroke="#e2e8f0" stroke-width="1"/><text x="${num(x)}" y="${num(y + 1)}" text-anchor="middle" font-size="${size}" fill="${MUTED}" font-family="${FONT_FAMILY}">${esc(label)}</text></g>`
}

function renderEdge(edge, nodes, marker) {
  const from = nodes.get(edge.from)
  const to = nodes.get(edge.to)
  if (from === undefined || to === undefined) return ''
  const arrow = ` marker-end="url(#${esc(marker)})"`
  const dash = edgeDash(edge.kind)
  const parts = [`<g class="edge" data-edge="${esc(edge.id)}">`]

  if (edge.from === edge.to) {
    const x = from.x + from.w
    const y = from.y + from.h / 2
    parts.push(`<path d="M ${num(x)} ${num(y - 12)} C ${num(x + 54)} ${num(y - 30)} ${num(x + 54)} ${num(y + 30)} ${num(x)} ${num(y + 12)}" fill="none" stroke="${EDGE}" stroke-width="1.5"${dash}${arrow}/>`)
    if (edge.label !== '') parts.push(edgeLabel(edge.label, x + 58, y - 20))
  } else {
    const [x1, y1] = borderPoint(from, to.x + to.w / 2, to.y + to.h / 2)
    const [x2, y2] = borderPoint(to, from.x + from.w / 2, from.y + from.h / 2)
    parts.push(`<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${EDGE}" stroke-width="1.5"${dash}${arrow}/>`)
    if (edge.cardinality !== '') {
      parts.push(edgeLabel(edge.cardinality, (x1 + x2) / 2, (y1 + y2) / 2 + 16))
    }
    if (edge.label !== '') {
      parts.push(edgeLabel(edge.label, (x1 + x2) / 2, (y1 + y2) / 2 - 8))
    }
  }
  parts.push('</g>')
  return parts.join('')
}

// --- sequence layout --------------------------------------------------------

function renderSequence(nodes, edges, key, title) {
  const participants = [...nodes].sort((a, b) => a.index - b.index)
  if (participants.length === 0) return emptyState(key, title, '（空图）')

  const headerHeight = 46
  const messageGap = 46
  const ordered = [...edges].sort((a, b) => {
    const left = a.order === undefined ? Number.MAX_SAFE_INTEGER : a.order
    const right = b.order === undefined ? Number.MAX_SAFE_INTEGER : b.order
    return left - right || a.index - b.index
  })
  const messageRows = Math.max(1, ordered.length)
  const titleLines = participants.map(node => {
    const lines = wrapText(node.label, 18, 2)
    return { node, lines, width: clamp(Math.max(...lines.map(ascWidth)) + 30, 140, 240) }
  })
  const totalWidth = SVG_PAD * 2 + titleLines.reduce((sum, entry) => sum + entry.width, 0) + GAP_Y * Math.max(0, titleLines.length - 1)
  const height = SVG_PAD * 2 + headerHeight + 48 + messageRows * messageGap
  const xById = new Map()
  let cursor = SVG_PAD
  for (const entry of titleLines) {
    xById.set(entry.node.id, cursor + entry.width / 2)
    cursor += entry.width + GAP_Y
  }

  const parts = [`<rect x="0" y="0" width="${num(totalWidth)}" height="${num(height)}" fill="#ffffff"/>`]
  for (const entry of titleLines) {
    const cx = xById.get(entry.node.id)
    const color = entry.node.type === 'actor' ? TYPE_COLORS.actor : TYPE_COLORS.participant
    const fill = entry.node.type === 'actor' ? '#f5f3ff' : '#eef2ff'
    parts.push(rect(cx - entry.width / 2, SVG_PAD, entry.width, headerHeight, { rx: 7, fill, stroke: color, strokeWidth: 1.7 }))
    parts.push(textLines(entry.lines, cx, SVG_PAD + headerHeight / 2, { size: 12, weight: 600 }))
    parts.push(`<line x1="${num(cx)}" y1="${num(SVG_PAD + headerHeight)}" x2="${num(cx)}" y2="${num(height - SVG_PAD)}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 5"/>`)
  }

  const marker = markerIdentifier(key)
  ordered.forEach((edge, index) => {
    const fromX = xById.get(edge.from)
    const toX = xById.get(edge.to)
    if (fromX === undefined || toX === undefined) return
    const y = SVG_PAD + headerHeight + 44 + index * messageGap
    const arrow = ` marker-end="url(#${esc(marker)})"`
    const dash = edgeDash(edge.kind)
    parts.push(`<g class="sequence-message" data-order="${num(index + 1)}">`)
    if (edge.from === edge.to) {
      parts.push(`<path d="M ${num(fromX)} ${num(y - 12)} C ${num(fromX + 46)} ${num(y - 26)} ${num(fromX + 46)} ${num(y + 26)} ${num(fromX)} ${num(y + 12)}" fill="none" stroke="${EDGE}" stroke-width="1.5"${dash}${arrow}/>`)
      parts.push(edgeLabel(edge.label, fromX + 50, y - 18))
    } else {
      parts.push(`<line x1="${num(fromX)}" y1="${num(y)}" x2="${num(toX)}" y2="${num(y)}" stroke="${EDGE}" stroke-width="1.5"${dash}${arrow}/>`)
      if (edge.label !== '') parts.push(edgeLabel(edge.label, (fromX + toX) / 2, y - 9))
    }
    parts.push('</g>')
  })

  return svgDocument(title, totalWidth, height, parts.join(''), key, true)
}

// --- document shell ---------------------------------------------------------

function svgDocument(title, width, height, body, key, hasEdges) {
  const w = Math.max(320, Math.ceil(width))
  const h = Math.max(180, Math.ceil(height))
  const marker = markerIdentifier(key)
  const defs = hasEdges
    ? `<defs><marker id="${esc(marker)}" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="10" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,4 L0,8 z" fill="${EDGE}"/></marker></defs>`
    : ''
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}" data-diagram="${esc(key)}" class="diagram-svg"><title>${esc(title)}</title><rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff"/>${defs}${body}</svg>`
}

function emptyState(key, title, message) {
  const width = 420
  const height = 180
  const body = `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="14" fill="${MUTED}" font-family="${FONT_FAMILY}">${esc(message)}</text>`
  return svgDocument(title, width, height, body, key, false)
}

// --- public entry point -----------------------------------------------------

function renderDiagram(source, options) {
  const diagramType = diagramTypeOf(source)
  const key = clean(source?.key) || diagramType || 'diagram'
  const title = clean(source?.title) || diagramType || '图解'
  const maxNodes = Number.isInteger(options.maxNodes) && options.maxNodes > 0 ? options.maxNodes : SVG_MAX_NODES
  const rawNodes = list(source?.nodes).filter(node => object(node) !== undefined)
  const truncated = rawNodes.length > maxNodes
  const usedIds = new Set()
  const nodes = rawNodes.slice(0, maxNodes).map((node, index) => modelNode(node, index, usedIds))
  const ids = new Set(nodes.map(node => node.id))
  const rawEdges = list(source?.edges).filter(node => object(node) !== undefined)
  const edges = rawEdges.map((edge, index) => modelEdge(edge, index, ids)).filter(edge => edge !== undefined)

  if (!SUPPORTED_TYPES.has(diagramType)) {
    return emptyState(key, title, `不支持的图解类型：${diagramType || '（空）'}`)
  }
  if (nodes.length === 0) {
    return emptyState(key, title, '（空图）')
  }

  if (diagramType === 'sequence') {
    return renderSequence(nodes, edges, key, title)
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
  const noteLimit = Math.max(640, bounds.width)
  for (const note of notes) {
    measureNode(note, diagramType)
    if (noteX + note.w + SVG_PAD > noteLimit && noteX > SVG_PAD) {
      noteX = SVG_PAD
      noteY += rowHeight + GAP_Y
      rowHeight = 0
    }
    note.x = noteX
    note.y = noteY
    noteX += note.w + GAP_X
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
  for (const group of groupNodes) parts.push(renderGroup(group))
  // 2. Edges behind nodes.
  const edgeParts = []
  for (const edge of edges) {
    const rendered = renderEdge(edge, nodeMap, marker)
    if (rendered !== '') edgeParts.push(rendered)
  }
  parts.push(...edgeParts)
  // 3. Nodes (group labels were drawn with the background; re-draw only titles).
  for (const node of allNodes) {
    if (node.type === 'group') {
      parts.push(textLines(node.lines ?? wrapText(node.label, 20, 1), node.x + 14, node.y + 17, { anchor: 'start', size: 12, weight: 600, fill: TYPE_COLORS.group }))
      continue
    }
    parts.push(renderNode(node, diagramType))
  }
  // 4. Notes.
  for (const note of notes) parts.push(renderNote(note))

  if (truncated) {
    const hidden = rawNodes.length - maxNodes
    const message = `已省略 ${hidden} 个节点（上限 ${maxNodes}）`
    height += 28
    parts.push(lineText(message, width / 2, height - 14, { anchor: 'middle', size: 11, fill: MUTED }))
  }

  return svgDocument(title, width, height, parts.join(''), key, edges.length > 0)
}

export function renderDiagramSvg(diagram, options = {}) {
  const source = object(diagram)
  try {
    return renderDiagram(source ?? {}, object(options) ?? {})
  } catch {
    const key = clean(source?.key) || clean(source?.type) || 'diagram'
    const title = clean(source?.title) || '图解'
    return emptyState(key, title, '（渲染失败）')
  }
}
