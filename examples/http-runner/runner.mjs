#!/usr/bin/env node
// Reference HTTP runner for Blueprint Studio handoff jobs.
//
// It reads a handoff.json produced by `/blueprint run prepare`, is a dry-run by
// default, and only sends an HTTP request when --execute is passed explicitly.
// The remote endpoint must answer with the protocol result object; the runner
// validates it and writes result.json so `/blueprint run collect` can consume it.
//
// The runner never logs the bearer token and never copies it into result.json.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RUN_ID = /^run-[a-z0-9-]+$/
const RESULT_STATUSES = new Set(['done', 'failed', 'blocked'])
const ADAPTERS = new Set(['manual', 'cli', 'http', 'dsh-subagent'])
const ENDPOINT_ENV = 'BLUEPRINT_HTTP_ENDPOINT'
const TOKEN_ENV = 'BLUEPRINT_HTTP_TOKEN'
const EVIDENCE_LIMIT = 50
const TEXT_LIMIT = 20000

export const DEFAULT_TIMEOUT_MS = 120000

export class HandoffError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'HandoffError'
    this.code = code
  }
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function hasParentSegment(value) {
  return value.split(/[\\/]+/u).includes('..')
}

function looksAbsolute(value) {
  return path.isAbsolute(value)
    || /^[A-Za-z]:[\\/]/u.test(value)
    || value.startsWith('\\\\')
    || value.startsWith('//')
}

// The handoff protocol always lives below `<workspace>/.dsh`. Walking up to the
// nearest `.dsh` directory therefore gives us the workspace root without having
// to ask the caller for it.
export function workspaceRootForHandoff(handoffPath) {
  let current = path.dirname(path.resolve(handoffPath))
  while (true) {
    if (path.basename(current) === '.dsh') return path.dirname(current)
    const parent = path.dirname(current)
    if (parent === current) {
      throw new HandoffError('workspace-root', 'handoff 不在 .dsh/ 目录下，无法定位工作区根目录。')
    }
    current = parent
  }
}

export function validateHandoff(value) {
  const handoff = object(value)
  if (handoff === undefined) throw new HandoffError('invalid-handoff', 'handoff.json 顶层必须是 JSON 对象。')
  const runId = text(handoff.runId)
  if (!RUN_ID.test(runId)) {
    throw new HandoffError('invalid-run-id', `runId 非法：${runId || '(空)'}（必须匹配 run-[a-z0-9-]+）。`)
  }
  const adapter = text(handoff.adapter) || 'manual'
  if (!ADAPTERS.has(adapter)) {
    throw new HandoffError('invalid-adapter', `不支持的 adapter：${adapter}。`)
  }
  const resultPath = text(handoff.resultPath)
  if (resultPath === '') {
    throw new HandoffError('invalid-result-path', 'handoff.resultPath 不能为空。')
  }
  if (looksAbsolute(resultPath) || hasParentSegment(resultPath)) {
    throw new HandoffError('invalid-result-path', 'handoff.resultPath 必须是工作区内的相对路径，且不能包含 ..。')
  }
  if (resultPath.includes('\0')) {
    throw new HandoffError('invalid-result-path', 'handoff.resultPath 不能包含空字符。')
  }
  return {
    runId,
    adapter,
    resultPath,
    endpointRef: text(handoff.endpointRef),
    cwd: text(handoff.cwd),
    prompt: text(handoff.prompt),
    moduleId: text(handoff.moduleId),
    moduleCode: text(handoff.moduleCode),
  }
}

export function resolveInside(root, relative) {
  const resolved = path.resolve(root, relative)
  const rel = path.relative(root, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new HandoffError('path-escape', `路径越出工作区：${relative}。`)
  }
  return resolved
}

function parseEndpointUrl(value, source) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new HandoffError('invalid-endpoint', `${source} 不是合法的绝对 URL。`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HandoffError('invalid-endpoint', `${source} 只支持 http/https。`)
  }
  if (url.username !== '' || url.password !== '') {
    throw new HandoffError('invalid-endpoint', `${source} 不能包含用户名或密码；请用环境变量提供凭据。`)
  }
  return url
}

