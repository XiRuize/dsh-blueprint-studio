import { DIAGRAM_DEFS, SECTION_DEFS, mermaidFor } from './blueprint.js'

// A single offline HTML export must stay small enough for a browser tab to open
// comfortably. The limit is checked against the encoded byte length, not the JS
// string length, so CJK content cannot silently grow past the advertised cap.
export const EXPORT_MAX_BYTES = 5 * 1024 * 1024

export class ExportTooLargeError extends Error {
  constructor(size, limit = EXPORT_MAX_BYTES) {
    super(`HTML 导出超过 5MB 上限（当前 ${formatBytes(size)}）。请缩小导出范围或减少内容后重试。`)
    this.name = 'ExportTooLargeError'
    this.code = 'export-too-large'
    this.size = size
    this.limit = limit
  }
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

function asText(value, fallback = '') {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback
}

function asList(value) {
  return Array.isArray(value) ? value : []
}

function layerKey(layer) {
  return asText(layer?.id ?? layer?.letter, 'A').trim() || 'A'
}

function normalizeLayerId(value) {
  return asText(value).trim().toUpperCase()
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '未知大小'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function allLayers(blueprint) {
  return asList(blueprint?.layers).filter(layer => object(layer) !== undefined)
}

function allModules(blueprint) {
  return asList(blueprint?.modules).filter(module => object(module) !== undefined)
}

function allDiagrams(blueprint) {
  return asList(blueprint?.diagrams ?? blueprint?.charts).filter(diagram => object(diagram) !== undefined)
}

function allSections(blueprint) {
  return asList(blueprint?.sections).filter(section => object(section) !== undefined)
}

function findLayer(blueprint, id) {
  const wanted = normalizeLayerId(id)
  if (wanted === '') return undefined
  return allLayers(blueprint).find(layer =>
    normalizeLayerId(layerKey(layer)) === wanted
    || normalizeLayerId(layer.letter) === wanted,
  )
}

function moduleOf(blueprint, reference) {
  const wanted = asText(reference).trim()
  if (wanted === '') return undefined
  const modules = allModules(blueprint)
  return modules.find(module => asText(module.id) === wanted)
    ?? modules.find(module => asText(module.code).trim().toUpperCase() === wanted.toUpperCase())
}

function layerIdOfModule(module) {
  return normalizeLayerId(module?.layerId ?? module?.layer) || 'A'
}

function diagramLayerId(diagram) {
  const explicit = normalizeLayerId(diagram?.layerId ?? diagram?.layer)
  if (explicit !== '') return explicit
  const key = asText(diagram?.key)
  if (key.includes(':')) return normalizeLayerId(key.slice(0, key.indexOf(':'))) || 'A'
  return 'A'
}

function diagramType(diagram) {
  const explicit = asText(diagram?.type).trim().toLowerCase()
  if (explicit !== '') return explicit
  const key = asText(diagram?.key)
  if (key.includes(':')) return key.slice(key.indexOf(':') + 1).trim().toLowerCase()
  return key.trim().toLowerCase()
}

function diagramDef(type) {
  return DIAGRAM_DEFS.find(def => def.key === type)
}

function diagramTitle(diagram) {
  const title = asText(diagram?.title).trim()
  if (title !== '') return title
  return diagramDef(diagramType(diagram))?.title ?? diagramType(diagram) ?? '图'
}

function sectionList(blueprint) {
  const source = allSections(blueprint)
  const byKey = new Map(source.map(section => [asText(section.key), section]))
  const result = []
  const used = new Set()
  for (const def of SECTION_DEFS) {
    const section = byKey.get(def.key)
    used.add(def.key)
    result.push({
      key: def.key,
      // The seven columns have stable product names. Normalization may store the
      // section key as its fallback title, so do not let that override the label.
      title: def.title,
      items: asList(section?.items ?? section?.requirements).filter(item => item !== null && item !== undefined),
    })
  }
  for (const section of source) {
    const key = asText(section.key).trim() || `section-${result.length + 1}`
    if (used.has(key)) continue
    used.add(key)
    result.push({
      key,
      title: asText(section.title).trim() || key,
      items: asList(section.items ?? section.requirements).filter(item => item !== null && item !== undefined),
    })
  }
  return result
}

function requirementBody(item) {
  if (typeof item === 'string') return item.trim()
  return asText(item?.text ?? item?.label ?? item?.title ?? item?.value).trim()
}

function requirementCode(item) {
  if (typeof item === 'string') return ''
  return asText(item?.code ?? item?.uid).trim()
}

function requirementModule(item) {
  if (typeof item === 'string') return ''
  return asText(item?.moduleId).trim()
}

/**
 * Resolve a module code the same way a normalized blueprint would, while also
 * accepting older data where modules have no `code` field yet. Existing codes are
 * returned unchanged; a missing code is derived from the module's layer and
 * position, skipping numbers already used in that layer.
 */
export function moduleCode(blueprint, module) {
  const value = object(module)
  if (value === undefined) return ''
  const explicit = asText(value.code).trim()
  if (explicit !== '') return explicit

  const modules = allModules(blueprint)
  const id = asText(value.id).trim()
  const candidate = modules.find(item => item === value)
    ?? (id === '' ? undefined : modules.find(item => asText(item.id).trim() === id))
    ?? value
  const layerId = layerIdOfModule(candidate)
  const sameLayer = modules.filter(item => layerIdOfModule(item) === layerId)
  const index = sameLayer.findIndex(item => item === candidate || (id !== '' && asText(item.id).trim() === id))
  const used = new Set(sameLayer.map(item => asText(item.code).trim()).filter(code => code !== ''))
  let sequence = index >= 0 ? index + 1 : 1
  while (used.has(`${layerId}${sequence}`)) sequence += 1
  return `${layerId}${sequence}`
}

/**
 * Human-readable path for a layer, following the layer's parent module:
 * A, A / A1 / B, A / A1 / B / B1 / C, ...
 */
export function layerPath(blueprint, layerId) {
  const layers = allLayers(blueprint)
  const target = findLayer(blueprint, layerId) ?? layers.find(layer => normalizeLayerId(layerKey(layer)) === normalizeLayerId(layerId))
  if (target === undefined) return normalizeLayerId(layerId) || 'A'

  const segments = [asText(target.letter).trim() || layerKey(target)]
  const visited = new Set([layerKey(target)])
  let current = target
  while (current !== undefined && asText(current.parentModuleId).trim() !== '') {
    const parent = moduleOf(blueprint, current.parentModuleId)
    if (parent === undefined) break
    const parentLayer = findLayer(blueprint, layerIdOfModule(parent))
    if (parentLayer === undefined) break
    const parentKey = layerKey(parentLayer)
    if (visited.has(parentKey)) break
    visited.add(parentKey)
    const code = moduleCode(blueprint, parent)
    if (code !== '') segments.unshift(code)
    segments.unshift(asText(parentLayer.letter).trim() || parentKey)
    current = parentLayer
  }
  return segments.join(' / ')
}

function rootLayer(blueprint) {
  const layers = allLayers(blueprint)
  return layers.find(layer => normalizeLayerId(layerKey(layer)) === 'A') ?? layers[0]
}

function childLayers(blueprint) {
  const layers = allLayers(blueprint)
  const map = new Map()
  for (const layer of layers) {
    const parent = moduleOf(blueprint, layer?.parentModuleId)
    if (parent === undefined) continue
    const parentLayer = findLayer(blueprint, layerIdOfModule(parent))
    if (parentLayer === undefined) continue
    const key = layerKey(parentLayer)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(layer)
  }
  return map
}

function collectLayers(blueprint, selection, includeDescendants) {
  const layers = allLayers(blueprint)
  if (layers.length === 0) {
    return [{
      id: 'A',
      letter: 'A',
      title: '总览',
      parentModuleId: null,
    }]
  }
  if (selection.global) {
    const children = childLayers(blueprint)
    const result = []
    const visited = new Set()
    const visit = layer => {
      const key = layerKey(layer)
      if (visited.has(key)) return
      visited.add(key)
      result.push(layer)
      for (const child of children.get(key) ?? []) visit(child)
    }
    const root = rootLayer(blueprint)
    if (root !== undefined) visit(root)
    for (const layer of layers) visit(layer)
    return result
  }

  const selected = findLayer(blueprint, selection.layerId) ?? rootLayer(blueprint)
  if (selected === undefined) return []
  if (!includeDescendants) return [selected]
  const children = childLayers(blueprint)
  const result = []
  const visited = new Set()
  const visit = layer => {
    const key = layerKey(layer)
    if (visited.has(key)) return
    visited.add(key)
    result.push(layer)
    for (const child of children.get(key) ?? []) visit(child)
  }
  visit(selected)
  return result
}

function parentLabel(blueprint, layer) {
  const reference = asText(layer?.parentModuleId).trim()
  if (reference === '') return '无（根层）'
  const parent = moduleOf(blueprint, reference)
  if (parent === undefined) return `未知模块（${reference}）`
  const parentLayer = findLayer(blueprint, layerIdOfModule(parent))
  const code = moduleCode(blueprint, parent)
  const name = asText(parent.name ?? parent.title ?? parent.id).trim()
  const layerTitle = parentLayer === undefined
    ? layerIdOfModule(parent)
    : `${asText(parentLayer.letter).trim() || layerKey(parentLayer)} · ${asText(parentLayer.title).trim() || '层'}`
  return `${layerTitle}（通过模块 ${code}${name === '' ? '' : ` · ${name}`}）`
}

function modulesInLayer(blueprint, id) {
  const wanted = normalizeLayerId(id)
  return allModules(blueprint).filter(module => layerIdOfModule(module) === wanted)
}

function diagramsInLayer(blueprint, id) {
  const wanted = normalizeLayerId(id)
  const diagrams = allDiagrams(blueprint).filter(diagram => diagramLayerId(diagram) === wanted)
  const order = new Map(DIAGRAM_DEFS.map((def, index) => [def.key, index]))
  return diagrams.slice().sort((left, right) => {
    const leftOrder = order.get(diagramType(left)) ?? 99
    const rightOrder = order.get(diagramType(right)) ?? 99
    return leftOrder - rightOrder || asText(left.title).localeCompare(asText(right.title))
  })
}

function moduleLabel(blueprint, reference) {
  const module = moduleOf(blueprint, reference)
  return module === undefined ? '未归属' : moduleCode(blueprint, module)
}

function requirementLayerId(blueprint, item) {
  const reference = requirementModule(item)
  if (reference === '') return undefined
  const module = moduleOf(blueprint, reference)
  return module === undefined ? undefined : layerIdOfModule(module)
}

function requirementsForLayer(blueprint, layer) {
  const id = normalizeLayerId(layerKey(layer))
  const root = rootLayer(blueprint)
  const rootId = root === undefined ? 'A' : normalizeLayerId(layerKey(root))
  const includeUnassigned = id === rootId
  return sectionList(blueprint).map(section => ({
    ...section,
    items: section.items.filter(item => {
      const assignedLayer = requirementLayerId(blueprint, item)
      return assignedLayer === undefined ? includeUnassigned : assignedLayer === id
    }),
  }))
}

function dependencyLabel(blueprint, reference) {
  const module = moduleOf(blueprint, reference)
  if (module === undefined) return asText(reference).trim() || '未归属'
  const code = moduleCode(blueprint, module)
  const name = asText(module.name ?? module.title ?? module.id).trim()
  return name === '' ? code : `${code} · ${name}`
}

function requirementCount(sections) {
  return sections.reduce((sum, section) => sum + section.items.length, 0)
}

function modelCounts(layerModels) {
  const requirements = layerModels.reduce((sum, layer) => sum + requirementCount(layer.sections), 0)
  const modules = layerModels.reduce((sum, layer) => sum + layer.modules.length, 0)
  const diagrams = layerModels.reduce((sum, layer) => sum + layer.diagrams.length, 0)
  const nodes = layerModels.reduce((sum, layer) =>
    sum + layer.diagrams.reduce((inner, diagram) => inner + asList(diagram.nodes).length, 0), 0)
  const edges = layerModels.reduce((sum, layer) =>
    sum + layer.diagrams.reduce((inner, diagram) => inner + asList(diagram.edges).length, 0), 0)
  return { layers: layerModels.length, requirements, modules, diagrams, nodes, edges }
}

function exportTime(now) {
  if (typeof now === 'string' && now.trim() !== '') return now.trim()
  if (now instanceof Date && Number.isFinite(now.getTime())) return now.toISOString()
  return new Date().toISOString()
}

function buildModel(blueprint, options = {}) {
  const source = object(blueprint) ?? {}
  const settings = object(options) ?? {}
  const global = settings.global === true
  const includeDescendants = global || settings.includeDescendants === true
  const layers = allLayers(source)
  const selected = findLayer(source, settings.layerId) ?? rootLayer(source) ?? layers[0]
  const layerId = selected === undefined ? 'A' : layerKey(selected)
  const ordered = collectLayers(source, { global, layerId }, includeDescendants)
  const layerModels = ordered.map(layer => ({
    layer,
    id: layerKey(layer),
    letter: asText(layer.letter).trim() || layerKey(layer),
    title: asText(layer.title ?? layer.name).trim() || '总览',
    path: layerPath(source, layerKey(layer)),
    parent: parentLabel(source, layer),
    sections: requirementsForLayer(source, layer),
    modules: modulesInLayer(source, layerKey(layer)),
    diagrams: diagramsInLayer(source, layerKey(layer)),
  }))
  const counts = modelCounts(layerModels)
  const scopeLabel = global
    ? '全局（全部层）'
    : includeDescendants
      ? `当前层及子层 ${layerId} · ${asText(selected?.title).trim() || '总览'}`
      : `当前层 ${layerId} · ${asText(selected?.title).trim() || '总览'}`
  return {
    blueprint: source,
    title: asText(source.title).trim() || '工程蓝图',
    status: asText(source.status).trim(),
    exportedAt: exportTime(settings.now),
    global,
    includeDescendants,
    selected,
    layerId,
    layerModels,
    counts,
    scopeLabel,
  }
}

function markdownText(value) {
  return asText(value).replace(/\r?\n+/gu, ' ').trim()
}

function markdownCell(value) {
  return markdownText(value)
    .replace(/\\/gu, '\\\\')
    .replace(/\|/gu, '\\|')
}

function markdownHeading(value) {
  return markdownText(value).replace(/^#+/u, '').trim() || '工程蓝图'
}

function mermaidSource(blueprint, diagram) {
  const key = asText(diagram?.key).trim()
  if (key !== '') {
    try {
      const source = mermaidFor(blueprint, key)
      if (typeof source === 'string' && source.trim() !== '') return source
    } catch {
      // Fall through to a tiny valid placeholder; one bad diagram must not make
      // the whole offline export fail.
    }
  }
  return diagramType(diagram) === 'module' ? 'graph TD' : 'flowchart LR'
}

function isDiagramEmpty(diagram) {
  return asList(diagram?.nodes).length === 0 && asList(diagram?.edges).length === 0
}

function markdownRequirements(lines, blueprint, layer, level) {
  const hashes = '#'.repeat(level)
  for (const section of layer.sections) {
    lines.push(`${hashes} ${markdownHeading(section.title)}`, '')
    if (section.items.length === 0) {
      lines.push('（无）', '')
      continue
    }
    for (const item of section.items) {
      const code = requirementCode(item)
      const module = moduleLabel(blueprint, requirementModule(item))
      const body = markdownText(requirementBody(item))
      const codePrefix = code === '' ? '' : `**${markdownCell(code)}**`
      lines.push(`- ${codePrefix}（模块：${module}）${body}`)
    }
    lines.push('')
  }
}

function markdownModules(lines, blueprint, layer, level) {
  const hashes = '#'.repeat(level)
  if (layer.modules.length === 0) {
    lines.push('（无）', '')
    return
  }
  for (const module of layer.modules) {
    const code = moduleCode(blueprint, module)
    const name = markdownText(module.name ?? module.title ?? module.id) || '未命名模块'
    lines.push(`${hashes} ${code} · ${name}`, '')
    lines.push(`- 状态：${markdownText(module.status) || 'pending'}`)
    const deps = asList(module.dependsOn).map(reference => dependencyLabel(blueprint, reference))
    lines.push(`- 依赖：${deps.length === 0 ? '无' : deps.join('、')}`)
    const acceptance = asList(module.acceptance).map(markdownText).filter(item => item !== '')
    if (acceptance.length === 0) {
      lines.push('- 验收标准：无')
    } else {
      lines.push('- 验收标准：')
      for (const item of acceptance) lines.push(`  - ${item}`)
    }
    lines.push('')
  }
}

function markdownDiagrams(lines, blueprint, layer, level) {
  const hashes = '#'.repeat(level)
  if (layer.diagrams.length === 0) {
    lines.push('（无）', '')
    return
  }
  for (const diagram of layer.diagrams) {
    const type = diagramType(diagram)
    const title = markdownHeading(diagramTitle(diagram))
    lines.push(`${hashes} ${title}（${type}）`, '')
    const description = markdownText(diagram.description)
    if (description !== '') lines.push(description, '')
    if (isDiagramEmpty(diagram)) {
      lines.push('空', '')
      continue
    }
    lines.push('```mermaid')
    lines.push(mermaidSource(blueprint, diagram))
    lines.push('```', '')

    const nodes = asList(diagram.nodes)
    lines.push(`${hashes}# 节点（${nodes.length}）`, '')
    if (nodes.length === 0) {
      lines.push('（无）', '')
    } else {
      lines.push('| code | label | type |', '| --- | --- | --- |')
      for (const [index, node] of nodes.entries()) {
        const code = markdownCell(node.id ?? node.code ?? `n${index + 1}`)
        const label = markdownCell(node.label ?? node.name ?? node.title)
        const nodeType = markdownCell(node.type ?? '')
        lines.push(`| ${code} | ${label} | ${nodeType} |`)
      }
      lines.push('')
    }

    const edges = asList(diagram.edges)
    lines.push(`${hashes}# 边（${edges.length}）`, '')
    if (edges.length === 0) {
      lines.push('（无）', '')
    } else {
      lines.push('| from | to | label | kind | cardinality |', '| --- | --- | --- | --- | --- |')
      for (const edge of edges) {
        lines.push(`| ${markdownCell(edge.from)} | ${markdownCell(edge.to)} | ${markdownCell(edge.label)} | ${markdownCell(edge.kind)} | ${markdownCell(edge.cardinality)} |`)
      }
      lines.push('')
    }
  }
}

function markdownLayerBody(lines, blueprint, layer, flat) {
  if (flat) {
    lines.push('## 需求', '')
    markdownRequirements(lines, blueprint, layer, 3)
    lines.push('## 模块', '')
    markdownModules(lines, blueprint, layer, 3)
    lines.push('## 图', '')
    markdownDiagrams(lines, blueprint, layer, 3)
    return
  }
  lines.push('### 需求', '')
  markdownRequirements(lines, blueprint, layer, 4)
  lines.push('### 模块', '')
  markdownModules(lines, blueprint, layer, 4)
  lines.push('### 图', '')
  markdownDiagrams(lines, blueprint, layer, 4)
}

/**
 * Render a deterministic, layer-aware Markdown document. The current layer is the
 * default scope; pass `global: true` for the recursive A -> child tree or
 * `includeDescendants: true` for the selected layer plus its descendants.
 */
export function exportMarkdown(blueprint, options = {}) {
  const model = buildModel(blueprint, options)
  const lines = [`# ${markdownHeading(model.title)}`, '']
  lines.push(`- 范围：${model.scopeLabel}`)
  lines.push(`- 导出时间：${model.exportedAt}`)
  if (model.status !== '') lines.push(`- 蓝图状态：${model.status}`)
  lines.push(`- 统计：层 ${model.counts.layers} · 需求 ${model.counts.requirements} · 模块 ${model.counts.modules} · 图 ${model.counts.diagrams}`)
  lines.push('')

  const flat = !model.global && !model.includeDescendants && model.layerModels.length === 1
  if (flat) {
    const layer = model.layerModels[0]
    lines.push(`## 当前层：${layer.letter} · ${markdownHeading(layer.title)}`, '')
    lines.push(`- 层：${layer.letter}`)
    lines.push('')
    markdownLayerBody(lines, model.blueprint, layer, true)
  } else {
    for (const layer of model.layerModels) {
      lines.push(`## 层 ${layer.letter} · ${markdownHeading(layer.title)}`, '')
      lines.push(`- 层路径：${layer.path}`)
      lines.push(`- 父层：${layer.parent}`)
      lines.push('')
      markdownLayerBody(lines, model.blueprint, layer, false)
    }
  }
  return `${lines.join('\n').replace(/\n{3,}/gu, '\n\n').trimEnd()}\n`
}

function escapeHtml(value) {
  return asText(value)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;')
}

function escapeAttribute(value) {
  return escapeHtml(value)
}

// JSON inside a <script> can terminate the element with a literal </script>.
// Escape every angle bracket (and the two JS line separators) so arbitrary user
// text remains valid JSON and can never break out of the script element.
function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
    .replace(/&/gu, '\\u0026')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029')
}

function searchHaystack(...values) {
  return values.flat(Infinity).filter(value => value !== undefined && value !== null).join(' ').replace(/\s+/gu, ' ').trim()
}

function htmlRequirements(model, layer, index) {
  const id = index === 0 ? 'requirements' : `layer-${escapeAttribute(layer.id)}-requirements`
  const html = [`<section class="requirement-block" id="${id}">`, '<h3>需求</h3>']
  for (const section of layer.sections) {
    html.push('<section class="requirement-section">')
    html.push(`<h4>${escapeHtml(section.title)}</h4>`)
    html.push('<table class="data-table requirement-table">')
    html.push('<thead><tr><th>Code</th><th>需求</th><th>模块</th></tr></thead>')
    html.push('<tbody>')
    if (section.items.length === 0) {
      html.push('<tr class="empty-row"><td colspan="3">（无）</td></tr>')
    } else {
      for (const item of section.items) {
        const code = requirementCode(item)
        const module = moduleLabel(model.blueprint, requirementModule(item))
        const body = requirementBody(item)
        html.push(`<tr data-search-item data-search="${escapeAttribute(searchHaystack(code, body, module))}">`)
        html.push(`<td class="code">${escapeHtml(code)}</td>`)
        html.push(`<td>${escapeHtml(body)}</td>`)
        html.push(`<td class="module-ref">${escapeHtml(module)}</td>`)
        html.push('</tr>')
      }
    }
    html.push('</tbody></table>')
    html.push('</section>')
  }
  html.push('</section>')
  return html.join('\n')
}

function htmlModules(model, layer, index) {
  const id = index === 0 ? 'modules' : `layer-${escapeAttribute(layer.id)}-modules`
  const html = [`<section class="module-block" id="${id}">`, '<h3>模块</h3>']
  html.push('<table class="data-table module-table">')
  html.push('<thead><tr><th>Code</th><th>名称</th><th>状态</th><th>依赖</th><th>验收标准</th></tr></thead>')
  html.push('<tbody>')
  if (layer.modules.length === 0) {
    html.push('<tr class="empty-row"><td colspan="5">（无）</td></tr>')
  } else {
    for (const module of layer.modules) {
      const code = moduleCode(model.blueprint, module)
      const name = asText(module.name ?? module.title ?? module.id)
      const status = asText(module.status) || 'pending'
      const deps = asList(module.dependsOn).map(reference => dependencyLabel(model.blueprint, reference))
      const acceptance = asList(module.acceptance).map(asText).filter(item => item !== '')
      html.push(`<tr data-search-item data-search="${escapeAttribute(searchHaystack(code, name, status, deps, acceptance))}">`)
      html.push(`<td class="code">${escapeHtml(code)}</td>`)
      html.push(`<td>${escapeHtml(name || '未命名模块')}</td>`)
      html.push(`<td><span class="status status-${escapeAttribute(status.replace(/[^a-z0-9_-]/giu, '').toLowerCase())}">${escapeHtml(status)}</span></td>`)
      html.push(`<td>${deps.length === 0 ? '无' : deps.map(item => escapeHtml(item)).join('<br>')}</td>`)
      html.push(`<td>${acceptance.length === 0 ? '无' : `<ul>${acceptance.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`}</td>`)
      html.push('</tr>')
    }
  }
  html.push('</tbody></table>')
  html.push('</section>')
  return html.join('\n')
}

function htmlDiagrams(model, layer, index) {
  const id = index === 0 ? 'diagrams' : `layer-${escapeAttribute(layer.id)}-diagrams`
  const html = [`<section class="diagram-block" id="${id}">`, '<h3>图</h3>']
  if (layer.diagrams.length === 0) {
    html.push('<p class="empty">（无）</p>')
  }
  for (const [diagramIndex, diagram] of layer.diagrams.entries()) {
    const type = diagramType(diagram)
    const title = diagramTitle(diagram)
    const anchor = `diagram-${layer.id}-${type}-${diagramIndex + 1}`
    const search = searchHaystack(title, type, asList(diagram.nodes).map(node => [node.id, node.label, node.type]), asList(diagram.edges).map(edge => [edge.from, edge.to, edge.label, edge.kind]))
    html.push(`<article class="diagram-card" id="${escapeAttribute(anchor)}" data-search-item data-search="${escapeAttribute(search)}">`)
    html.push(`<h4>${escapeHtml(title)} <span class="badge">${escapeHtml(type)}</span></h4>`)
    if (asText(diagram.description).trim() !== '') {
      html.push(`<p class="diagram-description">${escapeHtml(diagram.description)}</p>`)
    }
    if (isDiagramEmpty(diagram)) {
      html.push('<p class="empty">空</p>')
      html.push('</article>')
      continue
    }
    html.push('<pre class="mermaid-source"><code class="language-mermaid">')
    html.push(escapeHtml(mermaidSource(model.blueprint, diagram)))
    html.push('</code></pre>')

    const nodes = asList(diagram.nodes)
    html.push('<h5>节点</h5>')
    html.push('<table class="data-table node-table">')
    html.push('<thead><tr><th>Code</th><th>Label</th><th>Type</th></tr></thead>')
    html.push('<tbody>')
    if (nodes.length === 0) {
      html.push('<tr class="empty-row"><td colspan="3">（无）</td></tr>')
    } else {
      for (const [nodeIndex, node] of nodes.entries()) {
        html.push('<tr>')
        html.push(`<td class="code">${escapeHtml(node.id ?? node.code ?? `n${nodeIndex + 1}`)}</td>`)
        html.push(`<td>${escapeHtml(node.label ?? node.name ?? node.title)}</td>`)
        html.push(`<td>${escapeHtml(node.type)}</td>`)
        html.push('</tr>')
      }
    }
    html.push('</tbody></table>')

    const edges = asList(diagram.edges)
    html.push('<h5>边</h5>')
    html.push('<table class="data-table edge-table">')
    html.push('<thead><tr><th>From</th><th>To</th><th>Label</th><th>Kind</th><th>Cardinality</th></tr></thead>')
    html.push('<tbody>')
    if (edges.length === 0) {
      html.push('<tr class="empty-row"><td colspan="5">（无）</td></tr>')
    } else {
      for (const edge of edges) {
        html.push('<tr>')
        html.push(`<td class="code">${escapeHtml(edge.from)}</td>`)
        html.push(`<td class="code">${escapeHtml(edge.to)}</td>`)
        html.push(`<td>${escapeHtml(edge.label)}</td>`)
        html.push(`<td>${escapeHtml(edge.kind)}</td>`)
        html.push(`<td>${escapeHtml(edge.cardinality)}</td>`)
        html.push('</tr>')
      }
    }
    html.push('</tbody></table>')
    html.push('</article>')
  }
  html.push('</section>')
  return html.join('\n')
}

function htmlLayer(model, layer, index, showRelations) {
  const html = [`<section class="layer" id="layer-${escapeAttribute(layer.id)}" data-layer="${escapeAttribute(layer.id)}">`]
  html.push('<header class="layer-header">')
  html.push(`<h2>层 ${escapeHtml(layer.letter)} · ${escapeHtml(layer.title)}</h2>`)
  if (showRelations) {
    html.push(`<p class="layer-meta">层路径：<code>${escapeHtml(layer.path)}</code></p>`)
    html.push(`<p class="layer-meta">父层：${escapeHtml(layer.parent)}</p>`)
  }
  html.push('</header>')
  html.push(htmlRequirements(model, layer, index))
  html.push(htmlModules(model, layer, index))
  html.push(htmlDiagrams(model, layer, index))
  html.push('</section>')
  return html.join('\n')
}

function htmlPayload(model, showRelations) {
  return {
    version: 1,
    title: model.title,
    scope: model.global ? 'global' : 'layer',
    scopeLabel: model.scopeLabel,
    exportedAt: model.exportedAt,
    counts: model.counts,
    layers: model.layerModels.map(layer => ({
      id: layer.id,
      title: layer.title,
      ...(showRelations ? { path: layer.path, parent: layer.parent } : {}),
      requirements: layer.sections.flatMap(section => section.items.map(item => ({
        code: requirementCode(item),
        text: requirementBody(item),
        module: moduleLabel(model.blueprint, requirementModule(item)),
      }))),
      modules: layer.modules.map(module => ({
        code: moduleCode(model.blueprint, module),
        name: asText(module.name ?? module.title ?? module.id),
        status: asText(module.status) || 'pending',
      })),
      diagrams: layer.diagrams.map(diagram => ({
        title: diagramTitle(diagram),
        type: diagramType(diagram),
        nodes: asList(diagram.nodes).length,
        edges: asList(diagram.edges).length,
      })),
    })),
  }
}

const STYLE = `
:root {
  color-scheme: light;
  --bg: #f7f8fc;
  --surface: #ffffff;
  --ink: #202533;
  --muted: #5d667a;
  --line: #dfe3ec;
  --accent: #3155d9;
  --accent-soft: #e8edff;
  --code: #f2f4f8;
  --warn: #9a5b00;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.skip { position: absolute; left: -9999px; top: 0; background: var(--surface); padding: 8px 12px; }
.skip:focus { left: 8px; top: 8px; z-index: 10; }
.export-header {
  padding: 40px max(24px, calc((100vw - 1160px) / 2)) 24px;
  background: linear-gradient(135deg, #1e2d5a, #3155d9);
  color: #fff;
}
.eyebrow { margin: 0 0 8px; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; opacity: .8; }
h1 { margin: 0 0 12px; font-size: clamp(28px, 4vw, 44px); line-height: 1.2; overflow-wrap: anywhere; }
.scope-line, .time-line, .stats-line { margin: 4px 0; opacity: .9; overflow-wrap: anywhere; }
.search {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}
.search label { font-weight: 600; }
.search input {
  flex: 1 1 280px;
  max-width: 520px;
  padding: 10px 14px;
  border: 1px solid rgba(255,255,255,.55);
  border-radius: 8px;
  background: rgba(255,255,255,.96);
  color: var(--ink);
  font: inherit;
}
.search input:focus { outline: 3px solid rgba(255,255,255,.45); outline-offset: 1px; }
#search-count { min-height: 1.6em; font-size: 13px; opacity: .9; }
.nav-bar {
  position: sticky;
  top: 0;
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  align-items: center;
  padding: 10px max(24px, calc((100vw - 1160px) / 2));
  border-bottom: 1px solid var(--line);
  background: rgba(255,255,255,.96);
  backdrop-filter: blur(8px);
  overflow-x: auto;
}
.nav-bar .nav-label { color: var(--muted); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.nav-bar a { white-space: nowrap; }
.toc { border-bottom: 1px solid var(--line); background: var(--surface); }
main { width: min(1160px, calc(100% - 32px)); margin: 24px auto 64px; }
.layer {
  margin: 0 0 28px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(24, 38, 77, .04);
}
.layer-header h2 { margin: 0 0 8px; font-size: 26px; }
.layer-meta { margin: 2px 0; color: var(--muted); overflow-wrap: anywhere; }
.layer-meta code { padding: 1px 6px; border-radius: 5px; background: var(--code); color: var(--ink); }
h3 { margin: 30px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--line); font-size: 20px; }
h4 { margin: 18px 0 8px; font-size: 16px; overflow-wrap: anywhere; }
h5 { margin: 14px 0 6px; color: var(--muted); font-size: 13px; text-transform: uppercase; letter-spacing: .05em; }
.requirement-section { margin: 0 0 16px; }
.data-table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 14px; }
.data-table th, .data-table td { padding: 8px 10px; border: 1px solid var(--line); text-align: left; vertical-align: top; }
.data-table th { background: #f0f3fa; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.data-table tr:nth-child(even) td { background: #fafbfe; }
.data-table .code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; white-space: nowrap; }
.empty-row td, .empty { color: var(--muted); font-style: italic; }
.status { display: inline-block; padding: 1px 7px; border-radius: 999px; background: #eef1f7; font-size: 12px; }
.status-confirmed { background: #e5f6ea; color: #17692f; }
.status-draft { background: #fff3d6; color: var(--warn); }
.status-dispatched { background: var(--accent-soft); color: var(--accent); }
.diagram-card { margin: 16px 0; padding: 16px; border: 1px solid var(--line); border-radius: 10px; background: #fcfdff; }
.diagram-card:target { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.badge { display: inline-block; padding: 1px 7px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 11px; font-weight: 600; vertical-align: middle; }
.mermaid-source { margin: 8px 0 12px; padding: 12px; overflow-x: auto; border: 1px solid #d5dbea; border-radius: 8px; background: #1f2430; color: #e9edf7; font: 12.5px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre; }
.diagram-description { color: var(--muted); }
ul { margin: 0; padding-left: 20px; }
footer { padding: 20px 16px 36px; text-align: center; color: var(--muted); font-size: 12px; }
[hidden] { display: none !important; }
@media (max-width: 680px) {
  .layer { padding: 16px; border-radius: 10px; }
  .data-table { display: block; overflow-x: auto; }
  .nav-bar { position: static; }
}
`

const SEARCH_SCRIPT = `
(function () {
  var input = document.getElementById('search');
  if (!input) return;
  var count = document.getElementById('search-count');
  var items = Array.prototype.slice.call(document.querySelectorAll('[data-search-item]'));
  function apply() {
    var query = input.value.trim().toLowerCase();
    var visible = 0;
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var haystack = (item.getAttribute('data-search') || item.textContent || '').toLowerCase();
      var match = query === '' || haystack.indexOf(query) !== -1;
      item.hidden = !match;
      if (match && query !== '') visible += 1;
    }
    if (count) count.textContent = query === '' ? '' : visible + ' 项匹配';
  }
  input.addEventListener('input', apply);
  input.addEventListener('search', apply);
})();
`

function htmlNavigation(model) {
  const layerLinks = model.layerModels
    .map(layer => `<a href="#layer-${escapeAttribute(layer.id)}">${escapeHtml(layer.letter)} · ${escapeHtml(layer.title)}</a>`)
    .join('\n')
  const first = model.layerModels[0]
  const sectionLinks = first === undefined
    ? ''
    : [
        `<a href="#requirements">需求</a>`,
        `<a href="#modules">模块</a>`,
        `<a href="#diagrams">图</a>`,
      ].join('\n')
  return {
    toc: `<nav id="toc" class="nav-bar toc" aria-label="目录">\n<span class="nav-label">目录</span>\n${sectionLinks}\n${layerLinks}\n</nav>`,
    layerNav: `<nav id="layer-nav" class="nav-bar layer-nav" aria-label="层导航">\n<span class="nav-label">层导航</span>\n${layerLinks}\n</nav>`,
  }
}

/**
 * Build a single-file, offline HTML export. Everything (styles, navigation,
 * search script and data) is inlined; no CDN, font or image URL is referenced.
 */
export function exportHtml(blueprint, options = {}) {
  const model = buildModel(blueprint, options)
  const navigation = htmlNavigation(model)
  const showRelations = model.global || model.includeDescendants
  const body = model.layerModels.map((layer, index) => htmlLayer(model, layer, index, showRelations)).join('\n')
  const payload = safeJson(htmlPayload(model, showRelations))
  const title = escapeHtml(`${model.title} · 蓝图导出`)
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Blueprint Studio offline export">
<title>${title}</title>
<style>${STYLE}</style>
</head>
<body>
<a class="skip" href="#main">跳到正文</a>
<header class="export-header">
<p class="eyebrow">Blueprint Studio · 蓝图导出</p>
<h1>${escapeHtml(model.title)}</h1>
<p class="scope-line">范围：${escapeHtml(model.scopeLabel)}</p>
<p class="time-line">导出时间：${escapeHtml(model.exportedAt)}</p>
<p class="stats-line">统计：层 ${model.counts.layers} · 需求 ${model.counts.requirements} · 模块 ${model.counts.modules} · 图 ${model.counts.diagrams} · 节点 ${model.counts.nodes} · 边 ${model.counts.edges}</p>
<div class="search">
<label for="search">搜索</label>
<input id="search" type="search" placeholder="搜索需求、模块、图或节点…" autocomplete="off">
<span id="search-count" aria-live="polite"></span>
</div>
</header>
${navigation.layerNav}
${navigation.toc}
<main id="main">
${body}
</main>
<footer>由 Blueprint Studio 离线导出 · 单文件，无外部依赖</footer>
<script>window.__BLUEPRINT_EXPORT__ = ${payload};</script>
<script>${SEARCH_SCRIPT}</script>
</body>
</html>
`
  const size = new TextEncoder().encode(html).byteLength
  if (size > EXPORT_MAX_BYTES) {
    throw new ExportTooLargeError(size)
  }
  return html
}
