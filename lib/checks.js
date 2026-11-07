// Blueprint Studio v0.4 self-check and requirement/module coverage analysis.
//
// Pure functions only: no I/O, no runtime dependencies and no mutation of the
// input blueprint. The analyzer is deliberately tolerant: malformed data is
// reported as an issue and degraded to empty/partial coverage instead of
// throwing. Normalized blueprints (lib/blueprint.js) and hand-written or raw
// agent payloads can both be inspected.

const MODULE_CODE_PATTERN = /^([A-Z]+)([1-9]\d*)$/u

// Nodes of these types are legitimate without any edge, e.g. a system boundary,
// an initial state or a final state.
const ISOLATED_NODE_EXEMPT = new Set(['system', 'initial', 'final'])

// Public catalog of the checks. Each rule has exactly one severity so a report
// can be explained without reading the implementation.
export const CHECK_RULES = Object.freeze([
  { code: 'edge-broken', severity: 'error', title: '连线端点不存在' },
  { code: 'module-dep-cycle', severity: 'error', title: '模块依赖环' },
  { code: 'module-dep-missing', severity: 'error', title: '依赖指向不存在的模块' },
  { code: 'module-code-invalid', severity: 'error', title: '模块 code 非法' },
  { code: 'module-code-duplicate', severity: 'error', title: '模块 code 冲突' },
  { code: 'module-layer-missing', severity: 'error', title: '模块所在层不存在' },
  { code: 'layer-parent-missing', severity: 'error', title: '层的父模块不存在' },
  { code: 'requirement-module-missing', severity: 'error', title: '需求指向不存在的模块' },
  { code: 'node-module-missing', severity: 'error', title: '节点 moduleId 指向不存在的模块' },
  { code: 'node-isolated', severity: 'warn', title: '孤立节点' },
  { code: 'node-duplicate', severity: 'warn', title: '同图重复节点' },
  { code: 'usecase-no-actor', severity: 'warn', title: '用例图缺少角色' },
  { code: 'dfd-process-unbalanced', severity: 'warn', title: '数据流 process 缺少输入或输出' },
  { code: 'requirement-unassigned', severity: 'warn', title: '需求没有模块承接' },
  { code: 'module-acceptance-missing', severity: 'warn', title: '模块缺少验收标准' },
  { code: 'module-verification-incomplete', severity: 'error', title: '模块完成但分层验证未全部通过' },
  { code: 'layer-empty', severity: 'warn', title: '层内没有子模块却可进入' },
  { code: 'module-no-requirement', severity: 'info', title: '模块没有承接任何需求' },
  { code: 'analysis-failed', severity: 'error', title: '自检分析失败' },
])

const SEVERITY_BY_CODE = new Map(CHECK_RULES.map(rule => [rule.code, rule.severity]))
const SEVERITY_RANK = Object.freeze({ error: 0, warn: 1, info: 2 })

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function text(value) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function lower(value) {
  return text(value).toLowerCase()
}

function firstText(...values) {
  for (const value of values) {
    const result = text(value)
    if (result !== '') return result
  }
  return ''
}

function stringEntries(value) {
  if (typeof value === 'string') {
    const single = value.trim()
    return single === '' ? [] : [single]
  }
  const result = []
  for (const entry of list(value)) {
    if (typeof entry === 'string') {
      const item = entry.trim()
      if (item !== '') result.push(item)
      continue
    }
    if (isRecord(entry)) {
      const item = firstText(entry.text, entry.label, entry.title, entry.name, entry.summary)
      if (item !== '') result.push(item)
    }
  }
  return result
}

function sourceSections(blueprint) {
  const sections = []
  for (const entry of list(blueprint.sections)) {
    if (!isRecord(entry)) continue
    const key = firstText(entry.key, entry.title, entry.name) || `section-${sections.length + 1}`
    sections.push({ key, items: list(entry.items ?? entry.requirements) })
  }
  if (sections.length === 0 && Array.isArray(blueprint.requirements)) {
    sections.push({ key: 'requirements', items: blueprint.requirements })
  }
  return sections
}

