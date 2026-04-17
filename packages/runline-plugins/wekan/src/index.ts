import type { RunlinePluginAPI } from "runline";

function getConn(ctx: { connection: { config: Record<string, unknown> } }) {
  const c = ctx.connection.config;
  return { url: (c.url as string).replace(/\/$/, ""), token: c.token as string };
}

async function api(conn: ReturnType<typeof getConn>, method: string, endpoint: string, body?: Record<string, unknown>): Promise<unknown> {
  const init: RequestInit = { method, headers: { Authorization: `Bearer ${conn.token}`, "Content-Type": "application/json", Accept: "application/json" } };
  if (body && Object.keys(body).length > 0) init.body = JSON.stringify(body);
  const res = await fetch(`${conn.url}/api/${endpoint}`, init);
  if (!res.ok) throw new Error(`Wekan error ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export default function wekan(rl: RunlinePluginAPI) {
  rl.setName("wekan");
  rl.setVersion("0.1.0");
  rl.setConnectionSchema({
    url: { type: "string", required: true, description: "Wekan server URL", env: "WEKAN_URL" },
    token: { type: "string", required: true, description: "Wekan API token", env: "WEKAN_TOKEN" },
  });

  // ── Board ───────────────────────────────────────────

  rl.registerAction("board.create", { description: "Create a board", inputSchema: { title: { type: "string", required: true }, owner: { type: "string", required: true } },
    async execute(input, ctx) { return api(getConn(ctx), "POST", "boards", input as Record<string, unknown>); } });

  rl.registerAction("board.get", { description: "Get a board", inputSchema: { boardId: { type: "string", required: true } },
    async execute(input, ctx) { return api(getConn(ctx), "GET", `boards/${(input as Record<string, unknown>).boardId}`); } });

  rl.registerAction("board.list", { description: "List boards for a user", inputSchema: { userId: { type: "string", required: true }, limit: { type: "number", required: false } },
    async execute(input, ctx) {
      const p = input as Record<string, unknown>;
      const data = (await api(getConn(ctx), "GET", `users/${p.userId}/boards`)) as unknown[];
      return p.limit ? data.slice(0, p.limit as number) : data;
    } });

  rl.registerAction("board.delete", { description: "Delete a board", inputSchema: { boardId: { type: "string", required: true } },
    async execute(input, ctx) { return api(getConn(ctx), "DELETE", `boards/${(input as Record<string, unknown>).boardId}`); } });

  // ── List ────────────────────────────────────────────

  rl.registerAction("list.create", { description: "Create a list on a board", inputSchema: { boardId: { type: "string", required: true }, title: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "POST", `boards/${p.boardId}/lists`, { title: p.title }); } });

  rl.registerAction("list.get", { description: "Get a list", inputSchema: { boardId: { type: "string", required: true }, listId: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "GET", `boards/${p.boardId}/lists/${p.listId}`); } });

  rl.registerAction("list.listAll", { description: "List all lists on a board", inputSchema: { boardId: { type: "string", required: true }, limit: { type: "number", required: false } },
    async execute(input, ctx) {
      const p = input as Record<string, unknown>;
      const data = (await api(getConn(ctx), "GET", `boards/${p.boardId}/lists`)) as unknown[];
      return p.limit ? data.slice(0, p.limit as number) : data;
    } });

  rl.registerAction("list.delete", { description: "Delete a list", inputSchema: { boardId: { type: "string", required: true }, listId: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "DELETE", `boards/${p.boardId}/lists/${p.listId}`); } });

  // ── Card ────────────────────────────────────────────

  rl.registerAction("card.create", { description: "Create a card", inputSchema: { boardId: { type: "string", required: true }, listId: { type: "string", required: true }, title: { type: "string", required: true }, swimlaneId: { type: "string", required: true }, authorId: { type: "string", required: true }, description: { type: "string", required: false } },
    async execute(input, ctx) {
      const { boardId, listId, ...body } = input as Record<string, unknown>;
      return api(getConn(ctx), "POST", `boards/${boardId}/lists/${listId}/cards`, body);
    } });

  rl.registerAction("card.get", { description: "Get a card", inputSchema: { boardId: { type: "string", required: true }, listId: { type: "string", required: true }, cardId: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "GET", `boards/${p.boardId}/lists/${p.listId}/cards/${p.cardId}`); } });

  rl.registerAction("card.list", { description: "List cards in a list", inputSchema: { boardId: { type: "string", required: true }, listId: { type: "string", required: true }, limit: { type: "number", required: false } },
    async execute(input, ctx) {
      const p = input as Record<string, unknown>;
      const data = (await api(getConn(ctx), "GET", `boards/${p.boardId}/lists/${p.listId}/cards`)) as unknown[];
      return p.limit ? data.slice(0, p.limit as number) : data;
    } });

  rl.registerAction("card.update", { description: "Update a card", inputSchema: { boardId: { type: "string", required: true }, listId: { type: "string", required: true }, cardId: { type: "string", required: true }, data: { type: "object", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "PUT", `boards/${p.boardId}/lists/${p.listId}/cards/${p.cardId}`, p.data as Record<string, unknown>); } });

  rl.registerAction("card.delete", { description: "Delete a card", inputSchema: { boardId: { type: "string", required: true }, listId: { type: "string", required: true }, cardId: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "DELETE", `boards/${p.boardId}/lists/${p.listId}/cards/${p.cardId}`); } });

  // ── Card Comment ────────────────────────────────────

  rl.registerAction("cardComment.create", { description: "Add a comment to a card", inputSchema: { boardId: { type: "string", required: true }, cardId: { type: "string", required: true }, authorId: { type: "string", required: true }, comment: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "POST", `boards/${p.boardId}/cards/${p.cardId}/comments`, { authorId: p.authorId, comment: p.comment }); } });

  rl.registerAction("cardComment.get", { description: "Get a comment", inputSchema: { boardId: { type: "string", required: true }, cardId: { type: "string", required: true }, commentId: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "GET", `boards/${p.boardId}/cards/${p.cardId}/comments/${p.commentId}`); } });

  rl.registerAction("cardComment.list", { description: "List comments on a card", inputSchema: { boardId: { type: "string", required: true }, cardId: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "GET", `boards/${p.boardId}/cards/${p.cardId}/comments`); } });

  rl.registerAction("cardComment.delete", { description: "Delete a comment", inputSchema: { boardId: { type: "string", required: true }, cardId: { type: "string", required: true }, commentId: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "DELETE", `boards/${p.boardId}/cards/${p.cardId}/comments/${p.commentId}`); } });

  // ── Checklist ───────────────────────────────────────

  rl.registerAction("checklist.create", { description: "Create a checklist on a card", inputSchema: { boardId: { type: "string", required: true }, cardId: { type: "string", required: true }, title: { type: "string", required: true }, items: { type: "object", required: false, description: "Array of item titles" } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "POST", `boards/${p.boardId}/cards/${p.cardId}/checklists`, { title: p.title, items: p.items }); } });

  rl.registerAction("checklist.get", { description: "Get a checklist", inputSchema: { boardId: { type: "string", required: true }, cardId: { type: "string", required: true }, checklistId: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "GET", `boards/${p.boardId}/cards/${p.cardId}/checklists/${p.checklistId}`); } });

  rl.registerAction("checklist.list", { description: "List checklists on a card", inputSchema: { boardId: { type: "string", required: true }, cardId: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "GET", `boards/${p.boardId}/cards/${p.cardId}/checklists`); } });

  rl.registerAction("checklist.delete", { description: "Delete a checklist", inputSchema: { boardId: { type: "string", required: true }, cardId: { type: "string", required: true }, checklistId: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "DELETE", `boards/${p.boardId}/cards/${p.cardId}/checklists/${p.checklistId}`); } });

  // ── Checklist Item ──────────────────────────────────

  rl.registerAction("checklistItem.get", { description: "Get a checklist item", inputSchema: { boardId: { type: "string", required: true }, cardId: { type: "string", required: true }, checklistId: { type: "string", required: true }, itemId: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "GET", `boards/${p.boardId}/cards/${p.cardId}/checklists/${p.checklistId}/items/${p.itemId}`); } });

  rl.registerAction("checklistItem.update", { description: "Update a checklist item", inputSchema: { boardId: { type: "string", required: true }, cardId: { type: "string", required: true }, checklistId: { type: "string", required: true }, itemId: { type: "string", required: true }, data: { type: "object", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "PUT", `boards/${p.boardId}/cards/${p.cardId}/checklists/${p.checklistId}/items/${p.itemId}`, p.data as Record<string, unknown>); } });

  rl.registerAction("checklistItem.delete", { description: "Delete a checklist item", inputSchema: { boardId: { type: "string", required: true }, cardId: { type: "string", required: true }, checklistId: { type: "string", required: true }, itemId: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "DELETE", `boards/${p.boardId}/cards/${p.cardId}/checklists/${p.checklistId}/items/${p.itemId}`); } });
}