function endpointFromRef(raw, source, env) {
  const ref = text(raw)
  if (ref.startsWith('env:')) {
    const name = ref.slice(4).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) {
      throw new HandoffError('invalid-endpoint', `${source} 的环境变量名非法：${name || '(空)'}。`)
    }
    const value = text(env[name])
    if (value === '') {
      throw new HandoffError('missing-endpoint', `${source} 引用的环境变量 ${name} 未设置。`)
    }
    return { url: parseEndpointUrl(value, `环境变量 ${name}`).href, source: `${source}（env:${name}）` }
  }
  return { url: parseEndpointUrl(ref, source).href, source }
}

// Endpoint priority: --endpoint, handoff.endpointRef, BLUEPRINT_HTTP_ENDPOINT.
// Each candidate may be a literal http(s) URL or `env:NAME`.
export function resolveEndpoint(options = {}) {
  const env = options.env ?? process.env
  const candidates = []
  if (text(options.endpoint) !== '') candidates.push({ raw: options.endpoint, source: '--endpoint' })
  if (text(options.endpointRef) !== '') candidates.push({ raw: options.endpointRef, source: 'handoff.endpointRef' })
  if (text(env[ENDPOINT_ENV]) !== '') candidates.push({ raw: env[ENDPOINT_ENV], source: `env:${ENDPOINT_ENV}` })
  if (candidates.length === 0) {
    throw new HandoffError(
      'missing-endpoint',
      `没有 HTTP 端点。请用 --endpoint、handoff.endpointRef 或环境变量 ${ENDPOINT_ENV} 指定。`,
    )
  }
  return endpointFromRef(candidates[0].raw, candidates[0].source, env)
}

// Never print or persist userinfo/query/fragment: they often carry credentials.
export function redactEndpoint(value) {
  try {
    const url = new URL(value)
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return url.href
  } catch {
    return '(invalid endpoint)'
  }
}

function errorCode(error) {
  const causeCode = text(error?.cause?.code)
  if (causeCode !== '') return causeCode
  const code = text(error?.code)
  if (code !== '') return code
  const name = text(error?.name)
  return name !== '' ? name : 'unknown-error'
}

function normalizeResponseResult(value, runId) {
  const response = object(value)
  if (response === undefined) throw new HandoffError('invalid-response', 'HTTP 响应必须是 JSON 对象。')

  if (response.runId !== undefined && response.runId !== null) {
    const got = text(response.runId)
    if (got !== runId) {
      throw new HandoffError('invalid-run-id', `响应 runId 必须是 ${runId}，收到 ${got || '(空)'}。`)
    }
  }

  const status = text(response.status).toLowerCase()
  if (!RESULT_STATUSES.has(status)) {
    throw new HandoffError('invalid-status', `响应 status 只允许 done/failed/blocked，收到 ${status || '(空)'}。`)
  }

  const result = { runId, status }
  for (const key of ['summary', 'nextAction', 'error']) {
    if (response[key] === undefined) continue
    if (typeof response[key] !== 'string') {
      throw new HandoffError('invalid-response', `响应 ${key} 必须是字符串。`)
    }
    const body = response[key].trim().slice(0, key === 'summary' ? 2000 : TEXT_LIMIT)
    if (body !== '') result[key] = body
  }

  if (response.evidence !== undefined) {
    if (!Array.isArray(response.evidence)) {
      throw new HandoffError('invalid-response', '响应 evidence 必须是数组。')
    }
    if (response.evidence.length > EVIDENCE_LIMIT) {
      throw new HandoffError('invalid-response', `响应 evidence 最多 ${EVIDENCE_LIMIT} 条。`)
    }
    const evidence = []
    for (const entry of response.evidence) {
      if (typeof entry === 'string') {
        const body = entry.trim()
        if (body === '') throw new HandoffError('invalid-response', '响应 evidence 文本不能为空。')
        evidence.push({ text: body.slice(0, 2000) })
        continue
      }
      const item = object(entry)
      if (item === undefined || typeof item.text !== 'string' || item.text.trim() === '') {
        throw new HandoffError('invalid-response', '响应 evidence 条目必须是字符串或 {kind?,text} 对象。')
      }
      const normalized = { text: item.text.trim().slice(0, 2000) }
      if (item.kind !== undefined) {
        if (typeof item.kind !== 'string') {
          throw new HandoffError('invalid-response', '响应 evidence.kind 必须是字符串。')
        }
        const kind = item.kind.trim().slice(0, 80)
        if (kind !== '') normalized.kind = kind
      }
      evidence.push(normalized)
    }
    result.evidence = evidence
  }

  if (response.changedPaths !== undefined) {
    if (!Array.isArray(response.changedPaths)) {
      throw new HandoffError('invalid-response', '响应 changedPaths 必须是字符串数组。')
    }
    const paths = []
    for (const entry of response.changedPaths) {
      if (typeof entry !== 'string') {
        throw new HandoffError('invalid-response', '响应 changedPaths 必须是字符串数组。')
      }
      const body = entry.trim()
      if (body !== '' && !paths.includes(body)) paths.push(body)
    }
    if (paths.length > 200) throw new HandoffError('invalid-response', '响应 changedPaths 最多 200 条。')
    result.changedPaths = paths
  }

  if (response.at !== undefined) {
    const at = finite(response.at)
    if (at === undefined) throw new HandoffError('invalid-response', '响应 at 必须是有限数字时间戳。')
    result.at = at
  }
  return result
}