function requirementOf(sectionKey, entry, index) {
  if (typeof entry === 'string') {
    const body = entry.trim()
    if (body === '') return undefined
    const id = `i${index + 1}`
    return {
      uid: `${sectionKey}:${id}`,
      code: '',
      text: body,
      moduleId: '',
    }
  }
  if (!isRecord(entry)) return undefined
  const body = firstText(entry.text, entry.label, entry.title, entry.value, entry.name)
  if (body === '') return undefined
  const id = text(entry.id) || `i${index + 1}`
  return {
    uid: text(entry.uid) || `${sectionKey}:${id}`,
    code: text(entry.code),
    text: body,
    moduleId: text(entry.moduleId),
  }
}

function sourceModules(blueprint) {
  const raw = blueprint.modules
  if (Array.isArray(raw)) return raw.filter(isRecord)
  if (isRecord(raw)) {
    return Object.entries(raw).map(([id, value]) => ({ id, ...(isRecord(value) ? value : {}) }))
  }
  return []
}

const VERIFICATION_ROLES = ['tests', 'reviewer', 'human']
const VERIFICATION_STATUSES = new Set(['pending', 'passed', 'failed'])

function verificationOf(raw) {
  const value = isRecord(raw) ? raw : {}
  const verification = {}
  for (const role of VERIFICATION_ROLES) {
    const entry = isRecord(value[role]) ? value[role] : {}
    const status = lower(entry.status)
    verification[role] = VERIFICATION_STATUSES.has(status) ? status : 'pending'
  }
  return verification
}

function verificationPassed(verification) {
  return VERIFICATION_ROLES.every(role => verification[role] === 'passed')
}

function moduleOf(entry, index) {
  const moduleId = text(entry.id) || `module-${index + 1}`
  const code = text(entry.code).toUpperCase()
  const layerId = (text(entry.layerId ?? entry.layer) || 'A').toUpperCase()
  return {
    moduleId,
    code,
    name: firstText(entry.name, entry.title, entry.label) || code || moduleId,
    layerId,
    status: lower(entry.status) || 'pending',
    dependsOn: stringEntries(entry.dependsOn ?? entry.deps),
    acceptance: stringEntries(entry.acceptance ?? entry.acceptanceCriteria),
    verification: verificationOf(entry.verification),
  }
}

function sourceLayers(blueprint, hasModules) {
  const raw = blueprint.layers
  const layers = []
  const push = (value, fallbackId) => {
    if (typeof value === 'string') {
      layers.push({
        layerId: (fallbackId || value).toUpperCase(),
        title: value,
        parentModuleId: '',
      })
      return
    }
    if (!isRecord(value)) return
    const layerId = (text(value.id ?? value.letter) || fallbackId).toUpperCase()
    if (layerId === '') return
    layers.push({
      layerId,
      title: firstText(value.title, value.name) || layerId,
      parentModuleId: text(value.parentModuleId ?? value.parent),
    })
  }

  if (Array.isArray(raw)) {
    for (const entry of raw) push(entry, '')
  } else if (isRecord(raw)) {
    for (const [key, value] of Object.entries(raw)) push(value, key)
  }

  if (layers.length === 0 && hasModules) {
    layers.push({ layerId: 'A', title: '总览', parentModuleId: '' })
  }
  return layers
}

function sourceDiagrams(blueprint) {
  const raw = blueprint.diagrams
  const entries = Array.isArray(raw)
    ? raw
    : isRecord(raw)
      ? Object.entries(raw).map(([key, value]) => ({ key, ...(isRecord(value) ? value : {}) }))
      : []
  const diagrams = []
  for (const entry of entries) {
    if (!isRecord(entry)) continue
    const key = text(entry.key) || `diagram-${diagrams.length + 1}`
    const keyParts = key.includes(':') ? key.split(':') : []
    const layerId = (text(entry.layerId ?? entry.layer)
      || (keyParts.length > 1 ? keyParts[0] : '')
      || 'A').toUpperCase()
    const type = (text(entry.type) || (keyParts.length > 0 ? keyParts[keyParts.length - 1] : '')).toLowerCase()
    const nodes = list(entry.nodes).filter(isRecord).map((node, index) => ({
      nodeId: text(node.id) || `n${index + 1}`,
      type: text(node.type).toLowerCase(),
      label: firstText(node.label, node.name, node.title),
      moduleId: text(node.moduleId),
    }))
    const edges = list(entry.edges ?? entry.links).filter(isRecord).map((edge, index) => ({
      edgeId: text(edge.id) || `e${index + 1}`,
      from: text(edge.from ?? edge.source ?? edge.fromId ?? edge.start),
      to: text(edge.to ?? edge.target ?? edge.toId ?? edge.end),
    }))
    diagrams.push({ key, layerId, type, nodes, edges })
  }
  return diagrams
}

