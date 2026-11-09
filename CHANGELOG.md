# Changelog

All notable changes to Blueprint Studio are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic versioning.

## [0.5.2] — 2026-11-09

### Fixed

- **State diagrams no longer stretch into one very wide horizontal row.** State ranks are now laid out top-to-bottom with a compact rank gap; states in the same rank fan out horizontally. An eight-state chain stays under 500 px wide and under 1000 px tall instead of spanning 2,000+ px horizontally.

## [0.5.1] — 2026-11-09

### Added

- **Explicit UI language switch.** The header now has a `中 / EN` control. The selected language is stored in `localStorage` and survives closing/reopening the studio; without a stored preference the host locale is still followed.

### Fixed

- `group` and `note` nodes no longer produce `node-isolated` warnings; group containers legitimately have no incoming/outgoing edges.
- Mermaid flowchart import now infers missing terminals: when no `start`/`end` nodes exist, synthetic capsules are added around the root and leaf steps so imported plans do not fail `plan-terminal-missing`.

## [0.5.0] — 2026-11-09

### Added

- **Plan Flowchart, the ninth diagram type.** `start`/`end` capsules, `process` rectangles, `decision` diamonds, `group` containers and `note` cards; labelled solid/dashed edges, deterministic top-down rank layout with orthogonal paths, and collapsible groups.
- **Plan mode contract.** `PLAN_MODE_PROMPT` requires goal/non-goal, constraints, ordered steps, decision branches, parallel groups, per-step verification and rollback before implementation; it is injected into the Host system prompt.
- **Implementation-plan starter.** A fifth welcome template with a populated flowchart containing a decision, a group, verification on every process and a retry/rollback loop.
- **Plan checks.** `/blueprint check` now appends the nine `plan-*` rules when the blueprint contains a flowchart: missing plan, missing terminals, decision branches/labels, unverified steps, failure branch, dangling group and node-count guidance.
- **Mermaid flowchart interop.** `flowchart TD/LR` now maps to the plan flowchart (rectangle/decision/stadium, labels, dashed edges, one-level `subgraph` groups); export emits `flowchart TD` with groups and labels.

### Changed

- The layer command/palette and template slots expose nine diagrams; old eight-diagram blueprints never gain a flowchart automatically.
- Mermaid export is intentionally lossy: notes are comments, and GUI-only `condition`/`owner`/`verification`/`collapsed` metadata is not encoded.
- README, `docs/plan-mode.md`, and the built-in prompt example now describe the implemented model and pass the plan checks themselves.

### Fixed

- Note nodes were exported both as a comment and as a process rectangle, so re-import changed their type; they are now comment-only.
- A key-only `{ "key": "flowchart" }` input now counts as an explicit diagram model instead of auto-adding eight empty root slots.
- Added readable errors for nested/unclosed/empty subgraphs and unsupported Mermaid shapes.
## [0.4.4] — 2026-11-08

### Added

- **Persistent layer navigation bar.** Every layer letter (A/B/C/…) is shown in a top bar; the current layer uses the brand color and the rest use secondary text. Clicking a letter switches directly to that layer, so navigating no longer requires drilling through module nodes. The bar scrolls horizontally for deep trees and is hidden while only the root layer exists.

## [0.4.3] — 2026-11-08

### Fixed

- **Root layer A is no longer forced to eight diagrams when the input is explicitly layered.** A root that only needs the module overview can now keep exactly its explicit diagrams; legacy/untyped input still gets the eight default slots. Added `removedDiagramKeys` to `blueprint update` so the agent can deliberately strip root detail diagrams after moving them to child layers.
- **Tool summaries now list every layer** (letter, title, parent module) in `get`/`update` output, so an agent can verify the actual layer tree instead of inferring it from its plan.
- Regression tests cover an explicit root with only the module diagram and removal of a root diagram via `removedDiagramKeys`.

## [0.4.2] — 2026-11-08

### Fixed

- **Partial `blueprint update` no longer drops sibling modules or layers.** A patch that only contains a new child module (e.g. adding `B4` under `datahub`) previously replaced the whole `modules` array, so the existing `datahub` module disappeared and validation failed with `层 B 的 parentModuleId 不存在：datahub`. Modules are now merged by stable id and layers by letter; omitted entries are preserved.
- Added explicit `removedModuleIds` / `removedLayerIds` for deletions, documented in the `update` tool description.
- Added a regression test covering a B-layer child module update with an existing `datahub` parent anchor.

