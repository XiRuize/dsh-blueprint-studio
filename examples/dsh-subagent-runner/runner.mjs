#!/usr/bin/env node
// Reference dsh-subagent runner for Blueprint Studio handoff jobs.
//
// It reads a handoff.json produced by `/blueprint run prepare`, writes the full
// task prompt (handoff.prompt + result contract + paths) to prompt.txt, and —
// only with --execute and a host-provided DSH_SUBAGENT_CMD — pipes that prompt
// into the command's stdin.
//
// This runner deliberately does not import any private DSH API. The host or the
// human operator owns the bridge from DSH_SUBAGENT_CMD to a real subagent. The
// runner never fabricates a successful result: if the subagent does not write
// result.json, the runner writes a `blocked` result explaining what is missing.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const RUN_ID = /^run-[a-z0-9-]+$/u
const RESULT_STATUSES = new Set(['done', 'failed', 'blocked'])
const ADAPTERS = new Set(['manual', 'cli', 'http', 'dsh-subagent'])
const DEFAULT_TIMEOUT_MS = 120000
const MAX_OUTPUT_BYTES = 200000

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

function errorCode(error) {
  const causeCode = text(error?.cause?.code)
  if (causeCode !== '') return causeCode
  const code = text(error?.code)
  if (code !== '') return code
  return text(error?.name) || 'unknown-error'
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
    cwd: text(handoff.cwd),
    prompt: text(handoff.prompt),
    moduleId: text(handoff.moduleId),
    moduleCode: text(handoff.moduleCode),
    handoffPath: text(handoff.handoffPath),
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

function explainCwd(handoff) {
  return handoff.cwd === '' ? '（未设置；使用工作区根目录）' : handoff.cwd
}

// Complete prompt written next to handoff.json. It contains everything a host
// bridge needs to hand the task to a subagent, including the result contract.
export function buildPromptText(handoff, options = {}) {
  const resultPath = text(options.resultPath) || handoff.resultPath
  const promptPath = text(options.promptPath)
  const root = text(options.root)
  const lines = [
    '# Blueprint Studio handoff task',
    '',
    `运行 id：${handoff.runId}`,
    `模块：${handoff.moduleCode || handoff.moduleId || '(未设置)'}`,
    `adapter：${handoff.adapter}`,
    `工作目录：${explainCwd(handoff)}`,
  ]
  if (root !== '') lines.push(`工作区根目录：${root}`)
  if (promptPath !== '') lines.push(`提示词文件：${promptPath}`)
  lines.push(
    '',
    '## 任务',
    '',
    handoff.prompt === '' ? '（handoff.prompt 为空，请先向用户确认模块范围。）' : handoff.prompt,
    '',
    '## 结果契约',
    '',
    `结果文件：${resultPath}（相对工作区根目录；只写这一个文件）`,
    `runId 必须是：${handoff.runId}`,
    'JSON 形状：{ "runId": "...", "status": "done"|"failed"|"blocked", "summary"?: "...", "evidence"?: [{ "kind"?: "...", "text": "..." }], "changedPaths"?: ["..."], "nextAction"?: "...", "error"?: "...", "at"?: 0 }',
    'evidence 至少一条可复核证据（命令、测试结果或文件路径），最多 50 条；不要只写“已完成”。',
    '被阻塞时写 status:"blocked"，并用 nextAction 说明下一步；不要伪造 done。',
    '不要修改 handoff.json、蓝图或版本文件；不要自行填写 tests/reviewer/human 验收结论。',
    '验收由用户执行 /blueprint verify 记录，runner 只负责交接与收集。',
  )
  return `${lines.join('\n')}\n`
}

async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await fs.rename(temp, file)
}

async function writeTextAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  await fs.writeFile(temp, value, 'utf8')
  await fs.rename(temp, file)
}