function buildModel(blueprint) {
  const source = isRecord(blueprint) ? blueprint : {}
  const requirements = []
  for (const section of sourceSections(source)) {
    for (const [index, entry] of section.items.entries()) {
      const requirement = requirementOf(section.key, entry, index)
      if (requirement !== undefined) requirements.push(requirement)
    }
  }
  const modules = sourceModules(source).map(moduleOf)
  const layers = sourceLayers(source, modules.length > 0)
  const diagrams = sourceDiagrams(source)

  const moduleById = new Map()
  const moduleByRef = new Map()
  for (const module of modules) {
    if (!moduleById.has(module.moduleId)) moduleById.set(module.moduleId, module)
    for (const ref of [module.moduleId, module.code, module.name]) {
      const normalized = lower(ref)
      if (normalized !== '' && !moduleByRef.has(normalized)) moduleByRef.set(normalized, module.moduleId)
    }
  }
  const layerById = new Map()
  for (const layer of layers) {
    if (!layerById.has(layer.layerId)) layerById.set(layer.layerId, layer)
  }

  return { layers, modules, requirements, diagrams, moduleById, moduleByRef, layerById }
}

function emptyCoverage() {
  return {
    layers: [],
    modules: [],
    global: {
      totalRequirements: 0,
      coveredRequirements: 0,
      unassignedRequirements: [],
      modulesWithoutRequirements: [],
      modulesMissingAcceptance: [],
      layersWithoutModules: [],
      parentLayersWithoutChildModules: [],
    },
  }
}

function coverageFor(model) {
  const requirementsByModule = new Map()
  for (const requirement of model.requirements) {
    if (requirement.moduleId === '' || !model.moduleById.has(requirement.moduleId)) continue
    const assigned = requirementsByModule.get(requirement.moduleId)
    if (assigned === undefined) requirementsByModule.set(requirement.moduleId, [requirement])
    else assigned.push(requirement)
  }

  const moduleCoverage = model.modules.map(module => {
    const assigned = requirementsByModule.get(module.moduleId) ?? []
    return {
      moduleId: module.moduleId,
      code: module.code,
      name: module.name,
      layerId: module.layerId,
      requirementCount: assigned.length,
      requirementUids: assigned.map(requirement => requirement.uid),
      hasAcceptance: module.acceptance.length > 0,
    }
  })

  const layers = model.layers.map((layer, layerIndex) => {
    const layerModules = moduleCoverage.filter(module => module.layerId === layer.layerId)
    const requirementCount = layerModules.reduce((sum, module) => sum + module.requirementCount, 0)
    // Requirements are attributed to a layer only through moduleId, so every
    // directly attributed requirement is also a covered one. The two columns are
    // kept separate because they answer different questions in the report.
    const coveredRequirementCount = requirementCount
    const missingAcceptance = layerModules.filter(module => !module.hasAcceptance).length
    const withoutRequirements = layerModules.filter(module => module.requirementCount === 0).length
    const childLayerCount = model.layers.filter(other =>
      other.layerId !== layer.layerId
      && model.moduleById.get(other.parentModuleId)?.layerId === layer.layerId).length
    return {
      layerId: layer.layerId,
      title: layer.title,
      parentModuleId: layer.parentModuleId || null,
      index: layerIndex,
      moduleCount: layerModules.length,
      modules: layerModules,
      requirementCount,
      coveredRequirementCount,
      modulesMissingAcceptance: missingAcceptance,
      modulesWithoutRequirements: withoutRequirements,
      childLayerCount,
    }
  })

  const unassignedRequirements = model.requirements
    .filter(requirement => requirement.moduleId === '' || !model.moduleById.has(requirement.moduleId))
    .map(requirement => ({
      uid: requirement.uid,
      code: requirement.code,
      text: requirement.text,
      moduleId: requirement.moduleId || null,
    }))

  const modulesWithoutRequirements = moduleCoverage
    .filter(module => module.requirementCount === 0)
    .map(module => ({
      moduleId: module.moduleId,
      code: module.code,
      name: module.name,
      layerId: module.layerId,
    }))

  const modulesMissingAcceptance = moduleCoverage
    .filter(module => !module.hasAcceptance)
    .map(module => ({
      moduleId: module.moduleId,
      code: module.code,
      name: module.name,
      layerId: module.layerId,
    }))

  const layersWithoutModules = layers
    .filter(layer => layer.moduleCount === 0)
    .map(layer => ({ layerId: layer.layerId, title: layer.title }))

  const parentLayerIds = new Set(layers.filter(layer => layer.childLayerCount > 0).map(layer => layer.layerId))
  const parentLayersWithoutChildModules = layers
    .filter(layer => parentLayerIds.has(layer.layerId) && layer.moduleCount === 0)
    .map(layer => ({ layerId: layer.layerId, title: layer.title }))

  return {
    layers,
    modules: moduleCoverage,
    global: {
      totalRequirements: model.requirements.length,
      coveredRequirements: model.requirements.length - unassignedRequirements.length,
      unassignedRequirements,
      modulesWithoutRequirements,
      modulesMissingAcceptance,
      layersWithoutModules,
      parentLayersWithoutChildModules,
    },
  }
}

