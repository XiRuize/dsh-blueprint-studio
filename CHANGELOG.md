# Changelog

All notable changes to Blueprint Studio are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic versioning.

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