function validateSubagentResult(value, runId) {
  const result = object(value)
  if (result === undefined) throw new HandoffError('invalid-result', 'result.json 顶层必须是 JSON 对象。')
  const got = text(result.runId)
  if (got !== runId) {
    throw new HandoffError('invalid-result', `result.json 的 runId 必须是 ${runId}，收到 ${got || '(空)'}。`)
  }
  const status = text(result.status).toLowerCase()
  if (!RESULT_STATUSES.has(status)) {
    throw new HandoffError('invalid-result', `result.json 的 status 只允许 done/failed/blocked，收到 ${status || '(空)'}。`)
  }
  if (result.evidence !== undefined && !Array.isArray(result.evidence)) {
    throw new HandoffError('invalid-result', 'result.json 的 evidence 必须是数组。')
  }
  if (Array.isArray(result.evidence)) {
    if (result.evidence.length > 50) {
      throw new HandoffError('invalid-result', 'result.json 的 evidence 最多 50 条。')
    }
    for (const entry of result.evidence) {
      if (typeof entry === 'string') {
        if (entry.trim() === '') throw new HandoffError('invalid-result', 'result.json 的 evidence 文本不能为空。')
        continue
      }
      const item = object(entry)
      if (item === undefined || typeof item.text !== 'string' || item.text.trim() === '') {
        throw new HandoffError('invalid-result', 'result.json 的 evidence 条目必须是字符串或 {kind?,text} 对象。')
      }
      if (item.kind !== undefined && typeof item.kind !== 'string') {
        throw new HandoffError('invalid-result', 'result.json 的 evidence.kind 必须是字符串。')
      }
    }
  }
  if (result.changedPaths !== undefined) {
    if (!Array.isArray(result.changedPaths) || result.changedPaths.some(entry => typeof entry !== 'string')) {
      throw new HandoffError('invalid-result', 'result.json 的 changedPaths 必须是字符串数组。')
    }
  }
  return result
}

function runCommand(command, cwd, input, timeoutMs, env) {
  return new Promise(resolve => {
    let stdout = ''
    let stderr = ''
    let settled = false
    const cap = value => value.length > MAX_OUTPUT_BYTES
      ? `${value.slice(0, MAX_OUTPUT_BYTES)}\n…[truncated]`
      : value
    const finish = result => {
      if (settled) return
      settled = true
      resolve({ ...result, stdout: cap(stdout), stderr: cap(stderr) })
    }
    let child
    try {
      child = spawn(command, {
        cwd,
        shell: true,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: env ?? process.env,
      })
    } catch (error) {
      finish({ code: -1, error: errorCode(error) })
      return
    }
    child.stdout.on('data', chunk => { stdout += chunk.toString() })
    child.stderr.on('data', chunk => { stderr += chunk.toString() })
    child.on('error', error => finish({ code: -1, error: errorCode(error) }))
    child.on('close', code => finish({ code: Number(code ?? -1) }))
    child.stdin.on('error', () => {})
    child.stdin.end(input)
    if (timeoutMs > 0) {
      const timer = setTimeout(() => {
        try { child.kill() } catch {}
        finish({ code: -1, error: 'timeout' })
      }, timeoutMs)
      timer.unref?.()
    }
  })
}

async function writeBlocked(root, resultPath, runId, message, extra = {}) {
  const result = {
    runId,
    status: 'blocked',
    summary: message,
    evidence: extra.evidence ?? [],
    nextAction: extra.nextAction
      || `让外部子代理写入 ${path.relative(root, resultPath)}，然后重新运行 collect。`,
  }
  if (extra.error !== undefined) result.error = extra.error
  await writeJsonAtomic(resultPath, result)
  return result
}

