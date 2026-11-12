---
name: blueprint-studio
description: Use Blueprint Studio when a coding task needs an editable engineering plan before implementation: layered requirements, diagrams, workspace mounts, module execution runs, evidence and a review page.
---

# Blueprint Studio

Use this skill when the user asks for a plan, architecture, multi-module implementation, cross-folder work, or an auditable handoff.

## Workflow

1. **Scan first when the workspace is unfamiliar.**
   ```text
   /blueprint scan
   ```
   Read the detected packages, languages, entry points, test commands and suggested mounts. Do not invent paths.

2. **Create or update the blueprint.**
   - Fill the seven requirement columns.
   - For ≥6 modules or ≥3 domains, create child layers B/C.
   - Each child layer needs at least `letter:module`; add `letter:dfd`/`letter:sequence` for interfaces.
   - Bind modules to `mounts`; set `execution.cwd`, `allow`, `commands`, `adapter`.
   - Produce a `flowchart` plan with decisions, verification and rollback.

3. **Run checks before asking for confirmation.**
   ```text
   /blueprint check
   /blueprint review
   ```
   Fix deep-validation issues and unresolved gaps.

4. **Do not implement before confirmation.** The user confirms in the Blueprint panel; the Host issues a one-time token.

5. **Execute through the ledger, not chat memory.**
   ```text
   /blueprint run start <moduleId>
   /blueprint run prepare <runId>
   ```
   Run the handoff with the matching runner, then:
   ```text
   /blueprint run collect <runId>
   ```
   Add evidence for tests; complete/fail/cancel explicitly. `run complete` is not acceptance.

6. **Finish with review + verification.**
   - `/blueprint review html` for a single blueprint.
   - `/blueprint review project html` for all blueprints.
   - Record `tests` / `reviewer` / `human` verification separately.

## Rules

- Never fabricate coordinates; the renderer owns layout.
- Never put secrets in a blueprint or handoff; use env/profile references.
- Never start two runs on the same writable mount.
- Do not mark a module `done` without all three verification layers.
- Treat generated SVG as a deterministic projection, not a source of truth.
