# Architecture

Blueprint Studio is a two-half DSH bundle:

- **Host** (`index.js`, `lib/blueprint.js`): tools, commands, prompt section, normalization, version archive, semantic diff.
- **Client** (`client.js`): a module-loader factory that renders the composer button and the full-screen studio.

## Why two halves

The Host is the only side that can write the workspace and register tools. The Client is the only side that can present an editable canvas inside the Harness theme. They meet on two public Remote surfaces:

| Operation | Surface | Direction |
| --- | --- | --- |
| Read current blueprint / history index | `workspaceFiles.read` | Client → Host |
| Save, snapshot, diff, restore | `commands.execute('/blueprint …')` | Client → Host |
| Ask the agent to generate/expand/dispatch | `session.prompt` | Client → Host |
| List child subagents | `session.list` | Client → Host |

No custom RPC, no iframe, no second HTTP server.

## Data flow

```
prompt
  │
  ▼
agent ──blueprint tool──▶ normalize ──▶ write JSON ──▶ archive previous
  │                                         │
  └──returns summary────────────────────────┘
                                            │
client polls workspaceFiles ◀───────────────┘
  │
  ├─ human edits ──▶ /blueprint save ──▶ archive + write
  ├─ versions ─────▶ /blueprint diff  ──▶ semanticDiff
  ├─ restore ──────▶ /blueprint restore ─▶ archive + write
  └─ confirm ──────▶ session.prompt("dispatch…") ──▶ subagents
```

## Storage layout

```
<session cwd>/.dsh/blueprints/
├── <sessionId>.json
└── <sessionId>.versions/
    ├── index.json
    └── v-<time>-<rand>.json
```

The manifest is capped at 40 entries; evicted files are removed best-effort. A version entry carries `id`, `at`, `source`, `label`, `title`, `status`, counts and a content fingerprint (excluding `updatedAt`). The fingerprint prevents duplicate archives when nothing changed.

## Normalization

`normalizeBlueprint(input, previous, {sessionId})` is the single place that:

- guarantees the seven requirement sections and six diagram kinds;
- validates node types per diagram and resolves edge endpoints by id or label;
- preserves positions, ER fields, C4 technology/description, sequence order and cardinality;
- merges by stable ids so agent updates do not erase human edits;
- keeps `createdAt`, module status and `subagentSessionId`.

The client never writes an unnormalized file.

## Layout

Layout is deterministic and runs in the browser:

- use case: actors left, use cases in a grid inside an optional system boundary;
- DFD: external entities → processes → stores;
- module: dependency levels;
- sequence: participants across the top, messages at fixed vertical steps;
- ER: entity grid plus relationship column;
- C4: people left, containers/components center, external systems right.

AI output only contains semantics, so the model never has to invent pixel coordinates.

## Compatibility

- One blueprint per session, keyed by session id.
- Older three-diagram files are upgraded on read; unknown node types fall back to a diagram default.
- Version files are plain JSON; a missing index is treated as empty history.
- All writes are atomic (temp file + rename) and all reads tolerate missing files.
