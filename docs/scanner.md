# Repository scan and graph

Blueprint Studio can read an existing repository before asking the agent to plan
or change it.

## Commands

```text
/blueprint scan           # JSON: scan + suggestions
/blueprint scan preview   # JSON: metrics + tree + import summary + SVG thumbnail
/blueprint scan apply     # write mounts/modules/layers/diagrams into the blueprint
```

`scan` and `scan preview` are read-only. `scan apply` creates a draft blueprint
when none exists and preserves existing modules.

## Metrics

`scan.metrics` contains:

- `totals`: total/source/test/doc files and bytes, languages
- `packages`: per-package size, language mix, entry points, test commands,
  dependencies and `health {score, level, reasons}`
- `hotspots`: largest source directories
- `insights`: actionable gaps such as no tests, no test command, no docs,
  no entry, large files, high fan-out, vendor-heavy, unbound source

## Tree

`scan.tree` is a capped directory tree with `entry`, `test` and `doc` flags.
Ordinary files are omitted by default to keep large repositories cheap; set
`includeFiles: true` when a full file listing is required.

## Imports

`scan.imports` includes local file edges for:

- TS/JS: `import`, `export … from`, `require`, dynamic `import()`, plus
  `tsconfig`/`jsconfig` `baseUrl` and `paths` aliases; recursive `extends`
  (string/array, node_modules) and directly referenced configs are honored
- Python: package-relative `from .x import` and `src` layout absolute imports
- Go: imports under the `go.mod` module path
- Rust: `mod`, `crate::`, `super::`, `self::`

External packages are reported separately; unresolved local imports are capped.
`buildImportDiagram(scan)` turns the edges into a bounded directory/file graph
for the preview.

## Check scan

```text
/blueprint check scan
```

Runs the normal blueprint checks plus repository health insights
(`scan-no-tests`, `scan-large-files`, …). Each issue keeps its fix. Plain
`/blueprint check` does not scan the filesystem.

## Health history

```text
/blueprint scan snapshot [label]
/blueprint scan history
/blueprint scan diff [fromId|label] [toId|latest]
```

Snapshots store only aggregates: totals, languages, health, package scores and
insights. They live in `.dsh/blueprints/<session>.scan-history.json`, keep the
newest 20, and never contain file contents or environment variables. The diff
reports size/test/doc/health deltas, resolved/new insights and package health
changes.

## Cache

Preview/apply/check scan share a short in-memory scan cache (10 seconds, max 8
roots). `/blueprint scan` always bypasses it with a fresh scan. No scan cache is
written to disk, so restarting the host never serves stale data.


## Preview

`/blueprint scan preview` returns both a module SVG and an import SVG. The
Workspace panel renders:

- metrics/health/insights
- an expandable file tree with entry/test/doc badges and path copy
- Module graph / Import graph thumbnails; clicking an import-graph node selects
  and copies its path

Nothing is written until **Create structure diagram** is pressed.

## Layering

`scan apply` creates:

- A layer: package/workspace overview and a module diagram
- B/C layers: package internals (top source directories) with `B:module`
  diagrams

Root overview stays readable; package detail lives in child layers. Real import
edges are preferred over manifest-only dependencies.