function makeIssue(code, message, fields = {}) {
  const issue = {
    code,
    severity: SEVERITY_BY_CODE.get(code) ?? 'info',
    message,
  }
  for (const key of ['layerId', 'moduleId', 'diagramKey', 'requirementUid']) {
    if (fields[key] !== undefined && fields[key] !== null && fields[key] !== '') issue[key] = fields[key]
  }
  if (fields.details !== undefined) issue.details = fields.details
  return issue
}

function resolveModuleRef(model, value) {
  const key = text(value)
  if (key === '') return undefined
  if (model.moduleById.has(key)) return key
  return model.moduleByRef.get(key.toLowerCase())
}

function nodeResolver(nodes) {
  const ids = new Set(nodes.map(node => node.nodeId))
  const labels = new Map()
  for (const node of nodes) {
    const normalized = node.label.toLowerCase()
    if (normalized !== '' && !labels.has(normalized)) labels.set(normalized, node.nodeId)
  }
  return value => {
    const key = text(value)
    if (key === '') return undefined
    if (ids.has(key)) return key
    return labels.get(key.toLowerCase())
  }
}

function diagramIssues(model, diagram) {
  const issues = []
  const { nodes, edges, key, layerId, type } = diagram
  const resolve = nodeResolver(nodes)
  const incoming = new Map()
  const outgoing = new Map()

  for (const edge of edges) {
    const from = resolve(edge.from)
    const to = resolve(edge.to)
    const missing = []
    if (from === undefined) missing.push('from')
    if (to === undefined) missing.push('to')
    if (missing.length > 0) {
      issues.push(makeIssue(
        'edge-broken',
        `图 ${key} 的连线 ${edge.edgeId} 指向不存在的节点（${missing.join('/')}）。`,
        {
          layerId,
          diagramKey: key,
          details: { edgeId: edge.edgeId, from: edge.from, to: edge.to, missing },
        },
      ))
      // A broken edge does not connect anything, so it must not satisfy a
      // process's input or output requirement.
      continue
    }
    outgoing.set(from, (outgoing.get(from) ?? 0) + 1)
    incoming.set(to, (incoming.get(to) ?? 0) + 1)
  }

  for (const node of nodes) {
    const degree = (incoming.get(node.nodeId) ?? 0) + (outgoing.get(node.nodeId) ?? 0)
    if (degree === 0 && !ISOLATED_NODE_EXEMPT.has(node.type)) {
      issues.push(makeIssue(
        'node-isolated',
        `图 ${key} 中的节点“${node.label || node.nodeId}”没有任何连线。`,
        {
          layerId,
          diagramKey: key,
          details: { nodeId: node.nodeId, label: node.label, type: node.type },
        },
      ))
    }
    if (node.moduleId !== '' && !model.moduleById.has(node.moduleId)) {
      issues.push(makeIssue(
        'node-module-missing',
        `图 ${key} 中的节点“${node.label || node.nodeId}”指向不存在的模块 ${node.moduleId}。`,
        {
          layerId,
          moduleId: node.moduleId,
          diagramKey: key,
          details: { nodeId: node.nodeId, moduleId: node.moduleId, label: node.label },
        },
      ))
    }
  }

  const duplicates = new Map()
  for (const node of nodes) {
    if (node.label === '') continue
    const signature = `${node.label.toLowerCase()}\u0000${node.type}`
    const group = duplicates.get(signature)
    if (group === undefined) duplicates.set(signature, [node])
    else group.push(node)
  }
  for (const group of duplicates.values()) {
    if (group.length < 2) continue
    issues.push(makeIssue(
      'node-duplicate',
      `图 ${key} 中有 ${group.length} 个同为“${group[0].label}”（${group[0].type}）的节点。`,
      {
        layerId,
        diagramKey: key,
        details: {
          label: group[0].label,
          type: group[0].type,
          nodeIds: group.map(node => node.nodeId),
        },
      },
    ))
  }

  if (type === 'usecase') {
    const hasUsecase = nodes.some(node => node.type === 'usecase')
    const hasActor = nodes.some(node => node.type === 'actor')
    if (hasUsecase && !hasActor) {
      issues.push(makeIssue(
        'usecase-no-actor',
        `用例图 ${key} 有用例但没有角色（actor）。`,
        {
          layerId,
          diagramKey: key,
          details: { usecaseCount: nodes.filter(node => node.type === 'usecase').length },
        },
      ))
    }
  }

  if (type === 'dfd') {
    for (const node of nodes) {
      if (node.type !== 'process') continue
      const missingInput = (incoming.get(node.nodeId) ?? 0) === 0
      const missingOutput = (outgoing.get(node.nodeId) ?? 0) === 0
      if (!missingInput && !missingOutput) continue
      const missing = [missingInput ? '输入' : '', missingOutput ? '输出' : ''].filter(Boolean).join('和')
      issues.push(makeIssue(
        'dfd-process-unbalanced',
        `数据流图 ${key} 的 process“${node.label || node.nodeId}”缺少${missing}。`,
        {
          layerId,
          diagramKey: key,
          details: {
            nodeId: node.nodeId,
            label: node.label,
            missingInput,
            missingOutput,
          },
        },
      ))
    }
  }

  return issues
}

