#!/usr/bin/env node
// Reference runner for Blueprint Studio handoff jobs.
//
// It reads a handoff.json produced by `/blueprint run prepare`, is dry-run by
// default, and only executes commands when --execute is passed explicitly.
// It writes result.json next to the handoff so `/blueprint run collect` can
// validate and write the evidence back into the durable run ledger.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const RUN_ID = /^run-[a-z0-9-]+$/

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

export function workspaceRootForHandoff(handoffPath) {
  let current = path.dirname(path.resolve(handoffPath))
  while (true) {
    if (path.basename(current) === '.dsh') return path.dirname(current)
    const parent = path.dirname(current)
    if (parent === current) throw new HandoffError('workspace-root', 'handoff 不在 .dsh/blueprints 下，无法定位工作区根目录。')
    current = parent
  }
}

export function validateHandoff(value) {
  const handoff = object(value)
  if (handoff === undefined) throw new HandoffError('invalid-handoff', 'handoff.json 不是对象。')
  const runId = text(handoff.runId)
  if (!RUN_ID.test(runId)) throw new HandoffError('invalid-run-id', `runId 非法：${runId || '(空)'}。`)
  const adapter = text(handoff.adapter) || 'cli'
  if (!['manual', 'cli', 'http', 'dsh-subagent'].includes(adapter)) {
    throw new HandoffError('invalid-adapter', `不支持的 adapter：${adapter}。`)
  }
  const resultPath = text(handoff.resultPath)
  if (resultPath === '' || path.isAbsolute(resultPath) || resultPath.split(/[\\/]/).includes('..')) {
    throw new HandoffError('invalid-result-path', 'handoff.resultPath 必须是工作区相对路径。')
  }
  const commands = Array.isArray(handoff.commands) ? handoff.commands.map(text).filter(Boolean) : []
  return {
    runId,
    adapter,
    resultPath,
    cwd: text(handoff.cwd),
    commands,
    prompt: text(handoff.prompt),
    moduleId: text(handoff.moduleId),
    moduleCode: text(handoff.moduleCode),
  }
}

function resolveInside(root, relative) {
  const resolved = path.resolve(root, relative)
  const rel = path.relative(root, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new HandoffError('path-escape', `路径越出工作区：${relative}。`)
  }
  return resolved
}

async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await fs.rename(temp, file)
}

function runCommand(command, cwd, timeoutMs) {
  return new Promise(resolve => {
    const child = spawn(command, { cwd, shell: true, windowsHide: true, env: process.env })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = result => {
      if (settled) return
      settled = true
      resolve(result)
    }
    child.stdout.on('data', chunk => { stdout += chunk.toString() })
    child.stderr.on('data', chunk => { stderr += chunk.toString() })
    child.on('error', error => finish({ code: -1, stdout, stderr: `${stderr}${error.message}\n` }))
    child.on('close', code => finish({ code: Number(code ?? -1), stdout, stderr }))
    if (timeoutMs > 0) {
      const timer = setTimeout(() => {
        try { child.kill() } catch {}
        finish({ code: -1, stdout, stderr: `${stderr}timeout after ${timeoutMs}ms\n` })
      }, timeoutMs)
      timer.unref?.()
    }
  })
}

