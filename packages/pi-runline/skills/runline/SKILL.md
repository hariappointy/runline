---
name: runline
description: Call third-party APIs through runline's plugin sandbox. Use when the user asks to interact with integrations (GitHub, Slack, Stripe, Notion, Airtable, etc.) and the project has a `.runline/` directory. Triggers include "create an issue", "send a slack message", "query airtable", "list stripe customers".
---

# runline

Runline is a sandboxed JS runtime with API integrations as plugins. Each installed plugin is a global (e.g. `github`, `slack`). You call actions on them, await results, and return a value.

## When to use

The pi session will inject a `runline-context` block at session start if the project has `.runline/`. That block tells you which plugins are installed and their actions. Use runline whenever the user asks for something an installed plugin covers — don't shell out to `curl` or write ad-hoc HTTP code.

## Tools

- **`list_runline_actions`** — show all plugin actions and their input schemas. Call this before `execute_runline` when you're not sure about an action's shape. Optional `plugin` arg filters.
- **`execute_runline`** — run JavaScript in the sandbox. Plugins are globals. Use `return` for the final value; async/await works.

## Patterns

Discover before calling:
```
list_runline_actions({ plugin: "github" })
```

Single action:
```js
return await github.issue.create({ owner: "acme", repo: "api", title: "Bug" })
```

Chain actions:
```js
const issues = await github.issue.list({ owner: "acme", repo: "api", state: "open" })
return issues.filter(i => i.labels.some(l => l.name === "bug"))
```

Transform and return:
```js
const customers = await stripe.customer.list({ limit: 100 })
return customers.map(c => ({ id: c.id, email: c.email }))
```

## Don'ts

- Don't `console.log` the result — `return` it. Logs are captured but the return value is the answer.
- Don't install new plugins ad-hoc — if a plugin isn't listed in `runline-context`, tell the user they need to `runline plugin install <name>` first.
- Don't reach for `execute_runline` for things that aren't runline actions. It's a sandbox, not a general JS runtime.
