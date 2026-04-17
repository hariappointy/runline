import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Markdown, Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { Runline } from "runline";
import { findRunlineDir, loadExtConfig } from "../runline-resolve.js";

type ActionEntry = {
  plugin: string;
  action: string;
  description?: string;
  inputSchema?: Record<
    string,
    { type: string; required?: boolean; description?: string }
  >;
};

function formatActions(actions: ActionEntry[]): string {
  const grouped = new Map<string, ActionEntry[]>();
  for (const a of actions) {
    const list = grouped.get(a.plugin) ?? [];
    list.push(a);
    grouped.set(a.plugin, list);
  }

  const lines: string[] = [];
  for (const [plugin, entries] of grouped) {
    lines.push(`### ${plugin}`);
    for (const a of entries) {
      const inputs = a.inputSchema
        ? Object.entries(a.inputSchema)
            .map(([k, v]) => `${k}: ${v.type}${v.required ? "" : "?"}`)
            .join(", ")
        : "";
      const sig = inputs
        ? `\`${plugin}.${a.action}({ ${inputs} })\``
        : `\`${plugin}.${a.action}()\``;
      const desc = a.description ? ` — ${a.description}` : "";
      lines.push(`- ${sig}${desc}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

const runlineCache = new Map<string, Promise<Runline>>();

async function getRunline(cwd: string): Promise<Runline> {
  let pending = runlineCache.get(cwd);
  if (!pending) {
    pending = Runline.fromProject(cwd).then((rl) => {
      if (!rl) throw new Error("No .runline/ found — run `runline init` first");
      return rl;
    });
    // Drop failed loads so the next call retries instead of caching the error.
    pending.catch(() => runlineCache.delete(cwd));
    runlineCache.set(cwd, pending);
  }
  return pending;
}

export default function (pi: ExtensionAPI) {
  pi.registerMessageRenderer(
    "runline-context",
    (message, { expanded }, theme) => {
      if (!expanded) {
        const label = theme.fg("customMessageLabel", "⚡ runline actions");
        const hint = theme.fg("dim", " — Ctrl+O to expand");
        return new Text(label + hint, 1, 0);
      }
      const content =
        typeof message.content === "string"
          ? message.content
          : message.content
              .filter((c): c is { type: "text"; text: string } => c.type === "text")
              .map((c) => c.text)
              .join("\n");
      return new Markdown(
        content,
        1,
        0,
        {
          heading: (t) => theme.fg("mdHeading", t),
          link: (t) => theme.fg("mdLink", t),
          linkUrl: (t) => theme.fg("mdLinkUrl", t),
          code: (t) => theme.fg("mdCode", t),
          codeBlock: (t) => theme.fg("mdCodeBlock", t),
          codeBlockBorder: (t) => theme.fg("mdCodeBlockBorder", t),
          quote: (t) => theme.fg("mdQuote", t),
          quoteBorder: (t) => theme.fg("mdQuoteBorder", t),
          hr: (t) => theme.fg("mdHr", t),
          listBullet: (t) => theme.fg("mdListBullet", t),
          bold: (t) => theme.bold(t),
          italic: (t) => theme.italic(t),
          strikethrough: (t) => theme.strikethrough(t),
          underline: (t) => theme.underline(t),
        },
        { color: (t) => theme.fg("customMessageText", t) },
      );
    },
  );

  pi.on("session_start", async (_event, ctx) => {
    const runlineDir = findRunlineDir(ctx.cwd);
    if (!runlineDir) return;

    const { showStatus } = loadExtConfig(runlineDir);

    let rl: Runline;
    try {
      rl = await getRunline(ctx.cwd);
    } catch {
      if (ctx.hasUI && showStatus) {
        ctx.ui.setStatus(
          "runline",
          ctx.ui.theme.fg("dim", "runline: load failed"),
        );
      }
      return;
    }

    const actions = rl.actions();
    const plugins = rl.plugins();

    if (actions.length === 0) {
      if (ctx.hasUI && showStatus) {
        ctx.ui.setStatus(
          "runline",
          ctx.ui.theme.fg("dim", "runline: no plugins"),
        );
      }
      return;
    }

    const alreadyInjected = ctx.sessionManager
      .getEntries()
      .some(
        (e) =>
          e.type === "custom_message" && e.customType === "runline-context",
      );

    if (!alreadyInjected) {
      const header =
        "## Runline actions\n\n" +
        "This project has runline installed. You have two tools:\n" +
        "- `list_runline_actions` — show the full action catalog with input schemas\n" +
        "- `execute_runline` — run JavaScript in a sandbox where each plugin is a top-level global. " +
        "Chain actions, await results, return a value.\n\n" +
        `**${plugins.length} plugins, ${actions.length} actions available.**\n\n` +
        "Example:\n" +
        "```js\n" +
        'return await github.issue.create({ owner: "acme", repo: "api", title: "Bug" })\n' +
        "```\n\n";

      pi.sendMessage({
        customType: "runline-context",
        content: header + formatActions(actions),
        display: true,
      });
    }

    if (ctx.hasUI && showStatus) {
      const theme = ctx.ui.theme;
      ctx.ui.setStatus(
        "runline",
        `⚡${theme.fg("dim", ` runline: ${plugins.length} plugins, ${actions.length} actions`)}`,
      );
    }
  });

  // ── Tools ───────────────────────────────────────────────────────

  pi.registerTool({
    name: "execute_runline",
    label: "Runline Exec",
    description:
      "Execute JavaScript in the runline sandbox. Each installed plugin is a top-level global " +
      "(e.g. `github`, `slack`). Use `return` to surface the result. Async/await supported.",
    promptSnippet:
      "Run JS against runline plugins — chain actions, transform data, return a value",
    parameters: Type.Object({
      code: Type.String({
        description:
          "JavaScript code to execute. Plugins are globals. Use `return` for the final value.",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const rl = await getRunline(ctx.cwd);
      const result = await rl.execute(params.code);

      const logs = result.logs?.length
        ? `\n\nLogs:\n${result.logs.join("\n")}`
        : "";

      if (result.error) {
        return {
          content: [{ type: "text", text: `Error: ${result.error}${logs}` }],
          isError: true,
          details: result,
        };
      }

      const value =
        typeof result.result === "string"
          ? result.result
          : JSON.stringify(result.result, null, 2);

      return {
        content: [{ type: "text", text: value + logs }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "list_runline_actions",
    label: "Runline Actions",
    description:
      "List every available runline action with its plugin, description, and input schema.",
    promptSnippet:
      "Discover runline plugin actions and their input shapes before calling execute_runline",
    parameters: Type.Object({
      plugin: Type.Optional(
        Type.String({
          description: "Filter to a single plugin (e.g. 'github')",
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const rl = await getRunline(ctx.cwd);
      let actions = rl.actions();
      if (params.plugin) {
        actions = actions.filter((a) => a.plugin === params.plugin);
      }
      const text = formatActions(actions);
      return {
        content: [{ type: "text", text: text || "No actions found." }],
        details: { actions },
      };
    },
  });
}
