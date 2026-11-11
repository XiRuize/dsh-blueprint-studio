# Reference Handoff Runner

Minimal external runner for the v0.10 handoff protocol. It is intentionally
small and dependency-free.

## Usage

From the Blueprint Studio repository (or copy this folder elsewhere):

```bash
# dry run: validate and print the commands, write nothing
node examples/handoff-runner/runner.mjs <workspace>/.dsh/blueprints/<session>.runs/<runId>/handoff.json

# explicitly execute commands and write result.json
node examples/handoff-runner/runner.mjs <handoff.json> --execute

# optional
node examples/handoff-runner/runner.mjs <handoff.json> --execute --timeout 300000 --changed-path src/app.ts
```

After it runs:

```text
/blueprint run collect <runId>
```

## Behavior

| Handoff adapter | Behavior |
| --- | --- |
| `cli` | dry-run by default; with `--execute`, runs each command in `cwd` and captures stdout/stderr/exit |
| `manual` | writes `blocked`; a human must execute |
| `http` | writes `blocked`; use an HTTP runner with the endpoint ref |
| `dsh-subagent` | writes `blocked`; use a DSH subagent runner |

The runner never executes without `--execute`. It refuses handoffs outside a
`.dsh/blueprints` tree, result paths escaping the workspace, invalid run ids,
unknown adapters and invalid schemas.

## Result

`result.json` is written next to `handoff.json`:

```json
{
  "runId": "run-...",
  "status": "done",
  "summary": "Executed 1 command(s).",
  "evidence": [
    { "kind": "command", "text": "$ pnpm test\nexit=0" },
    { "kind": "stdout", "text": "..." }
  ],
  "changedPaths": []
}
```

A failing command writes `failed` with stderr and stops; later commands are not
run. The result is validated again by `/blueprint run collect`.

## Security

- Commands come from the handoff produced by the Blueprint module; `--execute`
  is an explicit human/runner decision.
- No secrets are read from the handoff; use the runner environment/profile.
- `cwd` and `resultPath` are resolved inside the workspace root.
- This is a reference runner, not a sandbox. Run it only with trusted blueprints.
