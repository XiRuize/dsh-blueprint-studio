import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  HandoffError,
  runHandoff,
  validateHandoff,
  workspaceRootForHandoff,
} from '../examples/handoff-runner/runner.mjs'

async function fixture(commands, adapter = 'cli') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bp-runner-'))
  const handoffPath = path.join(root, '.dsh', 'blueprints', 'session.runs', 'run-1', 'handoff.json')
  await fs.mkdir(path.dirname(handoffPath), { recursive: true })
  const handoff = {
    version: 1,
    runId: 'run-1',
    moduleId: 'm1',
    moduleCode: 'A1',
    adapter,
    cwd: '.',
    commands,
    resultPath: '.dsh/blueprints/session.runs/run-1/result.json',
    auto: false,
  }
  await fs.writeFile(handoffPath, JSON.stringify(handoff), 'utf8')
  return { root, handoffPath, handoff }
}

test('validates and resolves handoff paths', async () => {
  const { root, handoffPath, handoff } = await fixture(['echo ok'])
  try {
    assert.equal(workspaceRootForHandoff(handoffPath), root)
    assert.equal(validateHandoff(handoff).runId, 'run-1')
    assert.throws(() => validateHandoff({ ...handoff, runId: '../bad' }), HandoffError)
    assert.throws(() => validateHandoff({ ...handoff, adapter: 'unknown' }), HandoffError)
    assert.throws(() => validateHandoff({ ...handoff, resultPath: '../outside.json' }), HandoffError)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('dry-run does not execute or write result.json', async () => {
  const { root, handoffPath } = await fixture(['echo ok'])
  try {
    const outcome = await runHandoff(handoffPath)
    assert.equal(outcome.mode, 'dry-run')
    await assert.rejects(fs.stat(path.join(root, '.dsh/blueprints/session.runs/run-1/result.json')))
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('execute writes a done result with command evidence', async () => {
  const { root, handoffPath } = await fixture(['echo runner-ok'])
  try {
    const outcome = await runHandoff(handoffPath, { execute: true })
    assert.equal(outcome.status, 'done')
    const result = JSON.parse(await fs.readFile(path.join(root, '.dsh/blueprints/session.runs/run-1/result.json'), 'utf8'))
    assert.equal(result.status, 'done')
    assert.match(result.evidence.map(item => item.text).join('\n'), /runner-ok/)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('a failing command writes failed evidence and stops', async () => {
  const { root, handoffPath } = await fixture([`"${process.execPath}" -e "process.exit(3)"`, 'echo should-not-run'])
  try {
    const outcome = await runHandoff(handoffPath, { execute: true })
    assert.equal(outcome.status, 'failed')
    const result = JSON.parse(await fs.readFile(path.join(root, '.dsh/blueprints/session.runs/run-1/result.json'), 'utf8'))
    assert.equal(result.status, 'failed')
    assert.match(result.error, /exit 3/)
    assert.doesNotMatch(result.evidence.map(item => item.text).join('\n'), /should-not-run/)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('non-cli adapters are blocked and do not execute', async () => {
  const { root, handoffPath } = await fixture(['echo no'], 'http')
  try {
    const outcome = await runHandoff(handoffPath, { execute: true })
    assert.equal(outcome.status, 'blocked')
    const result = JSON.parse(await fs.readFile(path.join(root, '.dsh/blueprints/session.runs/run-1/result.json'), 'utf8'))
    assert.equal(result.status, 'blocked')
    assert.match(result.nextAction, /http/i)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('policy allowlist and read-only mounts block execution before writing', async () => {
  const { root, handoffPath, handoff } = await fixture(['echo ok'])
  try {
    await fs.mkdir(path.join(root, '.dsh', 'blueprints'), { recursive: true })
    await fs.writeFile(path.join(root, '.dsh', 'blueprints', 'handoff-policy.json'), JSON.stringify({
      allowedCommands: ['^pnpm test$'],
    }), 'utf8')
    await assert.rejects(runHandoff(handoffPath, { execute: true }), error => error?.code === 'policy')
    await assert.rejects(fs.stat(path.join(root, '.dsh/blueprints/session.runs/run-1/result.json')))

    await fs.rm(path.join(root, '.dsh', 'blueprints', 'handoff-policy.json'), { force: true })
    await fs.writeFile(handoffPath, JSON.stringify({
      ...handoff,
      mounts: [{ id: 'archive', root: './archive', access: 'ro' }],
    }), 'utf8')
    await assert.rejects(runHandoff(handoffPath, { execute: true }), error => error?.code === 'policy')
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('execution appends an audit record', async () => {
  const { root, handoffPath } = await fixture(['echo audit'])
  try {
    await runHandoff(handoffPath, { execute: true })
    const lines = (await fs.readFile(path.join(root, '.dsh/blueprints/handoff-audit.jsonl'), 'utf8')).trim().split('\n')
    const record = JSON.parse(lines.at(-1))
    assert.equal(record.runId, 'run-1')
    assert.equal(record.status, 'done')
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