async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await fs.rename(temp, file)
}

async function writeResult(resultPath, result) {
  try {
    await writeJsonAtomic(resultPath, result)
  } catch (error) {
    throw new HandoffError('write-result', `写入 result.json 失败：${errorCode(error)}。`)
  }
  return result
}

async function writeFailure(root, resultPath, runId, message, extra = {}) {
  const safeMessage = text(message).slice(0, 2000) || 'HTTP runner failed.'
  const result = {
    runId,
    status: extra.status === 'blocked' ? 'blocked' : 'failed',
    summary: safeMessage,
    evidence: [{ kind: 'runner', text: safeMessage }],
    error: safeMessage,
    nextAction: extra.nextAction
      || '检查端点、认证、响应格式与超时设置，修复后重新执行。',
  }
  await writeResult(resultPath, result)
  return {
    ok: true,
    mode: 'executed',
    status: result.status,
    handoff: extra.handoff,
    result,
    resultPath,
    root,
  }
}

export async function runHttpHandoff(handoffPath, options = {}) {
  const absoluteHandoff = path.resolve(handoffPath)
  let raw
  try {
    raw = await fs.readFile(absoluteHandoff, 'utf8')
  } catch (error) {
    throw new HandoffError('read-handoff', `无法读取 handoff.json：${errorCode(error)}。`)
  }
  let parsed
  try {
    parsed = JSON.parse(raw.replace(/^\uFEFF/u, ''))
  } catch {
    throw new HandoffError('invalid-handoff', 'handoff.json 不是合法 JSON。')
  }
  const handoff = validateHandoff(parsed)
  const root = workspaceRootForHandoff(absoluteHandoff)
  const resultPath = resolveInside(root, handoff.resultPath)
  const execute = options.execute === true
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? Math.floor(options.timeoutMs)
    : DEFAULT_TIMEOUT_MS

  if (handoff.adapter !== 'http' && options.forceAdapter !== true) {
    throw new HandoffError(
      'invalid-adapter',
      `HTTP runner 只处理 adapter=http 的 handoff（收到 ${handoff.adapter}）；确认后可用 --force-adapter 显式覆盖。`,
    )
  }

  const endpoint = resolveEndpoint({
    endpoint: options.endpoint,
    endpointRef: handoff.endpointRef,
    env: options.env,
  })
  const displayEndpoint = redactEndpoint(endpoint.url)
  const env = options.env ?? process.env
  const token = text(options.token) || text(env[TOKEN_ENV])

  if (!execute) {
    return {
      ok: true,
      mode: 'dry-run',
      status: 'dry-run',
      handoff,
      root,
      endpoint: displayEndpoint,
      endpointSource: endpoint.source,
      resultPath,
      tokenConfigured: token !== '',
      message: 'Dry run. Re-run with --execute to POST the handoff and write result.json.',
    }
  }

  const headers = {
    'content-type': 'application/json',
    accept: 'application/json',
    'user-agent': 'blueprint-http-runner/1',
  }
  if (token !== '') headers.authorization = `Bearer ${token}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  timer.unref?.()
  let response
  let body
  let failure
  try {
    response = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(parsed),
      signal: controller.signal,
      redirect: 'error',
    })
    if (!response.ok) {
      failure = `HTTP 端点返回 ${response.status}。`
      await response.body?.cancel().catch(() => {})
    } else {
      try {
        body = await response.json()
      } catch {
        failure = 'HTTP 响应不是合法 JSON。'
      }
    }
  } catch (error) {
    failure = error?.name === 'AbortError'
      ? `HTTP 请求超时（${timeoutMs}ms）。`
      : `HTTP 请求失败（${errorCode(error)}）。`
  } finally {
    clearTimeout(timer)
  }

  if (failure !== undefined) {
    return writeFailure(root, resultPath, handoff.runId, failure, {
      handoff,
      nextAction: '检查端点、网络、认证与超时设置，修复后重新执行。',
    })
  }

  let result
  try {
    result = normalizeResponseResult(body, handoff.runId)
  } catch (error) {
    return writeFailure(root, resultPath, handoff.runId, error.message, {
      handoff,
      nextAction: '修正远端响应格式：status 必须是 done/failed/blocked，runId 可省略但存在时必须匹配。',
    })
  }
  if (result.evidence === undefined || result.evidence.length === 0) {
    result.evidence = [{ kind: 'runner', text: `HTTP 200 from ${displayEndpoint}` }]
  }

  await writeResult(resultPath, result)
  return {
    ok: true,
    mode: 'executed',
    status: result.status,
    handoff,
    result,
    resultPath,
    root,
    endpoint: displayEndpoint,
    endpointSource: endpoint.source,
  }
}

const USAGE = 'Usage: node runner.mjs <handoff.json> [--execute] [--endpoint env:NAME|URL] [--force-adapter] [--timeout ms]'

export async function main(argv = process.argv.slice(2)) {
  const args = [...argv]
  let handoffPath = ''
  let execute = false
  let endpoint
  let forceAdapter = false
  let timeoutMs = DEFAULT_TIMEOUT_MS
  while (args.length > 0) {
    const arg = args.shift()
    if (arg === '--execute') execute = true
    else if (arg === '--force-adapter') forceAdapter = true
    else if (arg === '--endpoint') {
      const value = args.shift()
      if (value === undefined || value === '') throw new HandoffError('usage', '--endpoint 需要一个 env:NAME 或 URL。')
      endpoint = value
    } else if (arg === '--timeout') {
      const value = Number(args.shift())
      if (!Number.isFinite(value) || value <= 0) throw new HandoffError('usage', '--timeout 需要正数毫秒。')
      timeoutMs = value
    } else if (arg === '--help' || arg === '-h') {
      console.log(USAGE)
      return 0
    } else if (arg.startsWith('-')) {
      throw new HandoffError('usage', `未知参数：${arg}`)
    } else if (handoffPath === '') handoffPath = arg
    else throw new HandoffError('usage', `多余的参数：${arg}`)
  }
  if (handoffPath === '') {
    console.error(USAGE)
    return 2
  }
  const outcome = await runHttpHandoff(handoffPath, { execute, endpoint, forceAdapter, timeoutMs })
  console.log(JSON.stringify(outcome, null, 2))
  return 0
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().then(code => { process.exitCode = code }).catch(error => {
    console.error(error instanceof HandoffError ? `${error.code}: ${error.message}` : String(error))
    process.exitCode = 1
  })
}
