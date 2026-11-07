# Changelog

All notable changes to Blueprint Studio are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic versioning.

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
