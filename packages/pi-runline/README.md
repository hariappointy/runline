# pi-runline

Code mode for [pi](https://github.com/mariozechner/pi).

An extension that plugs [runline](https://www.npmjs.com/package/runline) into coding agents. The agent gets two native tools, a fuzzy picker for choosing which of the 188 built-in plugins to expose, and a guided credential prompt for the ones it hasn't seen before.

## Install

```bash
pi install pi-runline
```

## Tools

On session start, if the current working directory has a `.runline/` (or one is configured globally — see below), the extension registers two tools and injects the selected plugin catalog into the agent's context:

- **`list_runline_actions`** — enumerate available actions with input schemas. Optional `plugin` filter.
- **`execute_runline`** — run JavaScript in runline's QuickJS sandbox. Every enabled plugin is a top-level global; `return` surfaces the result; logs are captured.

## `/runline-plugins` — the picker

Typing `/runline-plugins` in a pi session opens a fuzzy multi-select over all 188 built-in plugins.

```
╭─────────────────────────────────────────────╮
│ runline plugins · 5/188 enabled             │
│ type to filter · space toggle · ^A toggle   │
│                                             │
│ filter ❯ gith                               │
│                                             │
│ ❯ ◉ github       34 actions                 │
│   ◯ gitlab       17 actions                 │
│   ...                                       │
╰─────────────────────────────────────────────╯
```

Keys: `type` to filter · `↑/↓` to move · `space` to toggle · `Ctrl-A` to toggle all visible · `enter` to save · `esc` to cancel.

After saving, any newly-enabled plugin with a `connectionConfigSchema` that doesn't already have a connection (and can't be fully resolved from env vars) will prompt you field-by-field for credentials. Values are written to `.runline/config.json` under `connections[]`.

## Configuration

### Per-project — `.runline/config.json`

```json
{
  "showStatus": true,
  "piPlugins": ["github", "slack", "linear"],
  "connections": [
    { "name": "github", "plugin": "github", "config": { "token": "ghp_..." } }
  ]
}
```

- **`piPlugins`** — the allowlist the extension uses. If missing or empty, nothing is exposed to the agent and the status bar says `runline: /runline-plugins to enable`.
- **`showStatus`** — set to `false` to silence the status bar entry for this project.
- **`connections`** — standard runline connections (shared with the CLI and SDK).

### Global — `~/.pi/agent/runline.json`

```json
{ "project": "~/Projects/my-runline-project" }
```

Fallback used when the current cwd has no `.runline/` anywhere up the tree. Useful when you want the runline tools available in every pi session without scattering `.runline/` folders.

## How plugin allow-listing works

The extension deliberately exposes nothing by default. That's on purpose — 2,410 actions is a lot of context budget. You pick the plugins that matter for a given project, commit the allowlist to `.runline/config.json`, and the agent only ever sees (and can only discover via `list_runline_actions`) the ones you enabled.

Note that the QuickJS sandbox itself still registers every runline plugin as a global, so in principle an agent could guess and call a disabled plugin. In practice the catalog injection and `list_runline_actions` output are the only surface the agent knows about, and unconfigured plugins error out at first action call anyway. Plumbing the allowlist into the sandbox globals is on the roadmap.
