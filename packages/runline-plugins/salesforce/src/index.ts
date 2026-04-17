import type { RunlinePluginAPI } from "runline";

const API_VERSION = "v59.0";

function getConn(ctx: { connection: { config: Record<string, unknown> } }) {
  const c = ctx.connection.config;
  return { instanceUrl: (c.instanceUrl as string).replace(/\/$/, ""), accessToken: c.accessToken as string };
}

async function api(conn: ReturnType<typeof getConn>, method: string, endpoint: string, body?: Record<string, unknown>, qs?: Record<string, unknown>): Promise<unknown> {
  const url = new URL(`${conn.instanceUrl}/services/data/${API_VERSION}${endpoint}`);
  if (qs) { for (const [k, v] of Object.entries(qs)) { if (v !== undefined && v !== null) url.searchParams.set(k, String(v)); } }
  const init: RequestInit = { method, headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" } };
  if (body && Object.keys(body).length > 0) init.body = JSON.stringify(body);
  const res = await fetch(url.toString(), init);
  if (res.status === 204) return { success: true };
  if (!res.ok) throw new Error(`Salesforce error ${res.status}: ${await res.text()}`);
  return res.json();
}

const SOBJECTS = ["Account", "Contact", "Lead", "Opportunity", "Case", "Task", "User"];

const DEFAULT_FIELDS: Record<string, string> = {
  Account: "Id,Name,Type",
  Contact: "Id,FirstName,LastName,Email",
  Lead: "Id,Company,FirstName,LastName,Email,Status",
  Opportunity: "Id,AccountId,Amount,Probability,StageName",
  Case: "Id,AccountId,ContactId,Priority,Status,Subject",
  Task: "Id,Subject,Status,Priority",
  User: "Id,Name,Email",
};

function registerSObject(rl: RunlinePluginAPI, sObject: string, conn: typeof getConn) {
  const lower = sObject.toLowerCase();

  rl.registerAction(`${lower}.create`, { description: `Create a ${sObject}`, inputSchema: { data: { type: "object", required: true, description: `${sObject} field values` } },
    async execute(input, ctx) { return api(conn(ctx), "POST", `/sobjects/${sObject}`, (input as Record<string, unknown>).data as Record<string, unknown>); } });

  rl.registerAction(`${lower}.get`, { description: `Get a ${sObject} by ID`, inputSchema: { id: { type: "string", required: true } },
    async execute(input, ctx) { return api(conn(ctx), "GET", `/sobjects/${sObject}/${(input as Record<string, unknown>).id}`); } });

  rl.registerAction(`${lower}.update`, { description: `Update a ${sObject}`, inputSchema: { id: { type: "string", required: true }, data: { type: "object", required: true } },
    async execute(input, ctx) {
      const p = input as Record<string, unknown>;
      await api(conn(ctx), "PATCH", `/sobjects/${sObject}/${p.id}`, p.data as Record<string, unknown>);
      return { success: true, id: p.id };
    } });

  rl.registerAction(`${lower}.delete`, { description: `Delete a ${sObject}`, inputSchema: { id: { type: "string", required: true } },
    async execute(input, ctx) { await api(conn(ctx), "DELETE", `/sobjects/${sObject}/${(input as Record<string, unknown>).id}`); return { success: true }; } });

  rl.registerAction(`${lower}.query`, { description: `Query ${sObject}s with SOQL`, inputSchema: { fields: { type: "string", required: false, description: `Comma-separated (default: ${DEFAULT_FIELDS[sObject] ?? "Id"})` }, where: { type: "string", required: false, description: "SOQL WHERE clause" }, limit: { type: "number", required: false } },
    async execute(input, ctx) {
      const p = (input ?? {}) as Record<string, unknown>;
      const fields = (p.fields as string) || DEFAULT_FIELDS[sObject] || "Id";
      let q = `SELECT ${fields} FROM ${sObject}`;
      if (p.where) q += ` WHERE ${p.where}`;
      if (p.limit) q += ` LIMIT ${p.limit}`;
      const data = (await api(conn(ctx), "GET", "/query", undefined, { q })) as Record<string, unknown>;
      return data.records;
    } });

  rl.registerAction(`${lower}.upsert`, { description: `Upsert a ${sObject} by external ID`, inputSchema: { externalIdField: { type: "string", required: true }, externalIdValue: { type: "string", required: true }, data: { type: "object", required: true } },
    async execute(input, ctx) {
      const p = input as Record<string, unknown>;
      return api(conn(ctx), "PATCH", `/sobjects/${sObject}/${p.externalIdField}/${p.externalIdValue}`, p.data as Record<string, unknown>);
    } });
}

export default function salesforce(rl: RunlinePluginAPI) {
  rl.setName("salesforce");
  rl.setVersion("0.1.0");
  rl.setConnectionSchema({
    instanceUrl: { type: "string", required: true, description: "Salesforce instance URL (e.g. https://yourorg.my.salesforce.com)", env: "SALESFORCE_INSTANCE_URL" },
    accessToken: { type: "string", required: true, description: "Salesforce OAuth2 access token", env: "SALESFORCE_ACCESS_TOKEN" },
  });

  for (const sObject of SOBJECTS) {
    registerSObject(rl, sObject, getConn);
  }

  // ── Generic sObject ─────────────────────────────────

  rl.registerAction("sobject.create", { description: "Create any sObject record", inputSchema: { sObject: { type: "string", required: true }, data: { type: "object", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "POST", `/sobjects/${p.sObject}`, p.data as Record<string, unknown>); } });

  rl.registerAction("sobject.get", { description: "Get any sObject record", inputSchema: { sObject: { type: "string", required: true }, id: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; return api(getConn(ctx), "GET", `/sobjects/${p.sObject}/${p.id}`); } });

  rl.registerAction("sobject.update", { description: "Update any sObject record", inputSchema: { sObject: { type: "string", required: true }, id: { type: "string", required: true }, data: { type: "object", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; await api(getConn(ctx), "PATCH", `/sobjects/${p.sObject}/${p.id}`, p.data as Record<string, unknown>); return { success: true }; } });

  rl.registerAction("sobject.delete", { description: "Delete any sObject record", inputSchema: { sObject: { type: "string", required: true }, id: { type: "string", required: true } },
    async execute(input, ctx) { const p = input as Record<string, unknown>; await api(getConn(ctx), "DELETE", `/sobjects/${p.sObject}/${p.id}`); return { success: true }; } });

  // ── SOQL Query ──────────────────────────────────────

  rl.registerAction("soql.query", { description: "Execute a raw SOQL query", inputSchema: { query: { type: "string", required: true, description: "Full SOQL query" } },
    async execute(input, ctx) {
      const data = (await api(getConn(ctx), "GET", "/query", undefined, { q: (input as Record<string, unknown>).query })) as Record<string, unknown>;
      return data.records;
    } });

  // ── Describe ────────────────────────────────────────

  rl.registerAction("sobject.describe", { description: "Describe an sObject's metadata/fields", inputSchema: { sObject: { type: "string", required: true } },
    async execute(input, ctx) { return api(getConn(ctx), "GET", `/sobjects/${(input as Record<string, unknown>).sObject}/describe`); } });
}