function dependencyCycles(model) {
  const graph = new Map()
  for (const module of model.modules) {
    if (graph.has(module.moduleId)) continue
    const targets = []
    for (const dependency of module.dependsOn) {
      const target = resolveModuleRef(model, dependency)
      if (target !== undefined && !targets.includes(target)) targets.push(target)
    }
    graph.set(module.moduleId, targets)
  }

  let nextIndex = 0
  const indices = new Map()
  const lowLinks = new Map()
  const onStack = new Set()
  const stack = []
  const components = []

  const strongConnect = vertex => {
    indices.set(vertex, nextIndex)
    lowLinks.set(vertex, nextIndex)
    nextIndex += 1
    stack.push(vertex)
    onStack.add(vertex)

    for (const target of graph.get(vertex) ?? []) {
      if (!indices.has(target)) {
        strongConnect(target)
        lowLinks.set(vertex, Math.min(lowLinks.get(vertex), lowLinks.get(target)))
      } else if (onStack.has(target)) {
        lowLinks.set(vertex, Math.min(lowLinks.get(vertex), indices.get(target)))
      }
    }

    if (lowLinks.get(vertex) !== indices.get(vertex)) return
    const component = []
    for (;;) {
      const member = stack.pop()
      onStack.delete(member)
      component.push(member)
      if (member === vertex) break
    }
    const selfLoop = component.length === 1 && (graph.get(component[0]) ?? []).includes(component[0])
    if (component.length > 1 || selfLoop) components.push(component)
  }

  for (const vertex of graph.keys()) {
    if (!indices.has(vertex)) strongConnect(vertex)
  }
  return components
}

