# runline-plugins

Built-in plugins for runline. This is a private workspace package — it is not published independently. At build time, `bun --filter runline build` compiles these plugins and copies the output into `packages/runline/dist/plugins/`, so every install of `runline` ships with the full catalog.

## Why a separate package?

Organizational. The plugins are their own compilation unit (one `tsc --noCheck` pass over ~180 plugin entry points) rather than being included in the runline library's `tsc`. Keeps the library build fast and the tree tidy.

## Adding a plugin

1. Create `packages/runline-plugins/<name>/src/index.ts`
2. Export a default function that receives a `RunlinePluginAPI` (see the [monorepo README](../../README.md#writing-a-plugin))
3. `bun --filter runline build` — the plugin is picked up automatically

The plugin loader discovers entries by walking `dist/plugins/*/src/index.js`.