## [0.4.1] — 2026-11-08

### Added

- **Layered acceptance verification.** Modules now carry optional `verification.tests` / `reviewer` / `human` entries (`status`, `evidence[]`, `at`). Normalization defaults missing or malformed entries to `pending`, a single `failed` layer forces `needs-rework`, and only three `passed` layers produce `done`.
- **`/blueprint verify <moduleId> <tests|reviewer|human> <passed|failed|pending> [evidence]`.** The Host validates the module, role and status, appends evidence, updates the aggregated module status, archives the previous blueprint and writes the file.
- **Verification UI in the Modules panel.** Each module lists its acceptance criteria and the three layers with status and evidence summary, plus a role/result/evidence form that calls the Host command. The status chip supports `needs-rework`, and marking `done` without three passes is refused with a readable hint.
- **`module-verification-incomplete` check.** A module claiming `done` without all three layers passed is reported as an error; a module with no acceptance criteria is still reported once by `module-acceptance-missing` instead of double-reporting.
- **`test/acceptance.test.mjs`.** Covers normalization, inheritance, aggregation, the command helper, the agent-update trust boundary, the new check and an end-to-end `/blueprint verify` run.

### Changed

- Agent tool `update` preserves the previous module `verification` by module id (a new module starts pending); `create` remains a full replacement.

## [0.4.0] — 2026-11-08

### Added

- **Layered module scopes (route B).** A blueprint can now contain parent/child/grandchild layers: layer `A` is the root, each child layer gets the next letter (`B`, `C`, …), and modules use a `A1`/`B1`/`C1` code while keeping a stable internal id. Every layer can hold its own eight diagram instances (`diagram.layerId` + `type`), created lazily.
- **Drill-down canvas.** Double-click a module node or use its corner button to enter its child layer; breadcrumbs, back/ESC, and leaf detection are included. Parent layers only show their own modules.
- **Global search.** The header searches requirement codes/text, module codes/names/summaries, and layer letters/titles; results navigate to the target layer, diagram and node/requirement.
- **Progressive requirements.** Requirement items carry stable `uid`/`code` and optional `moduleId`; the left panel filters by the active layer and can include descendants.
- **Markdown/HTML export.** Current-layer and all-layer Markdown; a single-file, no-external-network HTML review page with layer navigation and search. Host commands: `/blueprint export md|html [all|<layer>]`.
- **Self-check and coverage.** `/blueprint check` returns 17 rules (broken edges, dependency cycles, missing module codes/acceptance, unassigned requirements, etc.) plus a per-layer requirement coverage matrix; exposed as a Checks panel.
- **Stable-ID requirement diff and review queue.** Requirement changes are `added`/`removed`/`modified` by `uid`, with word-level (CJK character-level) highlighting; each item can be accepted or rejected, with bulk actions and undo.
- **Confirmation gate.** `/blueprint confirm` issues a Host-memory, one-time token bound to the session and blueprint hash; `/blueprint dispatch <token>` consumes it. Tool `confirm`/`dispatch` are disabled and tool `update` cannot change status.
- **Data-safety fixes.** Explicitly cleared requirement sections stay empty; tool updates merge nodes/edges by stable id with explicit removal refs; layout only assigns missing coordinates.

### Changed

- Blueprint JSON schema is now version 2 with `layers`; 0.3.x files migrate to root layer A on first normalize.
- All diagram layout/render/export paths use `diagram.type`; root keeps legacy keys and child diagrams use `<layer>:<type>`.
- README/package version raised to 0.4.0.

### Fixed

- Partial agent updates no longer delete unmentioned nodes, edges, or human-adjusted coordinates.
- Confirmation can no longer be performed by directly calling the agent tool.

## [0.3.0] — 2026-11-07

### Added

