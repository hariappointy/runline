# runline

The runline library and CLI. See the [monorepo README](../../README.md) for the full story, quickstart, and plugin catalog.

## What lives here

- `src/` — the library source (SDK, engine, plugin API, loader, CLI commands)
- `scripts/` — tooling (e.g. `generate-plugin-table.js` for the root README)
- `dist/plugins/` — populated at build time by copying `packages/runline-plugins/dist`

## Scripts

```bash
bun run dev -- exec 'return 1 + 2'   # run the CLI from source
bun run build                         # compile + bundle built-in plugins
bun run test                          # bun test src/tests
bun run check                         # biome check
```

`build` does two things: compiles `src/` with `tsc`, then invokes `bun --filter runline-plugins build` and copies the output into `dist/plugins/` so the published package ships with every built-in plugin.