function moduleIssues(model, coverage) {
  const issues = []
  const codeGroups = new Map()

  for (const module of model.modules) {
    const match = MODULE_CODE_PATTERN.exec(module.code)
    if (match === null || match[1] !== module.layerId) {
      issues.push(makeIssue(
        'module-code-invalid',
        module.code === ''
          ? `模块 ${module.name} 缺少合法 code（应为 ${module.layerId} + 序号）。`
          : `模块 ${module.name} 的 code ${module.code} 非法（应为 ${module.layerId} + 序号）。`,
        {
          layerId: module.layerId,
          moduleId: module.moduleId,
          details: { code: module.code, expectedPrefix: module.layerId },
        },
      ))
    }
    if (module.code !== '') {
      const group = codeGroups.get(module.code)
      if (group === undefined) codeGroups.set(module.code, [module])
      else group.push(module)
    }

    if (!model.layerById.has(module.layerId)) {
      issues.push(makeIssue(
        'module-layer-missing',
        `模块 ${module.name} 所在的层 ${module.layerId} 不存在。`,
        {
          layerId: module.layerId,
          moduleId: module.moduleId,
          details: { layerId: module.layerId },
        },
      ))
    }

    if (module.acceptance.length === 0) {
      issues.push(makeIssue(
        'module-acceptance-missing',
        `模块 ${module.name}（${module.code || module.moduleId}）缺少验收标准。`,
        { layerId: module.layerId, moduleId: module.moduleId, details: { code: module.code, name: module.name } },
      ))
    } else if (module.status === 'done' && !verificationPassed(module.verification)) {
      // Only one issue per module: a module with no acceptance criteria is already
      // reported by module-acceptance-missing, so verification does not double-report it.
      const pending = VERIFICATION_ROLES.filter(role => module.verification[role] !== 'passed')
      issues.push(makeIssue(
        'module-verification-incomplete',
        `模块 ${module.name}（${module.code || module.moduleId}）状态为 done，但分层验证未全部通过：${pending.map(role => `${role}=${module.verification[role]}`).join('、')}。`,
        {
          layerId: module.layerId,
          moduleId: module.moduleId,
          details: {
            code: module.code,
            name: module.name,
            status: module.status,
            verification: module.verification,
            notPassed: pending,
          },
        },
      ))
    }

    const missing = module.dependsOn.filter(dependency => resolveModuleRef(model, dependency) === undefined)
    if (missing.length > 0) {
      issues.push(makeIssue(
        'module-dep-missing',
        `模块 ${module.name} 的依赖不存在：${missing.join('、')}。`,
        {
          layerId: module.layerId,
          moduleId: module.moduleId,
          details: { dependsOn: module.dependsOn, missing },
        },
      ))
    }
  }

  for (const [code, group] of codeGroups) {
    if (group.length < 2) continue
    issues.push(makeIssue(
      'module-code-duplicate',
      `模块 code ${code} 被 ${group.length} 个模块重复使用。`,
      {
        layerId: group[0].layerId,
        moduleId: group[0].moduleId,
        details: { code, moduleIds: group.map(module => module.moduleId) },
      },
    ))
  }

  for (const component of dependencyCycles(model)) {
    const path = [...component, component[0]].map(id => {
      const module = model.moduleById.get(id)
      return module?.code || module?.name || id
    })
    issues.push(makeIssue(
      'module-dep-cycle',
      `模块依赖存在环：${path.join(' → ')}。`,
      {
        layerId: model.moduleById.get(component[0])?.layerId,
        moduleId: component[0],
        details: { moduleIds: component, cycle: path },
      },
    ))
  }

  for (const module of coverage.modules) {
    if (module.requirementCount > 0) continue
    issues.push(makeIssue(
      'module-no-requirement',
      `模块 ${module.name}（${module.code || module.moduleId}）没有承接任何需求。`,
      { layerId: module.layerId, moduleId: module.moduleId, details: { code: module.code, name: module.name } },
    ))
  }

  return issues
}

