# Reference HTTP Runner

An intentionally small, dependency-free external runner for the Blueprint Studio
handoff protocol (v0.10+). It turns `handoff.json` into one `POST` request and
writes the validated `result.json` that `/blueprint run collect` consumes.

This is a reference implementation, not a hosted service. The endpoint is
trusted infrastructure supplied by the workspace owner. It requires Node.js 18+
for the global `fetch` API.

## Usage

```bash
# 1. Prepare the job in the Host
#    /blueprint run prepare run-...

# 2. Dry run: validate the handoff and endpoint, send nothing
node examples/http-runner/runner.mjs \
  <workspace>/.dsh/blueprints/<session>.runs/<runId>/handoff.json \
  --endpoint env:MY_BLUEPRINT_ENDPOINT

# 3. Explicitly POST and write result.json
node examples/http-runner/runner.mjs <handoff.json> --execute --endpoint env:MY_BLUEPRINT_ENDPOINT

# Other endpoint forms
node examples/http-runner/runner.mjs <handoff.json> --execute --endpoint http://127.0.0.1:8787/run
BLUEPRINT_HTTP_ENDPOINT=http://127.0.0.1:8787/run \
  node examples/http-runner/runner.mjs <handoff.json> --execute

# 4. Collect in the Host
#    /blueprint run collect <runId>
```

Options:

| Option | Meaning |
| --- | --- |
| `--execute` | Actually send the request. Without it the runner is a dry run. |
| `--endpoint env:NAME\|URL` | Endpoint override; highest priority. |
| `--force-adapter` | Accept a handoff whose `adapter` is not `http` (explicit opt-in). |
| `--timeout <ms>` | Request timeout, default `120000`. |
| `--help` | Usage. |

## Endpoint resolution

Priority order:

1. `--endpoint`
2. `handoff.endpointRef` (`env:NAME` or an absolute `http(s)` URL)
3. `BLUEPRINT_HTTP_ENDPOINT`

There is no fallback: a missing endpoint is a hard error. Only `http:` and
`https:` are accepted. URLs containing a username/password are rejected; use the
token environment variable instead.

> Integration note: the v0.10 handoff builder currently does not copy
> `module.execution.endpointRef` into `handoff.json`. Until it does, pass
> `--endpoint` or set `BLUEPRINT_HTTP_ENDPOINT`. The runner already honors
> `handoff.endpointRef` for forward compatibility.

## Request

`POST <endpoint>` with `content-type: application/json`, a short User-Agent, and
the full parsed handoff JSON as the body. `auto:false` stays `false`: the runner
decides whether to execute.

If `BLUEPRINT_HTTP_TOKEN` is set, the runner adds:

```http
Authorization: Bearer <token>
```

The token comes only from the environment. It is never read from
`handoff.json`, printed to stdout/stderr, written to `result.json`, or included
in error messages. Redirects are disabled (`redirect: "error"`), so a token is
not forwarded to another origin.

## Response contract

The response must be a JSON object:

```json
{
  "runId": "run-...",
  "status": "done",
  "summary": "implemented and tested",
  "evidence": [{ "kind": "test", "text": "pnpm test: 42 passed" }],
  "changedPaths": ["src/app.ts"],
  "nextAction": null,
  "error": null
}
```

- `runId` may be omitted; the runner fills in `handoff.runId`.
- If present, `runId` must equal `handoff.runId`.
- `status` must be `done`, `failed`, or `blocked` (case-insensitive in the
  response; written lowercase).
- `evidence` accepts strings or `{kind?,text}` objects, max 50 entries.
- `changedPaths` is a string array, max 200 entries.
- Unknown fields are dropped.

On success, the normalized object is written atomically to
`handoff.resultPath`, resolved inside the workspace root. The runner then prints
a JSON summary (mode/status/paths/redacted endpoint).

## Failure behavior

The runner never fails silently and never writes a fake `done`:

| Situation | Outcome |
| --- | --- |
| Non-2xx response | `failed` result with the HTTP status |
| Response body is not JSON | `failed` result |
| Request timeout | `failed` result mentioning the timeout |
| Invalid/mismatched `runId` or `status` | `failed` result explaining the schema error |
| Network/redirect error | `failed` result with a stable error code |
| Missing endpoint | `HandoffError` (`missing-endpoint`), no request, no result |
| Adapter is not `http` | `HandoffError` unless `--force-adapter` |

A malformed `handoff.json`, unsafe `resultPath`, or run id fails before any
request is made. `result.json` is only written to a path inside the workspace
root derived from `.dsh`.

## Security

- `--execute` is an explicit operator decision; dry-run never sends traffic.
- The bearer token lives only in memory and the request header.
- Endpoint output is redacted (userinfo, query, fragment) before logging.
- Response bodies are never echoed into `result.json` or error messages.
- HTTPS certificate verification uses Node's defaults.
- The runner is not a sandbox. The remote endpoint receives the full handoff
  prompt, mounts and acceptance text; send it only to trusted infrastructure.
- The runner does not implement the optional CLI runner policy file
  (`handoff-policy.json`) or audit log; use the CLI runner when you need those
  controls.
- A collected `done` result is not an acceptance pass; tests/reviewer/human
  verification remains a separate `/blueprint verify` step.

## Limitations

- One request, no retries, no streaming, no batching.
- No endpoint allowlist, mTLS client certificate, or custom CA configuration.
- No request-body size cap beyond normal `fetch`/Node limits.
- Result evidence beyond 50 entries is rejected; the remote must aggregate.
- The workspace is located by walking up to the nearest `.dsh` directory.
