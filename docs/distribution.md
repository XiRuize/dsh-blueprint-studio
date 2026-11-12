# Distribution

Blueprint Studio ships as a DSH plugin bundle: a Host entry (`index.js`), a
Client entry (`client.js`), pure ESM libraries, docs and reference runners.
There are no runtime dependencies.

## npm

```bash
npm pack --dry-run
npm publish
```

The `files` list includes `index.js`, `client.js`, `lib/*.js`, the Cordis patch,
locale/icon assets, README/CHANGELOG/LICENSE, docs and `examples/**`.

Publishing requires an `NPM_TOKEN` repository secret; the `Publish to npm`
workflow reads it. Without a token, use a GitHub release tarball instead.

## GitHub release tarball

```bash
npm pack
gh release upload v0.14.0 dsh-blueprint-studio-0.14.0.tgz
```

Install into a DSH profile:

```bash
# desktop app profile
dsh plugin --profile desktop add \
  https://github.com/XiRuize/dsh-blueprint-studio/releases/download/v0.14.0/dsh-blueprint-studio-0.14.0.tgz

# CLI / web profile
dsh plugin --profile web add \
  https://github.com/XiRuize/dsh-blueprint-studio/releases/download/v0.14.0/dsh-blueprint-studio-0.14.0.tgz
```

After installing into the desktop app, restart the app so the Host bundle loads;
for `dsh web`, restart the server and refresh the page.

## Local development

```bash
dsh plugin --profile web add /path/to/dsh-blueprint-studio
```

The plugin uses the DSH Host session/workspace APIs only; it does not start a
second server or open a port.

## Skill bundle\n\n`skills/blueprint-studio/SKILL.md` is included in the package. Install it into a DSH skills directory or point your profile skill provider at it; it contains the scan → layered plan → check → run → review workflow.\n\n## Reference runners

The `examples/` directory is distributed with the package:

- `examples/handoff-runner/runner.mjs` — CLI executor with policy/audit
- `examples/http-runner/runner.mjs` — HTTP POST adapter
- `examples/dsh-subagent-runner/runner.mjs` — prompt bridge via `DSH_SUBAGENT_CMD`

They are advisory tools, not sandboxed executors. Review commands and handoffs
before running them.
