import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * 蓝图模板库：用户模板存放在 `.dsh/blueprints/templates/<id>.json`，
 * 社区模板随仓库发布在 `<repo>/templates/`（`index.json` + 每个模板一个 JSON）。
 *
 * 模板只保存可复用的蓝图片段（title/summary/prompt/sections/diagrams/modules/mounts），
 * 不含 sessionId、状态、验证记录等运行时字段。
 */

export const TEMPLATE_MAX_BYTES = 512 * 1024
const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/

export function slugifyTemplateId(name) {
  const slug = String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  if (/^[a-z0-9-]+$/.test(slug) && slug.length >= 2) return slug
  return `tpl-${Date.now().toString(36)}`
}

function textOf(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function listOf(value) {
  return Array.isArray(value) ? value : []
}

/** 只保留可复用的蓝图片段，剥离运行时字段。 */
export function pickTemplateBlueprint(input) {
  const source = input && typeof input === 'object' ? input : {}
  const blueprint = {
    title: textOf(source.title),
    summary: textOf(source.summary),
    prompt: textOf(source.prompt),
    sections: listOf(source.sections).map(section => ({
      key: textOf(section?.key),
      title: textOf(section?.title),
      items: listOf(section?.items).map(item => ({
        ...(textOf(item?.id) ? { id: textOf(item.id) } : {}),
        ...(textOf(item?.uid) ? { uid: textOf(item.uid) } : {}),
        ...(textOf(item?.code) ? { code: textOf(item.code) } : {}),
        text: textOf(item?.text),
        ...(textOf(item?.moduleId) ? { moduleId: textOf(item.moduleId) } : {}),
      })),
    })),
    diagrams: listOf(source.diagrams).map(diagram => ({
      key: textOf(diagram?.key),
      layerId: textOf(diagram?.layerId) || 'A',
      type: textOf(diagram?.type),
      title: textOf(diagram?.title),
      nodes: listOf(diagram?.nodes).map(node => ({
        id: textOf(node?.id),
        type: textOf(node?.type),
        label: textOf(node?.label),
        ...(textOf(node?.technology) ? { technology: textOf(node.technology) } : {}),
        ...(textOf(node?.description) ? { description: textOf(node.description) } : {}),
        ...(textOf(node?.parentGroup) ? { parentGroup: textOf(node.parentGroup) } : {}),
        ...(textOf(node?.condition) ? { condition: textOf(node.condition) } : {}),
        ...(listOf(node?.fields).length > 0 ? { fields: node.fields } : {}),
      })),
      edges: listOf(diagram?.edges).map(edge => ({
        from: textOf(edge?.from),
        to: textOf(edge?.to),
        ...(textOf(edge?.label) ? { label: textOf(edge.label) } : {}),
        ...(textOf(edge?.kind) ? { kind: textOf(edge.kind) } : {}),
        ...(textOf(edge?.cardinality) ? { cardinality: textOf(edge.cardinality) } : {}),
      })),
    })),
    modules: listOf(source.modules).map(module => ({
      id: textOf(module?.id),
      name: textOf(module?.name),
      layerId: textOf(module?.layerId) || 'A',
      code: textOf(module?.code),
      ...(textOf(module?.parentId) ? { parentId: textOf(module.parentId) } : {}),
      ...(textOf(module?.summary) ? { summary: textOf(module.summary) } : {}),
      ...(listOf(module?.dependsOn).length > 0 ? { dependsOn: listOf(module.dependsOn).map(textOf) } : {}),
      ...(listOf(module?.mountIds).length > 0 ? { mountIds: listOf(module.mountIds).map(textOf) } : {}),
      ...(listOf(module?.files).length > 0 ? { files: listOf(module.files).map(textOf) } : {}),
      ...(listOf(module?.acceptance).length > 0 ? { acceptance: listOf(module.acceptance).map(textOf) } : {}),
      ...(module?.execution && typeof module.execution === 'object' ? { execution: module.execution } : {}),
    })),
    ...(listOf(source.mounts).length > 0
      ? {
          mounts: listOf(source.mounts).map(mount => ({
            id: textOf(mount?.id),
            label: textOf(mount?.label),
            root: textOf(mount?.root),
            kind: textOf(mount?.kind) || 'working',
            access: textOf(mount?.access) || 'ro',
            ...(textOf(mount?.ref) ? { ref: textOf(mount.ref) } : {}),
            ...(textOf(mount?.checksum) ? { checksum: textOf(mount.checksum) } : {}),
          })),
        }
      : {}),
  }
  return blueprint
}

export function validateTemplate(input) {
  const errors = []
  const name = textOf(input?.name)
  if (name === '') errors.push('模板名称不能为空。')
  if (name.length > 80) errors.push('模板名称不能超过 80 个字符。')
  const blueprint = input?.blueprint
  if (!blueprint || typeof blueprint !== 'object' || Array.isArray(blueprint)) {
    errors.push('模板缺少 blueprint 对象。')
  } else {
    if (listOf(blueprint.sections).length === 0 && listOf(blueprint.diagrams).length === 0 && listOf(blueprint.modules).length === 0) {
      errors.push('模板至少要包含 sections、diagrams 或 modules 之一。')
    }
  }
  let size = 0
  try {
    size = Buffer.byteLength(JSON.stringify(input), 'utf8')
  } catch {
    errors.push('模板无法序列化为 JSON。')
  }
  if (size > TEMPLATE_MAX_BYTES) errors.push(`模板过大（${size} 字节，上限 ${TEMPLATE_MAX_BYTES}）。`)
  return { ok: errors.length === 0, errors }
}

export function normalizeTemplate(input, { id } = {}) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const name = textOf(raw.name)
  const candidate = {
    id: textOf(id) || (ID_RE.test(textOf(raw.id)) ? textOf(raw.id) : slugifyTemplateId(name)),
    name,
    description: textOf(raw.description),
    domain: textOf(raw.domain) || 'general',
    tags: listOf(raw.tags).map(textOf).filter(Boolean).slice(0, 12),
    author: textOf(raw.author),
    version: textOf(raw.version) || '1.0.0',
    createdAt: textOf(raw.createdAt),
    updatedAt: new Date().toISOString(),
    blueprint: pickTemplateBlueprint(raw.blueprint ?? raw),
  }
  if (!ID_RE.test(candidate.id)) candidate.id = slugifyTemplateId(name)
  const check = validateTemplate(candidate)
  if (!check.ok) {
    const error = new Error(`模板不合法：${check.errors.join('；')}`)
    error.details = check.errors
    throw error
  }
  return candidate
}