export async function runHandoff(handoffPath, options = {}) {
  const absoluteHandoff = path.resolve(handoffPath)
  const handoff = validateHandoff(JSON.parse(await fs.readFile(absoluteHandoff, 'utf8')))
  const root = workspaceRootForHandoff(absoluteHandoff)
  const cwd = handoff.cwd === '' ? root : resolveInside(root, handoff.cwd)
  const resultPath = resolveInside(root, handoff.resultPath)
  const execute = options.execute === true
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 120000
  const evidence = []
  const changedPaths = Array.isArray(options.changedPaths) ? options.changedPaths.map(text).filter(Boolean) : []

  if (handoff.adapter !== 'cli') {
    const result = {
      runId: handoff.runId,
      status: 'blocked',
      summary: `Reference runner does not execute ${handoff.adapter} handoffs.`,
      evidence: [{ kind: 'runner', text: `adapter=${handoff.adapter}; use the matching external runner.` }],
      nextAction: `Provide a ${handoff.adapter} runner or switch this module execution adapter to cli.`,
    }
    await writeJsonAtomic(resultPath, result)
    return { ok: true, mode: 'blocked', status: 'blocked', handoff, result, resultPath }
  }
  if (handoff.commands.length === 0) {
    const result = {
      runId: handoff.runId,
      status: 'blocked',
      summary: 'No commands declared in handoff.',
      evidence: [{ kind: 'runner', text: 'commands=[]' }],
      nextAction: 'Add execution.commands to the module or run manually.',
    }
    await writeJsonAtomic(resultPath, result)
    return { ok: true, mode: 'blocked', status: 'blocked', handoff, result, resultPath }
  }

  if (!execute) {
    return {
      ok: true,
      mode: 'dry-run',
      handoff,
      cwd,
      root,
      commands: handoff.commands,
      message: 'Dry run. Re-run with --execute to run commands and write result.json.',
      resultPath,
    }
  }

  await fs.mkdir(cwd, { recursive: true }).catch(() => {})
  for (const command of handoff.commands) {
    const outcome = await runCommand(command, cwd, timeoutMs)
    evidence.push({ kind: 'command', text: `$ ${command}\nexit=${outcome.code}` })
    if (outcome.stdout.trim() !== '') evidence.push({ kind: 'stdout', text: outcome.stdout.trim().slice(-4000) })
    if (outcome.stderr.trim() !== '') evidence.push({ kind: 'stderr', text: outcome.stderr.trim().slice(-4000) })
    if (outcome.code !== 0) {
      const result = {
        runId: handoff.runId,
        status: 'failed',
        summary: `Command failed (exit ${outcome.code}): ${command}`,
        evidence,
        changedPaths,
        error: `exit ${outcome.code}: ${command}`,
        nextAction: 'Inspect the captured stderr and rollback plan before retrying.',
      }
      await writeJsonAtomic(resultPath, result)
      return { ok: true, mode: 'executed', status: 'failed', handoff, result, resultPath, cwd }
    }
  }

  const result = {
    runId: handoff.runId,
    status: 'done',
    summary: `Executed ${handoff.commands.length} command(s).`,
    evidence,
    changedPaths,
  }
  await writeJsonAtomic(resultPath, result)
  return { ok: true, mode: 'executed', status: 'done', handoff, result, resultPath, cwd }
}

export async function main(argv = process.argv.slice(2)) {
  const args = [...argv]
  let handoffPath = ''
  let execute = false
  let timeoutMs = 120000
  const changedPaths = []
  while (args.length > 0) {
    const arg = args.shift()
    if (arg === '--execute') execute = true
    else if (arg === '--timeout') timeoutMs = Number(args.shift()) || 120000
    else if (arg === '--changed-path') changedPaths.push(args.shift() ?? '')
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node runner.mjs <handoff.json> [--execute] [--timeout ms] [--changed-path path]')
      return 0
    } else if (handoffPath === '') handoffPath = arg
    else throw new HandoffError('usage', `未知参数：${arg}`)
  }
  if (handoffPath === '') {
    console.error('Usage: node runner.mjs <handoff.json> [--execute] [--timeout ms] [--changed-path path]')
    return 2
  }
  const outcome = await runHandoff(handoffPath, { execute, timeoutMs, changedPaths })
  console.log(JSON.stringify(outcome, null, 2))
  return 0
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().then(code => { process.exitCode = code }).catch(error => {
    console.error(error instanceof HandoffError ? `${error.code}: ${error.message}` : String(error))
    process.exitCode = 1
  })
}