function layerIssues(model) {
  const issues = []
  for (const layer of model.layers) {
    if (layer.parentModuleId !== '' && resolveModuleRef(model, layer.parentModuleId) === undefined) {
      issues.push(makeIssue(
        'layer-parent-missing',
        `层 ${layer.layerId}（${layer.title}）的父模块 ${layer.parentModuleId} 不存在。`,
        {
          layerId: layer.layerId,
          moduleId: layer.parentModuleId,
          details: { parentModuleId: layer.parentModuleId },
        },
      ))
    }
    const moduleCount = model.modules.filter(module => module.layerId === layer.layerId).length
    if (moduleCount === 0) {
      issues.push(makeIssue(
        'layer-empty',
        `层 ${layer.layerId}（${layer.title}）没有子模块却可进入。`,
        { layerId: layer.layerId, details: { title: layer.title } },
      ))
    }
  }
  return issues
}

function requirementIssues(model) {
  const issues = []
  for (const requirement of model.requirements) {
    if (requirement.moduleId === '') {
      issues.push(makeIssue(
        'requirement-unassigned',
        `需求 ${requirement.code || requirement.uid}“${requirement.text}”没有模块承接。`,
        {
          requirementUid: requirement.uid,
          details: { code: requirement.code, text: requirement.text, reason: 'missing' },
        },
      ))
      continue
    }
    if (!model.moduleById.has(requirement.moduleId)) {
      issues.push(makeIssue(
        'requirement-module-missing',
        `需求 ${requirement.code || requirement.uid}“${requirement.text}”指向不存在的模块 ${requirement.moduleId}。`,
        {
          moduleId: requirement.moduleId,
          requirementUid: requirement.uid,
          details: { moduleId: requirement.moduleId, code: requirement.code, text: requirement.text, reason: 'unknown' },
        },
      ))
    }
  }
  return issues
}

function collectIssues(model, coverage) {
  const issues = []
  for (const diagram of model.diagrams) issues.push(...diagramIssues(model, diagram))
  issues.push(...moduleIssues(model, coverage))
  issues.push(...layerIssues(model))
  issues.push(...requirementIssues(model))
  issues.sort((left, right) =>
    (SEVERITY_RANK[left.severity] ?? 9) - (SEVERITY_RANK[right.severity] ?? 9)
    || left.code.localeCompare(right.code)
    || text(left.diagramKey).localeCompare(text(right.diagramKey))
    || text(left.moduleId).localeCompare(text(right.moduleId))
    || text(left.requirementUid).localeCompare(text(right.requirementUid)))
  return issues
}

function summarize(issues) {
  const summary = { error: 0, warn: 0, info: 0 }
  for (const issue of issues) {
    if (issue.severity === 'error' || issue.severity === 'warn' || issue.severity === 'info') {
      summary[issue.severity] += 1
    }
  }
  return summary
}

// Requirement coverage grouped by layer and module. A requirement belongs to a
// module only through `moduleId`; legacy items without it (or with an id that no
// longer exists) are reported as unassigned.
export function coverageMatrix(blueprint) {
  try {
    return coverageFor(buildModel(blueprint))
  } catch {
    return emptyCoverage()
  }
}

// Full self-check. Returns issues plus the coverage matrix and severity totals.
// Never throws: a catastrophic input degrades to an `analysis-failed` issue.
export function analyzeBlueprint(blueprint) {
  let model
  try {
    model = buildModel(blueprint)
  } catch {
    model = buildModel(undefined)
  }

  let coverage
  try {
    coverage = coverageFor(model)
  } catch {
    coverage = emptyCoverage()
  }

  let issues
  try {
    issues = collectIssues(model, coverage)
  } catch (error) {
    issues = [makeIssue(
      'analysis-failed',
      `自检分析失败：${String(error?.message ?? error ?? 'unknown error')}`,
      { details: { message: String(error?.message ?? error ?? '') } },
    )]
  }

  return {
    issues,
    coverage,
    summary: summarize(issues),
  }
}
