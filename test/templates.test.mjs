import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  normalizeTemplate,
  readCommunityTemplate,
  readCommunityTemplates,
  slugifyTemplateId,
  TemplateStore,
  validateTemplate,
} from '../lib/templates.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function tmpDir(name) {
  const dir = path.join(os.tmpdir(), `bp-tpl-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

const sample = () => ({
  name: '电商后台',
  description: '商品、订单、库存三条主链路',
  domain: 'ecommerce',
  tags: ['ecommerce', 'admin'],
  blueprint: {
    title: '电商后台',
    summary: '最小可用的电商管理后台',
    sections: [
      { key: 'goals', title: '目标', items: [{ id: 'g1', text: '管理员能看到今日订单' }] },
    ],
    diagrams: [
      {
        key: 'module',
        layerId: 'A',
        type: 'module',
        title: '模块图',
        nodes: [{ id: 'A1', type: 'module', label: '订单' }],
        edges: [],
      },
    ],
    modules: [{ id: 'A1', name: '订单', layerId: 'A', code: 'A1', summary: '订单 CRUD' }],
  },
})

test('slugifyTemplateId 只产生合法 id', () => {
  assert.match(slugifyTemplateId('E-commerce Admin'), /^[a-z0-9-]+$/)
  assert.match(slugifyTemplateId('电商后台'), /^[a-z0-9-]+$/)
  assert.equal(slugifyTemplateId(''), slugifyTemplateId(''), '空名称也要稳定回退')
})

test('normalizeTemplate 校验并剥离运行时字段', () => {
  const template = normalizeTemplate({ ...sample(), sessionId: 'x', status: 'draft', verification: {} })
  assert.equal(template.name, '电商后台')
  assert.equal(template.blueprint.sections.length, 1)
  assert.equal('sessionId' in template.blueprint, false)
  assert.equal('status' in template.blueprint, false)
})

test('validateTemplate 拒绝空名与超大模板', () => {
  assert.equal(validateTemplate({ name: '', blueprint: sample().blueprint }).ok, false)
  const huge = { name: 'x', blueprint: { sections: [{ key: 'g', title: 'g', items: [{ id: 'a', text: 'x'.repeat(600 * 1024) }] }] } }
  const result = validateTemplate(huge)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some(error => error.includes('过大')))
})

test('TemplateStore 保存/列表/读取/删除', async () => {
  const dir = await tmpDir('store')
  const store = new TemplateStore(dir)
  const saved = await store.save(sample())
  assert.match(saved.id, /^[a-z0-9-]+$/)
  const list = await store.list()
  assert.equal(list.length, 1)
  assert.equal(list[0].name, '电商后台')
  assert.equal(list[0].modules, 1)
  const loaded = await store.get(saved.id)
  assert.equal(loaded.blueprint.title, '电商后台')
  await store.remove(saved.id)
  assert.equal((await store.list()).length, 0)
  await assert.rejects(() => store.get('../etc/passwd'), /不合法/)
})

test('TemplateStore 重复保存保留 createdAt 并更新内容', async () => {
  const dir = await tmpDir('update')
  const store = new TemplateStore(dir)
  const first = await store.save({ ...sample(), id: 'demo' })
  await new Promise(resolve => setTimeout(resolve, 5))
  const second = await store.save({ ...sample(), id: 'demo', name: '电商后台 v2' })
  assert.equal(second.createdAt, first.createdAt)
  assert.equal(second.name, '电商后台 v2')
  assert.equal((await store.list()).length, 1)
})

test('社区模板目录可读且格式合法', async () => {
  const community = await readCommunityTemplates(REPO_ROOT)
  assert.ok(Array.isArray(community))
  assert.ok(community.length >= 1, '仓库应至少提供一个社区模板')
  const first = community[0]
  assert.ok(first.id)
  const full = await readCommunityTemplate(REPO_ROOT, first.id)
  assert.ok(full?.blueprint, '社区模板应包含 blueprint')
  assert.equal(validateTemplate(full).ok, true)
})
