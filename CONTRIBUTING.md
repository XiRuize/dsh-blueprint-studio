# Contributing

Thanks for improving Blueprint Studio.

## Development setup

The plugin has no build step and no runtime dependencies.

```bash
git clone <your-fork>
cd dsh-blueprint-studio
node --check index.js
node --check client.js
node --test test/
```

To try it in Harness:

```text
plugin_manager(action="install_bundle", target="<absolute path to the checkout>")
```

The installed profile links the checkout, so editing `index.js`/`lib/*.js` is live after the Host plugin reloads. Editing `client.js` needs a page reload (or `pnpm run dev:web` in a DSH source checkout with client HMR).

## Design constraints

- **Zero runtime dependencies.** The client is a plain module-loader factory and uses React from the host module table. Do not add a bundler or a second editor.
- **No private RPC.** Read through `workspaceFiles`, write through the `/blueprint` command, list child sessions through `session.list`. If a capability is missing, propose it upstream instead of reaching into another package.
- **Semantic model, deterministic geometry.** The model produces nodes, edges and fields; the client produces positions.
- **The JSON file is the source of truth.** History is an append-only archive beside it; do not keep critical state only in plugin memory.
- **Theme tokens only.** Use `--dsw-alias-*` for surfaces, text and borders. Literal colors are for diagram artwork and exports.
- **Bilingual UI.** Add every user-visible string to both the inline client dictionary and `locale/en.json` / `locale/zh.json` metadata.

## Pull requests

1. Keep changes focused; one feature or fix per PR.
2. Add or update a unit test for normalizer, diff or history behavior.
3. Run `npm run check` and `npm test`.
4. Include a screenshot for visible changes (theme, layout, new diagram kind).
5. Update `CHANGELOG.md` under “Unreleased”.

## Reporting bugs

Include the DSH version, the blueprint JSON (redact business data), the console error if any, and whether the Host or Client half is affected.
