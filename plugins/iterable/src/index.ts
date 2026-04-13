import type { RunlinePluginAPI } from "runline";

async function apiRequest(
  baseUrl: string, apiKey: string, method: string, endpoint: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const opts: RequestInit = {
    method,
    headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
  };
  if (body && Object.keys(body).length > 0 && method !== "GET" && method !== "DELETE") opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}/api${endpoint}`, opts);
  if (!res.ok) throw new Error(`Iterable API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export default function iterable(rl: RunlinePluginAPI) {
  rl.setName("iterable");
  rl.setVersion("0.1.0");

  rl.setConnectionSchema({
    apiKey: { type: "string", required: true, description: "Iterable API key", env: "ITERABLE_API_KEY" },
    region: { type: "string", required: false, description: "API base URL (default: https://api.iterable.com)", env: "ITERABLE_REGION", default: "https://api.iterable.com" },
  });

  const conn = (ctx: { connection: { config: Record<string, unknown> } }) => ({
    baseUrl: ((ctx.connection.config.region as string) ?? "https://api.iterable.com").replace(/\/$/, ""),
    apiKey: ctx.connection.config.apiKey as string,
  });

  rl.registerAction("event.track", {
    description: "Track an event for a user",
    inputSchema: {
      email: { type: "string", required: true, description: "User email" },
      eventName: { type: "string", required: true, description: "Event name" },
      dataFields: { type: "object", required: false, description: "Event data" },
      createdAt: { type: "number", required: false, description: "Unix timestamp" },
    },
    async execute(input, ctx) {
      const { email, eventName, dataFields, createdAt } = input as Record<string, unknown>;
      const { baseUrl, apiKey } = conn(ctx);
      const body: Record<string, unknown> = { email, eventName };
      if (dataFields) body.dataFields = dataFields;
      if (createdAt) body.createdAt = createdAt;
      return apiRequest(baseUrl, apiKey, "POST", "/events/track", body);
    },
  });

  rl.registerAction("user.upsert", {
    description: "Create or update a user",
    inputSchema: {
      email: { type: "string", required: true, description: "User email" },
      dataFields: { type: "object", required: false, description: "User data fields" },
      userId: { type: "string", required: false, description: "User ID" },
      mergeNestedObjects: { type: "boolean", required: false, description: "Merge nested objects" },
    },
    async execute(input, ctx) {
      const { email, dataFields, userId, mergeNestedObjects } = input as Record<string, unknown>;
      const { baseUrl, apiKey } = conn(ctx);
      const body: Record<string, unknown> = { email };
      if (dataFields) body.dataFields = dataFields;
      if (userId) body.userId = userId;
      if (mergeNestedObjects !== undefined) body.mergeNestedObjects = mergeNestedObjects;
      return apiRequest(baseUrl, apiKey, "POST", "/users/update", body);
    },
  });

  rl.registerAction("user.get", {
    description: "Get a user by email",
    inputSchema: { email: { type: "string", required: true, description: "User email" } },
    async execute(input, ctx) {
      const { baseUrl, apiKey } = conn(ctx);
      return apiRequest(baseUrl, apiKey, "GET", `/users/${encodeURIComponent((input as { email: string }).email)}`);
    },
  });

  rl.registerAction("user.delete", {
    description: "Delete a user by email",
    inputSchema: { email: { type: "string", required: true, description: "User email" } },
    async execute(input, ctx) {
      const { baseUrl, apiKey } = conn(ctx);
      return apiRequest(baseUrl, apiKey, "DELETE", `/users/${encodeURIComponent((input as { email: string }).email)}`);
    },
  });

  rl.registerAction("userList.add", {
    description: "Add subscribers to a list",
    inputSchema: {
      listId: { type: "number", required: true, description: "List ID" },
      subscribers: { type: "array", required: true, description: "Array of {email} objects" },
    },
    async execute(input, ctx) {
      const { listId, subscribers } = input as Record<string, unknown>;
      const { baseUrl, apiKey } = conn(ctx);
      return apiRequest(baseUrl, apiKey, "POST", "/lists/subscribe", { listId, subscribers });
    },
  });

  rl.registerAction("userList.remove", {
    description: "Remove subscribers from a list",
    inputSchema: {
      listId: { type: "number", required: true, description: "List ID" },
      subscribers: { type: "array", required: true, description: "Array of {email} objects" },
    },
    async execute(input, ctx) {
      const { listId, subscribers } = input as Record<string, unknown>;
      const { baseUrl, apiKey } = conn(ctx);
      return apiRequest(baseUrl, apiKey, "POST", "/lists/unsubscribe", { listId, subscribers });
    },
  });
}
