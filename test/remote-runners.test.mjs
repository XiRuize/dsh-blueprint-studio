import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  HandoffError as HttpHandoffError,
  redactEndpoint,
  resolveEndpoint,
  runHttpHandoff,
  validateHandoff as validateHttpHandoff,
} from '../examples/http-runner/runner.mjs'
import {
  HandoffError as DshHandoffError,
  buildPromptText,
  runDshHandoff,
  validateHandoff as validateDshHandoff,
} from '../examples/dsh-subagent-runner/runner.mjs'

const RESULT_RELATIVE = '.dsh/blueprints/session.runs/run-1/result.json'

async function fixture(adapter = 'http', overrides = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bp-remote-runner-'))
  const dir = path.join(root, '.dsh', 'blueprints', 'session.runs', 'run-1')
  await fs.mkdir(dir, { recursive: true })
  const handoff = {
    version: 1,
    runId: 'run-1',
    moduleId: 'm1',
    moduleCode: 'A1',
    adapter,
    cwd: '.',
    commands: [],
    prompt: '实现登录模块，并补充测试。',
    acceptance: ['测试通过'],
    resultPath: RESULT_RELATIVE,
    auto: false,
    ...overrides,
  }
  const handoffPath = path.join(dir, 'handoff.json')
  await fs.writeFile(handoffPath, JSON.stringify(handoff), 'utf8')
  return {
    root,
    dir,
    handoff,
    handoffPath,
    resultPath: path.join(root, RESULT_RELATIVE),
    async cleanup() {
      await fs.rm(root, { recursive: true, force: true })
    },
  }
}

async function startServer(handler) {
  const requests = []
  const server = http.createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = Buffer.concat(chunks).toString('utf8')
    requests.push({ method: request.method, url: request.url, headers: request.headers, body })
    try {
      await handler(request, response, body)
    } catch {
      if (!response.headersSent) {
        response.statusCode = 500
        response.end('handler failure')
      }
    }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  return {
    url: `http://127.0.0.1:${port}/run`,
    requests,
    async close() {
      server.closeAllConnections?.()
      await new Promise(resolve => server.close(() => resolve()))
    },
  }
}

