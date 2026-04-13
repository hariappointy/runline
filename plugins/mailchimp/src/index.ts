import type { RunlinePluginAPI } from "runline";

async function apiRequest(
  apiKey: string, method: string, endpoint: string,
  body?: Record<string, unknown>, qs?: Record<string, unknown>,
): Promise<unknown> {
  const dc = apiKey.split("-").pop();
  const url = new URL(`https://${dc}.api.mailchimp.com/3.0${endpoint}`);
  if (qs) { for (const [k, v] of Object.entries(qs)) { if (v !== undefined && v !== null) url.searchParams.set(k, String(v)); } }
  const opts: RequestInit = {
    method,
    headers: { Authorization: `Basic ${btoa(`anystring:${apiKey}`)}`, "Content-Type": "application/json" },
  };
  if (body && Object.keys(body).length > 0 && method !== "GET" && method !== "DELETE") opts.body = JSON.stringify(body);
  const res = await fetch(url.toString(), opts);
  if (!res.ok) throw new Error(`Mailchimp API error ${res.status}: ${await res.text()}`);
  if (res.status === 204) return { success: true };
  return res.json();
}

export default function mailchimp(rl: RunlinePluginAPI) {
  rl.setName("mailchimp");
  rl.setVersion("0.1.0");

  rl.setConnectionSchema({
    apiKey: { type: "string", required: true, description: "Mailchimp API key (includes datacenter suffix)", env: "MAILCHIMP_API_KEY" },
  });

  const key = (ctx: { connection: { config: Record<string, unknown> } }) => ctx.connection.config.apiKey as string;

  // ── Member ──────────────────────────────────────────

  rl.registerAction("member.create", {
    description: "Add a member to a list/audience",
    inputSchema: {
      listId: { type: "string", required: true, description: "List/audience ID" },
      email: { type: "string", required: true, description: "Email address" },
      status: { type: "string", required: true, description: "subscribed, unsubscribed, cleaned, pending, transactional" },
      mergeFields: { type: "object", required: false, description: "Merge fields (FNAME, LNAME, etc.)" },
      tags: { type: "array", required: false, description: "Tags to add" },
    },
    async execute(input, ctx) {
      const { listId, email, status, mergeFields, tags } = input as Record<string, unknown>;
      const body: Record<string, unknown> = { email_address: email, status };
      if (mergeFields) body.merge_fields = mergeFields;
      if (tags) body.tags = tags;
      return apiRequest(key(ctx), "POST", `/lists/${listId}/members`, body);
    },
  });

  rl.registerAction("member.get", {
    description: "Get a list member",
    inputSchema: { listId: { type: "string", required: true }, subscriberHash: { type: "string", required: true, description: "MD5 hash of lowercase email or email" } },
    async execute(input, ctx) { const { listId, subscriberHash } = input as Record<string, unknown>; return apiRequest(key(ctx), "GET", `/lists/${listId}/members/${subscriberHash}`); },
  });

  rl.registerAction("member.list", {
    description: "List members in a list/audience",
    inputSchema: { listId: { type: "string", required: true }, count: { type: "number", required: false, description: "Max results" }, status: { type: "string", required: false }, offset: { type: "number", required: false } },
    async execute(input, ctx) {
      const { listId, count, status, offset } = (input ?? {}) as Record<string, unknown>;
      const qs: Record<string, unknown> = {};
      if (count) qs.count = count;
      if (status) qs.status = status;
      if (offset) qs.offset = offset;
      const data = (await apiRequest(key(ctx), "GET", `/lists/${listId}/members`, undefined, qs)) as Record<string, unknown>;
      return data.members;
    },
  });

  rl.registerAction("member.update", {
    description: "Update a list member",
    inputSchema: {
      listId: { type: "string", required: true },
      subscriberHash: { type: "string", required: true },
      status: { type: "string", required: false },
      mergeFields: { type: "object", required: false },
    },
    async execute(input, ctx) {
      const { listId, subscriberHash, status, mergeFields } = input as Record<string, unknown>;
      const body: Record<string, unknown> = {};
      if (status) body.status = status;
      if (mergeFields) body.merge_fields = mergeFields;
      return apiRequest(key(ctx), "PATCH", `/lists/${listId}/members/${subscriberHash}`, body);
    },
  });

  rl.registerAction("member.delete", {
    description: "Delete a list member",
    inputSchema: { listId: { type: "string", required: true }, subscriberHash: { type: "string", required: true } },
    async execute(input, ctx) { const { listId, subscriberHash } = input as Record<string, unknown>; await apiRequest(key(ctx), "DELETE", `/lists/${listId}/members/${subscriberHash}`); return { success: true }; },
  });

  // ── Member Tag ──────────────────────────────────────

  rl.registerAction("memberTag.add", {
    description: "Add tags to a member",
    inputSchema: { listId: { type: "string", required: true }, subscriberHash: { type: "string", required: true }, tags: { type: "array", required: true, description: "Array of tag names" } },
    async execute(input, ctx) {
      const { listId, subscriberHash, tags } = input as Record<string, unknown>;
      return apiRequest(key(ctx), "POST", `/lists/${listId}/members/${subscriberHash}/tags`, { tags: (tags as string[]).map((t) => ({ name: t, status: "active" })) });
    },
  });

  rl.registerAction("memberTag.remove", {
    description: "Remove tags from a member",
    inputSchema: { listId: { type: "string", required: true }, subscriberHash: { type: "string", required: true }, tags: { type: "array", required: true, description: "Array of tag names" } },
    async execute(input, ctx) {
      const { listId, subscriberHash, tags } = input as Record<string, unknown>;
      return apiRequest(key(ctx), "POST", `/lists/${listId}/members/${subscriberHash}/tags`, { tags: (tags as string[]).map((t) => ({ name: t, status: "inactive" })) });
    },
  });

  // ── List Group ──────────────────────────────────────

  rl.registerAction("listGroup.list", {
    description: "List interest categories (groups) for a list",
    inputSchema: { listId: { type: "string", required: true } },
    async execute(input, ctx) {
      const data = (await apiRequest(key(ctx), "GET", `/lists/${(input as { listId: string }).listId}/interest-categories`)) as Record<string, unknown>;
      return data.categories;
    },
  });

  // ── Campaign ────────────────────────────────────────

  rl.registerAction("campaign.get", {
    description: "Get a campaign", inputSchema: { campaignId: { type: "string", required: true } },
    async execute(input, ctx) { return apiRequest(key(ctx), "GET", `/campaigns/${(input as { campaignId: string }).campaignId}`); },
  });

  rl.registerAction("campaign.list", {
    description: "List campaigns", inputSchema: { count: { type: "number", required: false }, status: { type: "string", required: false, description: "save, paused, schedule, sending, sent" } },
    async execute(input, ctx) {
      const { count, status } = (input ?? {}) as Record<string, unknown>;
      const qs: Record<string, unknown> = {};
      if (count) qs.count = count;
      if (status) qs.status = status;
      const data = (await apiRequest(key(ctx), "GET", "/campaigns", undefined, qs)) as Record<string, unknown>;
      return data.campaigns;
    },
  });

  rl.registerAction("campaign.send", {
    description: "Send a campaign", inputSchema: { campaignId: { type: "string", required: true } },
    async execute(input, ctx) { return apiRequest(key(ctx), "POST", `/campaigns/${(input as { campaignId: string }).campaignId}/actions/send`); },
  });

  rl.registerAction("campaign.replicate", {
    description: "Replicate a campaign", inputSchema: { campaignId: { type: "string", required: true } },
    async execute(input, ctx) { return apiRequest(key(ctx), "POST", `/campaigns/${(input as { campaignId: string }).campaignId}/actions/replicate`); },
  });

  rl.registerAction("campaign.resend", {
    description: "Resend a campaign to non-openers", inputSchema: { campaignId: { type: "string", required: true } },
    async execute(input, ctx) { return apiRequest(key(ctx), "POST", `/campaigns/${(input as { campaignId: string }).campaignId}/actions/create-resend`); },
  });

  rl.registerAction("campaign.delete", {
    description: "Delete a campaign", inputSchema: { campaignId: { type: "string", required: true } },
    async execute(input, ctx) { await apiRequest(key(ctx), "DELETE", `/campaigns/${(input as { campaignId: string }).campaignId}`); return { success: true }; },
  });
}
