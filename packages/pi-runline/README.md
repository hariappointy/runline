# pi-runline

A [pi](https://github.com/mariozechner/pi) extension that gives coding agents first-class access to runline.

## What it does

On session start, if the current project has a `.runline/` directory (or one is configured globally via `~/.pi/agent/runline.json`), the extension:

1. **Injects a context message** listing every installed plugin, its actions, and their input schemas.
2. **Sets a status bar line** — `⚡ runline: N plugins, M actions`.
3. **Registers two tools** the agent can call:
   - `list_runline_actions` — enumerate the action catalog (optionally filtered to one plugin).
   - `execute_runline` — run JavaScript against the runline sandbox. Plugins are globals; `return` surfaces the result.

## Configuration

### Per-project — `.runline/config.json`

```json
{ "showStatus": false }
```

Silences the status bar for this project.

### Global — `~/.pi/agent/runline.json`

```json
{ "project": "~/Projects/my-runline-project" }
```

Fall-back used when the current working directory has no `.runline/` in its ancestry. Useful when you want the runline tools available in every pi session without putting `.runline/` everywhere.

## Install

Published as `pi-runline` on npm. The package declares itself via `pi.extensions` and `pi.skills` in `package.json`, so pi picks it up automatically once installed.