function jsonResponder(payload, statusCode = 200) {
  return (_request, response) => {
    response.statusCode = statusCode
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(payload))
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

test('http endpoint resolution follows CLI, handoff, then environment priority', () => {
  const env = {
    BLUEPRINT_HTTP_ENDPOINT: 'http://env.example/run',
    MY_ENDPOINT: 'http://handoff.example/run',
  }
  assert.equal(
    resolveEndpoint({ endpoint: 'http://cli.example/run', endpointRef: 'env:MY_ENDPOINT', env }).url,
    'http://cli.example/run',
  )
  assert.equal(resolveEndpoint({ endpointRef: 'env:MY_ENDPOINT', env }).url, 'http://handoff.example/run')
  assert.equal(resolveEndpoint({ env }).url, 'http://env.example/run')
  assert.throws(() => resolveEndpoint({ env: {} }), error => error instanceof HttpHandoffError && error.code === 'missing-endpoint')
  assert.throws(() => resolveEndpoint({ endpoint: 'ftp://example.com/run', env: {} }), /http\/https/)
  assert.throws(() => resolveEndpoint({ endpoint: 'http://user:pass@example.com/run', env: {} }), /用户名或密码/)
  assert.equal(redactEndpoint('http://example.com/run?token=secret#part'), 'http://example.com/run')
})

test('handoff validation rejects unsafe run ids, adapters and result paths', async () => {
  const { root, handoff, cleanup } = await fixture('http')
  try {
    assert.equal(validateHttpHandoff(handoff).runId, 'run-1')
    for (const runId of ['', '../run-1', 'run-1/..', 'RUN-1', 'run_1']) {
      assert.throws(() => validateHttpHandoff({ ...handoff, runId }), error => error instanceof HttpHandoffError && error.code === 'invalid-run-id')
    }
    assert.throws(() => validateHttpHandoff({ ...handoff, adapter: 'carrier-pigeon' }), /不支持的 adapter/)
    for (const resultPath of ['', '../outside.json', '/absolute.json', 'a/../../outside.json', 'C:\\outside.json']) {
      assert.throws(
        () => validateHttpHandoff({ ...handoff, resultPath }),
        error => error instanceof HttpHandoffError && error.code === 'invalid-result-path',
      )
    }
    assert.equal(validateDshHandoff({ ...handoff, adapter: 'dsh-subagent' }).adapter, 'dsh-subagent')
    assert.throws(() => validateDshHandoff({ ...handoff, resultPath: '../x.json' }), DshHandoffError)
    assert.ok(root)
  } finally {
    await cleanup()
  }
})

test('http dry-run sends no request and writes no result', async () => {
  const server = await startServer(jsonResponder({ status: 'done' }))
  const fixtureState = await fixture('http', { endpointRef: server.url })
  try {
    const outcome = await runHttpHandoff(fixtureState.handoffPath, { env: {} })
    assert.equal(outcome.mode, 'dry-run')
    assert.equal(outcome.status, 'dry-run')
    assert.equal(server.requests.length, 0)
    await assert.rejects(fs.stat(fixtureState.resultPath))
  } finally {
    await fixtureState.cleanup()
    await server.close()
  }
})

test('http execute posts the handoff and writes a validated done result', async () => {
  const server = await startServer(jsonResponder({
    status: 'done',
    summary: 'remote ok',
    evidence: [{ kind: 'test', text: '2 passed' }],
    changedPaths: ['src/app.ts'],
  }))
  const fixtureState = await fixture('http', { endpointRef: server.url })
  try {
    const outcome = await runHttpHandoff(fixtureState.handoffPath, { execute: true, env: {} })
    assert.equal(outcome.mode, 'executed')
    assert.equal(outcome.status, 'done')
    assert.equal(server.requests.length, 1)
    const request = server.requests[0]
    assert.equal(request.method, 'POST')
    assert.match(String(request.headers['content-type']), /application\/json/)
    const posted = JSON.parse(request.body)
    assert.equal(posted.runId, 'run-1')
    assert.equal(posted.adapter, 'http')
    assert.match(posted.prompt, /登录模块/)

    const result = await readJson(fixtureState.resultPath)
    assert.equal(result.runId, 'run-1')
    assert.equal(result.status, 'done')
    assert.equal(result.summary, 'remote ok')
    assert.deepEqual(result.evidence, [{ kind: 'test', text: '2 passed' }])
    assert.deepEqual(result.changedPaths, ['src/app.ts'])
    assert.deepEqual(outcome.result, result)
  } finally {
    await fixtureState.cleanup()
    await server.close()
  }
})

test('http response with a mismatched runId becomes a failed result', async () => {
  const server = await startServer(jsonResponder({ runId: 'run-other', status: 'done' }))
  const fixtureState = await fixture('http', { endpointRef: server.url })
  try {
    const outcome = await runHttpHandoff(fixtureState.handoffPath, { execute: true, env: {} })
    assert.equal(outcome.status, 'failed')
    const result = await readJson(fixtureState.resultPath)
    assert.equal(result.status, 'failed')
    assert.match(result.error, /runId/)
  } finally {
    await fixtureState.cleanup()
    await server.close()
  }
})

test('http non-JSON response becomes a failed result', async () => {
  const server = await startServer((_request, response) => {
    response.statusCode = 200
    response.end('this is not json')
  })
  const fixtureState = await fixture('http', { endpointRef: server.url })
  try {
    const outcome = await runHttpHandoff(fixtureState.handoffPath, { execute: true, env: {} })
    assert.equal(outcome.status, 'failed')
    const result = await readJson(fixtureState.resultPath)
    assert.match(result.error, /不是合法 JSON/)
  } finally {
    await fixtureState.cleanup()
    await server.close()
  }
})

test('http non-2xx response becomes a failed result', async () => {
  const server = await startServer(jsonResponder({ status: 'done' }, 500))
  const fixtureState = await fixture('http', { endpointRef: server.url })
  try {
    const outcome = await runHttpHandoff(fixtureState.handoffPath, { execute: true, env: {} })
    assert.equal(outcome.status, 'failed')
    const result = await readJson(fixtureState.resultPath)
    assert.match(result.error, /500/)
  } finally {
    await fixtureState.cleanup()
    await server.close()
  }
})

test('http invalid status becomes a failed result', async () => {
  const server = await startServer(jsonResponder({ status: 'finished' }))
  const fixtureState = await fixture('http', { endpointRef: server.url })
  try {
    const outcome = await runHttpHandoff(fixtureState.handoffPath, { execute: true, env: {} })
    assert.equal(outcome.status, 'failed')
    const result = await readJson(fixtureState.resultPath)
    assert.match(result.error, /status/)
  } finally {
    await fixtureState.cleanup()
    await server.close()
  }
})

test('http timeout becomes a failed result', async () => {
  const server = await startServer((_request, response) => {
    setTimeout(() => {
      response.statusCode = 200
      response.setHeader('content-type', 'application/json')
      response.end('{"status":"done"}')
    }, 500)
  })
  const fixtureState = await fixture('http', { endpointRef: server.url })
  try {
    const outcome = await runHttpHandoff(fixtureState.handoffPath, { execute: true, timeoutMs: 50, env: {} })
    assert.equal(outcome.status, 'failed')
    const result = await readJson(fixtureState.resultPath)
    assert.match(result.error, /超时/)
  } finally {
    await fixtureState.cleanup()
    await server.close()
  }
})

test('http bearer token reaches the endpoint but never the result or outcome', async () => {
  const server = await startServer(jsonResponder({
    status: 'done',
    summary: 'token accepted',
    evidence: [{ kind: 'test', text: 'ok' }],
  }))
  const fixtureState = await fixture('http', { endpointRef: server.url })
  const token = 'top-secret-token-value'
  try {
    const outcome = await runHttpHandoff(fixtureState.handoffPath, {
      execute: true,
      env: { BLUEPRINT_HTTP_TOKEN: token },
    })
    assert.equal(server.requests[0].headers.authorization, `Bearer ${token}`)
    const resultText = await fs.readFile(fixtureState.resultPath, 'utf8')
    assert.doesNotMatch(resultText, new RegExp(token))
    assert.doesNotMatch(JSON.stringify(outcome), new RegExp(token))
    assert.equal(outcome.status, 'done')
  } finally {
    await fixtureState.cleanup()
    await server.close()
  }
})

test('http runner refuses non-http adapters unless forced', async () => {
  const server = await startServer(jsonResponder({ status: 'done' }))
  const fixtureState = await fixture('cli', { endpointRef: server.url })
  try {
    await assert.rejects(
      runHttpHandoff(fixtureState.handoffPath, { execute: true, env: {} }),
      error => error instanceof HttpHandoffError && error.code === 'invalid-adapter',
    )
    const outcome = await runHttpHandoff(fixtureState.handoffPath, {
      execute: true,
      forceAdapter: true,
      env: {},
    })
    assert.equal(outcome.status, 'done')
    assert.equal(server.requests.length, 1)
    assert.equal(JSON.parse(server.requests[0].body).adapter, 'cli')
  } finally {
    await fixtureState.cleanup()
    await server.close()
  }
})

test('http runner reports a missing endpoint before sending anything', async () => {
  const fixtureState = await fixture('http')
  try {
    await assert.rejects(
      runHttpHandoff(fixtureState.handoffPath, { execute: true, env: {} }),
      error => error instanceof HttpHandoffError && error.code === 'missing-endpoint',
    )
    await assert.rejects(fs.stat(fixtureState.resultPath))
  } finally {
    await fixtureState.cleanup()
  }
})

test('dsh-subagent dry-run writes prompt.txt only and runs no command', async () => {
  const fixtureState = await fixture('dsh-subagent')
  try {
    const outcome = await runDshHandoff(fixtureState.handoffPath, { env: {} })
    assert.equal(outcome.mode, 'dry-run')
    assert.equal(outcome.commandConfigured, false)
    const prompt = await fs.readFile(path.join(fixtureState.dir, 'prompt.txt'), 'utf8')
    assert.match(prompt, /run-1/)
    assert.match(prompt, /实现登录模块/)
    assert.match(prompt, new RegExp(RESULT_RELATIVE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(prompt, /不要伪造 done/)
    assert.match(prompt, /blueprint verify/)
    await assert.rejects(fs.stat(fixtureState.resultPath))
  } finally {
    await fixtureState.cleanup()
  }
})

test('dsh-subagent execute without DSH_SUBAGENT_CMD writes blocked, not done', async () => {
  const fixtureState = await fixture('dsh-subagent')
  try {
    const outcome = await runDshHandoff(fixtureState.handoffPath, { execute: true, env: {} })
    assert.equal(outcome.mode, 'blocked')
    assert.equal(outcome.status, 'blocked')
    assert.equal(outcome.commandConfigured, false)
    assert.match(outcome.result.nextAction, /DSH_SUBAGENT_CMD/)
    const result = await readJson(fixtureState.resultPath)
    assert.equal(result.status, 'blocked')
    assert.equal(result.runId, 'run-1')
    assert.notEqual(result.status, 'done')
    await fs.stat(path.join(fixtureState.dir, 'prompt.txt'))
  } finally {
    await fixtureState.cleanup()
  }
})

test('dsh-subagent bridge receives prompt on stdin and its result is preserved', async () => {
  const fixtureState = await fixture('dsh-subagent')
  try {
    const script = [
      "let s='';",
      "process.stdin.on('data',d=>s+=d);",
      "process.stdin.on('end',()=>{",
      "require('node:fs').writeFileSync(process.env.TEST_RESULT_PATH,JSON.stringify({",
      "runId:'run-1',status:'done',summary:'mock subagent',",
      "evidence:[{kind:'test',text:'stdin chars '+s.length}],changedPaths:['src/login.ts']",
      "}))",
      "});",
    ].join('')
    const command = `"${process.execPath}" -e "${script}"`
    const outcome = await runDshHandoff(fixtureState.handoffPath, {
      execute: true,
      command,
      timeoutMs: 30000,
      env: { ...process.env, TEST_RESULT_PATH: fixtureState.resultPath },
    })
    assert.equal(outcome.mode, 'executed')
    assert.equal(outcome.status, 'done')
    assert.equal(outcome.exitCode, 0)
    const result = await readJson(fixtureState.resultPath)
    assert.equal(result.status, 'done')
    assert.equal(result.summary, 'mock subagent')
    assert.match(result.evidence[0].text, /stdin chars [1-9][0-9]*/)
    assert.deepEqual(result.changedPaths, ['src/login.ts'])
    assert.deepEqual(outcome.result, result)
  } finally {
    await fixtureState.cleanup()
  }
})

test('dsh-subagent command that writes no result produces blocked evidence', async () => {
  const fixtureState = await fixture('dsh-subagent')
  try {
    const command = `"${process.execPath}" -e "process.exit(0)"`
    const outcome = await runDshHandoff(fixtureState.handoffPath, {
      execute: true,
      command,
      timeoutMs: 30000,
      env: { ...process.env },
    })
    assert.equal(outcome.status, 'blocked')
    const result = await readJson(fixtureState.resultPath)
    assert.equal(result.status, 'blocked')
    assert.match(result.summary, /没有写入 result.json/)
    assert.match(result.error, /exit 0/)
    assert.ok(result.evidence.some(item => item.text.includes('prompt=')))
  } finally {
    await fixtureState.cleanup()
  }
})

test('dsh-subagent treats an unchanged pre-existing result as stale', async () => {
  const fixtureState = await fixture('dsh-subagent')
  try {
    await fs.mkdir(path.dirname(fixtureState.resultPath), { recursive: true })
    await fs.writeFile(fixtureState.resultPath, JSON.stringify({
      runId: 'run-1',
      status: 'done',
      summary: 'stale result',
    }), 'utf8')
    const command = `"${process.execPath}" -e "process.exit(0)"`
    const outcome = await runDshHandoff(fixtureState.handoffPath, {
      execute: true,
      command,
      timeoutMs: 30000,
      env: { ...process.env },
    })
    assert.equal(outcome.status, 'blocked')
    const result = await readJson(fixtureState.resultPath)
    assert.equal(result.status, 'blocked')
    assert.equal(result.error, 'stale-result')
    assert.match(result.summary, /没有变化/)
  } finally {
    await fixtureState.cleanup()
  }
})

test('dsh-subagent leaves a malformed subagent result untouched', async () => {
  const fixtureState = await fixture('dsh-subagent')
  try {
    const invalid = JSON.stringify({ runId: 'run-other', status: 'done' })
    await fs.mkdir(path.dirname(fixtureState.resultPath), { recursive: true })
    await fs.writeFile(fixtureState.resultPath, invalid, 'utf8')
    const script = [
      "const fs=require('node:fs');",
      "fs.writeFileSync(process.env.TEST_RESULT_PATH,JSON.stringify({runId:'run-other',status:'done',summary:'invalid'}))",
    ].join('')
    const command = `"${process.execPath}" -e "${script}"`
    await assert.rejects(
      runDshHandoff(fixtureState.handoffPath, {
        execute: true,
        command,
        timeoutMs: 30000,
        env: { ...process.env, TEST_RESULT_PATH: fixtureState.resultPath },
      }),
      error => error instanceof DshHandoffError && error.code === 'invalid-result',
    )
    const stillThere = await fs.readFile(fixtureState.resultPath, 'utf8')
    assert.equal(JSON.parse(stillThere).runId, 'run-other')
  } finally {
    await fixtureState.cleanup()
  }
})

test('dsh-subagent prompt builder includes cwd, run id and the result contract', async () => {
  const fixtureState = await fixture('dsh-subagent', { cwd: './apps/web' })
  try {
    const handoff = validateDshHandoff(fixtureState.handoff)
    const prompt = buildPromptText(handoff, {
      root: fixtureState.root,
      resultPath: handoff.resultPath,
      promptPath: '.dsh/blueprints/session.runs/run-1/prompt.txt',
    })
    assert.match(prompt, /apps\/web/)
    assert.match(prompt, /run-1/)
    assert.match(prompt, /只有|不要伪造 done/)
    assert.match(prompt, /最多 50 条/)
    assert.match(prompt, /tests\/reviewer\/human/)
  } finally {
    await fixtureState.cleanup()
  }
})