export async function runDshHandoff(handoffPath, options = {}) {
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
  if (handoff.adapter !== 'dsh-subagent') {
    throw new HandoffError(
      'invalid-adapter',
      `dsh-subagent runner 只处理 adapter=dsh-subagent 的 handoff（收到 ${handoff.adapter}）。`,
    )
  }

  const root = workspaceRootForHandoff(absoluteHandoff)
  const resultPath = resolveInside(root, handoff.resultPath)
  const cwd = handoff.cwd === '' ? root : resolveInside(root, handoff.cwd)
  const promptAbsolute = path.join(path.dirname(absoluteHandoff), 'prompt.txt')
  const promptInside = path.relative(root, promptAbsolute)
  if (promptInside.startsWith('..') || path.isAbsolute(promptInside)) {
    throw new HandoffError('path-escape', 'prompt.txt 会越出工作区，拒绝写入。')
  }
  const promptPath = path.relative(root, promptAbsolute) || 'prompt.txt'
  const promptText = buildPromptText(handoff, {
    root,
    resultPath: handoff.resultPath,
    promptPath,
  })
  await writeTextAtomic(promptAbsolute, promptText)

  const env = options.env ?? process.env
  const command = text(options.command) || text(env.DSH_SUBAGENT_CMD)
  const execute = options.execute === true
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? Math.floor(options.timeoutMs)
    : DEFAULT_TIMEOUT_MS

  if (!execute) {
    return {
      ok: true,
      mode: 'dry-run',
      status: 'dry-run',
      handoff,
      root,
      cwd,
      promptPath,
      promptAbsolute,
      resultPath,
      commandConfigured: command !== '',
      message: command === ''
        ? 'Dry run. DSH_SUBAGENT_CMD is not configured; set it to a host bridge command and re-run with --execute.'
        : 'Dry run. Re-run with --execute to pipe the prompt into DSH_SUBAGENT_CMD.',
    }
  }

  if (command === '') {
    const result = await writeBlocked(root, resultPath, handoff.runId,
      'DSH_SUBAGENT_CMD 未配置，runner 无法启动子代理。',
      {
        evidence: [
          { kind: 'runner', text: `prompt=${promptPath}` },
          { kind: 'runner', text: 'DSH_SUBAGENT_CMD is empty.' },
        ],
        nextAction: '由宿主提供 DSH_SUBAGENT_CMD（stdin 读 prompt.txt）后重新执行；或手工把 prompt.txt 交给子代理并让它写 result.json。',
      })
    return {
      ok: true,
      mode: 'blocked',
      status: 'blocked',
      handoff,
      root,
      cwd,
      promptPath,
      resultPath,
      result,
      commandConfigured: false,
    }
  }

  let previousResult
  try {
    previousResult = await fs.readFile(resultPath, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw new HandoffError('read-result', `无法读取 result.json：${errorCode(error)}。`)
    }
  }

  const outcome = await runCommand(command, cwd, promptText, timeoutMs, env)
  const evidence = [
    { kind: 'runner', text: `prompt=${promptPath}; exit=${outcome.code}${outcome.error ? `; error=${outcome.error}` : ''}` },
  ]
  if (outcome.stderr.trim() !== '') {
    evidence.push({ kind: 'stderr', text: outcome.stderr.trim().slice(0, 2000) })
  }

  let existing
  try {
    existing = await fs.readFile(resultPath, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw new HandoffError('read-result', `无法读取 result.json：${errorCode(error)}。`)
    }
  }

  if (existing === undefined || (previousResult !== undefined && existing === previousResult)) {
    const stale = existing !== undefined
    const message = stale
      ? 'result.json 在本次执行前后没有变化，runner 视为陈旧结果，不会据此宣称完成。'
      : outcome.error === 'timeout'
        ? `子代理命令超时（${timeoutMs}ms），且没有写入 result.json。`
        : `子代理命令结束（exit ${outcome.code}），但没有写入 result.json。`
    const result = await writeBlocked(root, resultPath, handoff.runId, message, {
      evidence: stale ? [...evidence, { kind: 'runner', text: 'result.json unchanged; treated as stale.' }] : evidence,
      error: stale
        ? 'stale-result'
        : outcome.error === 'timeout'
          ? `timeout after ${timeoutMs}ms`
          : `exit ${outcome.code}`,
      nextAction: `确认 DSH_SUBAGENT_CMD 真的启动了子代理，并让它写入 ${handoff.resultPath}；runner 不会伪造结果。`,
    })
    return {
      ok: true,
      mode: 'blocked',
      status: 'blocked',
      handoff,
      root,
      cwd,
      promptPath,
      resultPath,
      result,
      exitCode: outcome.code,
      stdout: outcome.stdout,
      stderr: outcome.stderr,
      commandConfigured: true,
    }
  }

  let parsedResult
  try {
    parsedResult = JSON.parse(existing.replace(/^\uFEFF/u, ''))
  } catch {
    throw new HandoffError('invalid-result', `result.json 不是合法 JSON，runner 不会覆盖它：${path.relative(root, resultPath)}。`)
  }
  const result = validateSubagentResult(parsedResult, handoff.runId)
  return {
    ok: true,
    mode: 'executed',
    status: result.status,
    handoff,
    root,
    cwd,
    promptPath,
    resultPath,
    result,
    exitCode: outcome.code,
    stdout: outcome.stdout,
    stderr: outcome.stderr,
    commandConfigured: true,
  }
}

const USAGE = 'Usage: node runner.mjs <handoff.json> [--execute] [--timeout ms]'

export async function main(argv = process.argv.slice(2)) {
  const args = [...argv]
  let handoffPath = ''
  let execute = false
  let timeoutMs = DEFAULT_TIMEOUT_MS
  while (args.length > 0) {
    const arg = args.shift()
    if (arg === '--execute') execute = true
    else if (arg === '--timeout') {
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
  const outcome = await runDshHandoff(handoffPath, { execute, timeoutMs })
  console.log(JSON.stringify(outcome, null, 2))
  return 0
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().then(code => { process.exitCode = code }).catch(error => {
    console.error(error instanceof HandoffError ? `${error.code}: ${error.message}` : String(error))
    process.exitCode = 1
  })
}
