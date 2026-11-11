# Reference dsh-subagent Runner

A dependency-free reference runner for the Blueprint Studio handoff protocol
(v0.10+), aimed at `adapter: "dsh-subagent"` jobs.

It does **not** import a private DSH API and does **not** spawn a subagent by
itself. It prepares the prompt and, only with `--execute`, pipes that prompt into
a host-provided bridge command through stdin. The host/human owns that bridge.

## Usage

```bash
# 1. Host writes handoff.json
#    /blueprint run prepare run-...

# 2. Dry run: validate and write prompt.txt, do not run anything
node examples/dsh-subagent-runner/runner.mjs \
  <workspace>/.dsh/blueprints/<session>.runs/<runId>/handoff.json

# 3. With a host bridge: execute and collect the subagent's result.json
DSH_SUBAGENT_CMD="my-dsh-subagent-bridge --profile desktop" \
  node examples/dsh-subagent-runner/runner.mjs <handoff.json> --execute --timeout 600000

# 4. Host collects
#    /blueprint run collect <runId>
```

Options:

| Option | Meaning |
| --- | --- |
| `--execute` | Run `DSH_SUBAGENT_CMD` with `prompt.txt` on stdin. |
| `--timeout <ms>` | Command timeout, default `120000`. |
| `--help` | Usage. |

`DSH_SUBAGENT_CMD` is a shell command string. It is never placed on the runner's
command line by the runner and never logged. The prompt is passed on stdin, not
in argv:

```text
host bridge (reads stdin) -> real subagent / DSH session -> writes result.json
```

If your bridge cannot read stdin, write a small adapter that does; do not import
internal DSH modules from this example.

## prompt.txt

`prompt.txt` is written next to `handoff.json` during both dry-run and execute.
It contains:

- run id, module code/id, adapter, cwd and workspace root;
- the complete `handoff.prompt` (scope, requirements, acceptance, mounts);
- the result file path (relative to the workspace root);
- the result JSON contract, evidence expectations, and the rule against
  claiming `done` or editing blueprints/verification files.

The prompt file is the handoff artifact for a human/manual bridge as well. It may
contain repository paths and requirement text; treat it as workspace data.

## Result handling

The subagent is expected to write `handoff.resultPath`:

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

The runner validates `runId` and `status`, then reports the result. It does not
rewrite, enrich, or downgrade a valid subagent result.

| Situation | Runner behavior |
| --- | --- |
| `result.json` exists and is valid | Reports it unchanged (still needs `/blueprint run collect`). |
| `result.json` is missing after the command | Writes a `blocked` result with prompt path, exit code and stderr excerpt; never fabricates `done`. |
| `result.json` existed before execution and was not changed | Treats it as stale and writes `blocked`. |
| `result.json` is malformed or has a wrong `runId`/`status` | Throws a `HandoffError` and **does not overwrite** the file. |
| `--execute` without `DSH_SUBAGENT_CMD` | Writes a `blocked` result explaining how to configure the bridge. |

The `blocked` result keeps the run lease alive; `/blueprint run collect` records
the blocked state and `nextAction`.

## Security

- Nothing runs without `--execute`.
- The child process inherits the runner environment, including any secrets in
  it. Use a dedicated bridge profile/environment; do not print secrets in the
  child's stdout/stderr, because those streams are captured and may be echoed by
  the CLI and copied into `blocked` evidence (stderr capped to 2,000 chars).
- The shell command comes from `DSH_SUBAGENT_CMD`, not from `handoff.json`, so a
  workspace-controlled handoff cannot choose an arbitrary command.
- `cwd`, `resultPath`, and `prompt.txt` are resolved inside the workspace root
  derived from `.dsh`.
- Sandboxing is the host bridge's responsibility. This runner is not a sandbox.
- Treat `prompt.txt` and `result.json` as workspace data; do not commit them if
  they contain sensitive paths or output.

## Limitations

- No DSH API integration, no agent-profile auto-selection, no session
  management: the bridge must implement those.
- No retries, no parallel jobs, no output streaming.
- The bridge must write the result file; stdout is captured for diagnostics but
  is never parsed as the result.
- A `done` result is not an acceptance pass; use `/blueprint verify` for
  tests/reviewer/human verification.