export class TemplateStore {
  constructor(dir) {
    this.dir = dir
  }

  #file(id) {
    if (!ID_RE.test(String(id ?? ''))) throw new Error(`模板 id 不合法：${id ?? '(空)'}`)
    return path.join(this.dir, `${id}.json`)
  }

  async ensure() {
    await fs.mkdir(this.dir, { recursive: true })
    return this.dir
  }

  async list() {
    let names = []
    try {
      names = await fs.readdir(this.dir)
    } catch {
      return []
    }
    const items = []
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      const id = name.slice(0, -5)
      if (!ID_RE.test(id)) continue
      try {
        const raw = JSON.parse(await fs.readFile(path.join(this.dir, name), 'utf8'))
        items.push(summaryOf(raw))
      } catch {
        /* 跳过损坏模板 */
      }
    }
    return items.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
  }

  async get(id) {
    const raw = JSON.parse(await fs.readFile(this.#file(id), 'utf8'))
    return raw
  }

  async save(input, { id } = {}) {
    await this.ensure()
    const template = normalizeTemplate(input, { id })
    const existing = await this.get(template.id).catch(() => null)
    template.createdAt = existing?.createdAt || template.createdAt || new Date().toISOString()
    await fs.writeFile(this.#file(template.id), JSON.stringify(template, null, 2), 'utf8')
    return template
  }

  async remove(id) {
    await fs.rm(this.#file(id), { force: true })
    return { id }
  }
}

export function summaryOf(template) {
  return {
    id: textOf(template?.id),
    name: textOf(template?.name),
    description: textOf(template?.description),
    domain: textOf(template?.domain) || 'general',
    tags: listOf(template?.tags).map(textOf).filter(Boolean),
    author: textOf(template?.author),
    version: textOf(template?.version),
    sections: listOf(template?.blueprint?.sections).length,
    diagrams: listOf(template?.blueprint?.diagrams).length,
    modules: listOf(template?.blueprint?.modules).length,
    updatedAt: textOf(template?.updatedAt),
  }
}

/** 读取单个社区模板的完整内容。 */
export async function readCommunityTemplate(repoRoot, id) {
  const dir = path.join(repoRoot, 'templates')
  let index = null
  try {
    index = JSON.parse(await fs.readFile(path.join(dir, 'index.json'), 'utf8'))
  } catch {
    return null
  }
  const entry = listOf(index?.templates).find(item => textOf(item?.id) === textOf(id))
  const file = textOf(entry?.file)
  if (!entry || file === '' || file.includes('..') || file.includes('/') || file.includes('\\')) return null
  try {
    return JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'))
  } catch {
    return null
  }
}

/** 读取随仓库发布的社区模板目录（index.json 指向各模板文件）。 */
export async function readCommunityTemplates(repoRoot) {
  const dir = path.join(repoRoot, 'templates')
  let index = null
  try {
    index = JSON.parse(await fs.readFile(path.join(dir, 'index.json'), 'utf8'))
  } catch {
    return []
  }
  const files = listOf(index?.templates)
  const items = []
  for (const entry of files) {
    const file = textOf(entry?.file)
    if (file === '' || file.includes('..') || file.includes('/') || file.includes('\\')) continue
    try {
      const raw = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'))
      items.push({ ...summaryOf({ ...raw, id: textOf(raw?.id) || entry.id }), source: 'community' })
    } catch {
      /* 跳过损坏社区模板 */
    }
  }
  return items
}