- **Eight diagrams.** Added class diagrams (classes/interfaces, fields, methods, extends/implements/association/dependency) and state diagrams (states, initial/final, choice, labelled transitions), with deterministic layout, inspector editing, SVG/JSON/Mermaid export and draw.io fallback.
- **Mermaid import.** Auto-detects draw.io vs Mermaid and imports `classDiagram`, `stateDiagram-v2` and `flowchart`/`graph`; 200 KB / 200-node limits with typed errors.
- **Traceability.** Nodes carry `requirementIds`; modules carry `nodeIds`, `files` and `acceptance`. The inspector links them, the requirement list highlights related nodes, and dispatch prompts include the linked scope.
- **Actionable dispatch board.** Open a child session, cancel an active child, retry a module, and edit module status. `/blueprint cancel <childSessionId>` uses the public subagent interrupt API.
- **Draft autosave and generation recovery.** 1.8 s debounced drafts write without archiving a version; explicit saves still archive. Generation waits 60 s, then offers retry/cancel. Closing the studio awaits the save result.
- **Welcome templates.** Four offline starters (web app, CLI, data pipeline, DSH plugin) with requirements, populated use case/data flow/module diagrams, and dependent modules.
- **Richer version diff.** Diagram-level diff lists concrete added/removed nodes, changed node fields, and added/removed edges.
- **npm distribution.** `publish.yml` (provenance, `NPM_TOKEN`/Trusted Publishing), npm install documentation and a fresh release workflow; the release tarball remains the Git-free install path.

### Changed

- Manual blueprints and templates now create all eight diagram slots; applying a template clears previous class/state content.
- README examples, roadmap and package metadata updated for 0.3.0.

### Fixed

- `Ctrl+Z` and welcome-screen round-trip remain stable across autosave.
- Header diagram tabs scroll horizontally instead of overflowing at eight views.

## [0.2.1] — 2026-11-07

### Added

- **Undo / redo in the studio.** `Ctrl+Z` undoes the last blueprint change, `Ctrl+Shift+Z` / `Ctrl+Y` redo; toolbar buttons show availability. Changes are coalesced for fast typing and dragging, and a save or an agent update does not silently reset the undo stack.
- **Back to welcome.** A visible “初始页 / Welcome” action returns from the manual editor to the initial one-click generate screen. The existing blueprint is kept, and the welcome screen offers “继续编辑当前蓝图 / Continue editing current blueprint”.
- Welcome screen prefills the task description from an existing blueprint and can regenerate it without starting from zero.

### Changed

- Opening a saved blueprint no longer resets the local undo history when the file content is unchanged.
- The header hides editing actions (save/export/dispatch/undo) while on the welcome screen.
- Package version raised to `0.2.1`.
- Relicensed to Apache-2.0 for the public repository; the source and README are unchanged apart from the license.

### Fixed

- Back button children were not wrapped, leaving it without a visible label.
- `Ctrl+Z` now works while a requirement textarea or field input is focused instead of being swallowed by native text undo.

## [0.2.0] — 2026-11-07

### Added

- Sequence diagrams: participants, lifelines, ordered sync/async/return messages, message inspector.
- ER diagrams: entities with typed fields and primary keys, relationship diamonds, cardinality labels.
- C4 diagrams: person, system, container, component, database and external system nodes with technology and responsibility labels.
- Version history: automatic archive before every write, manual snapshots, a 40-version manifest, semantic diff, and one-click restore.
- Live subagent board: child sessions of the current conversation refreshed every five seconds, module status and navigation.
- draw.io import by paste or file, replacing or appending to the current diagram; draw.io XML export.
- Unit tests for normalization, semantic diff and version archiving.
- Architecture, contribution and CI scaffolding for publishing as `dsh-blueprint-studio`.

### Changed

- A blueprint now starts with six diagram kinds; older three-diagram files are upgraded on load.
- `normalizeBlueprint` preserves `createdAt`, module status, module summaries, and subagent session ids.
- Empty diagrams can now be cleared intentionally; the normalizer only reuses previous content when the field is absent.
- Package renamed from `@local/dsh-blueprint-studio` to `dsh-blueprint-studio` and version raised to `0.2.0`.

### Fixed

- Client state now publishes immutable snapshots, so the studio opens reliably.
- Workspace path resolution uses the session header cwd, matching the client's `workspaceFiles` scope.
- Tool `get` returns the full blueprint JSON to the agent.
- SVG export inlines theme colors so the exported file renders outside Harness.

## [0.1.0] — 2026-11-06

### Added

- Initial Host tool and `/blueprint` command.
- Requirement columns, use-case, data-flow and module diagrams.
- SVG canvas with drag, pan/zoom, connect and auto-layout.
- AI generate/expand and confirm-and-dispatch prompt.
- JSON, Mermaid and SVG export; English and Simplified Chinese UI.
