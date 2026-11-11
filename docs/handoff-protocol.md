# Handoff Job Protocol

v0.10 adds a file-based execution contract for runs. The Host never spawns an
external process automatically; prepare/write/collect is explicit.

## Files

```text
.dsh/blueprints/<session>.runs/<runId>/handoff.json
.dsh/blueprints/<session>.runs/<runId>/result.json
```

`runId` must match `run-[a-z0-9-]+`.

## Prepare

```text
/blueprint run prepare <runId>
```

Requires an active (running/blocked) run with an existing module. Writes
`handoff.json`:

```json
{
  "version": 1,
  "runId": "run-...",
  "moduleId": "web",
  "moduleCode": "B1",
  "adapter": "cli",
  "cwd": "./apps/web",
  "mounts": [],
  "allow": ["src/**"],
  "commands": ["pnpm test"],
  "agentProfile": "desktop",
  "prompt": "...",
  "requirements": [],
  "acceptance": [],
  "resultPath": ".dsh/blueprints/<session>.runs/<runId>/result.json",
  "resultSchema": {},
  "auto": false
}
```

`auto:false` is intentional: the external runner decides whether to execute.

## Result

Write `result.json` next to the handoff:

```json
{
  "runId": "run-...",
  "status": "done",
  "summary": "implemented and tested",
  "evidence": [
    { "kind": "test", "text": "pnpm test: 42 passed" }
  ],
  "changedPaths": ["src/app.ts"],
  "nextAction": null,
  "error": null
}
```

Allowed statuses: `done`, `failed`, `blocked`. Evidence is capped at 50 entries.
Malformed JSON, mismatched `runId`, unknown status or missing file never writes
the ledger.

## Collect

```text
/blueprint run collect <runId>
```

Reads and validates `result.json`, appends evidence, then:

- `done` / `failed` → finish the run and archive the blueprint;
- `blocked` → set `blocked`, keep the lease, update `nextAction`.

Missing/invalid results return an error without modifying the blueprint.

## Heartbeat

```text
/blueprint run heartbeat <runId> [--ttl minutes]
```

Renews the lease for a running or blocked run (default 30 minutes). Commands that
finish a run clear the lease.

## Safety

- Optional `.dsh/blueprints/handoff-policy.json` enforces command allow/deny regexes, max commands, timeout/output caps, read-only mount refusal and a JSONL audit log.
- Handoff and result are advisory files; no command execution, HTTP request or
  subagent spawn happens automatically.
- Secrets must be supplied by the runner's environment/profile, never inside
  handoff.json.
- A completed run is not an acceptance pass; tests/reviewer/human verification
  remains independent.
