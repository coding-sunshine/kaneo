import { createHmac } from "node:crypto";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { settleEvents } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { sendWorkspaceWebhookDelivery } from "../../apps/api/src/workspace-webhook/worker";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { publishEvent } from "../../apps/api/src/events";

let server: Server;
let url: string;
let requests: { body: string; headers: IncomingHttpHeaders }[];

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("NOTIFICATION_SECRET_ENCRYPTION_KEY", "webhook-test-key");
  vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
  requests = [];
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      requests.push({ body, headers: req.headers });
      res.writeHead(204).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  url = `http://127.0.0.1:${address.port}/hook`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.unstubAllEnvs();
});

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const workspaceId = owner.workspace.id;
  const a = await createProjectFixture({ workspaceId, name: "Team A" });
  const b = await createProjectFixture({ workspaceId, name: "Team B" });
  mockAuthenticatedSession(owner.user);
  const { app } = createApp();
  const call = (method: string, path: string, body?: unknown) =>
    app.request(`/api/workspace-webhook${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const create = async (extra: Record<string, unknown> = {}) => {
    const res = await call("POST", "", {
      workspaceId,
      label: "hook",
      url,
      resourceTypes: ["task"],
      ...extra,
    });
    expect(res.status, await res.clone().text()).toBe(200);
    return (await res.json()) as {
      webhook: { id: string };
      secret: string;
    };
  };
  return { owner, workspaceId, a, b, call, create };
}

async function task(projectId: string, title = "Fix") {
  const [row] = await db
    .insert(schema.taskTable)
    .values({ projectId, title, number: Math.floor(Math.random() * 1e6) })
    .returning();
  return row;
}

async function drain() {
  await settleEvents();
  while (await sendWorkspaceWebhookDelivery());
}

describe("workspace webhooks", () => {
  it("delivers a signed task update with the API shape", async () => {
    const { a, create } = await setup();
    const { webhook, secret } = await create();
    const t = await task(a.project.id, "Ship it");
    await publishEvent("task.updated", {
      taskId: t.id,
      projectId: a.project.id,
    });
    await drain();
    expect(requests).toHaveLength(1);
    const { body, headers } = requests[0];
    const payload = JSON.parse(body);
    expect(payload).toMatchObject({
      action: "update",
      type: "task",
      webhookId: webhook.id,
      url,
      data: { id: t.id, title: "Ship it", projectId: a.project.id },
    });
    expect(typeof payload.createdAt).toBe("string");
    const timestamp = headers["x-kaneo-timestamp"] as string;
    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    expect(headers["x-kaneo-signature"]).toBe(`sha256=${expected}`);
    expect(body).not.toContain(secret);
  });

  it("filters by resource type", async () => {
    const { a, create } = await setup();
    await create({ resourceTypes: ["comment"] });
    const t = await task(a.project.id);
    await publishEvent("task.updated", {
      taskId: t.id,
      projectId: a.project.id,
    });
    await drain();
    expect(requests).toHaveLength(0);
  });

  it("filters by team", async () => {
    const { a, b, create } = await setup();
    await create({ projectIds: [b.project.id] });
    const ta = await task(a.project.id, "in A");
    const tb = await task(b.project.id, "in B");
    for (const [t, p] of [
      [ta, a.project.id],
      [tb, b.project.id],
    ] as const)
      await publishEvent("task.updated", { taskId: t.id, projectId: p });
    await drain();
    expect(requests.map((r) => JSON.parse(r.body).data.title)).toEqual([
      "in B",
    ]);
  });

  it("skips disabled webhooks", async () => {
    const { a, create, call } = await setup();
    const { webhook } = await create();
    expect(
      (await call("PUT", `/${webhook.id}`, { enabled: false })).status,
    ).toBe(200);
    const t = await task(a.project.id);
    await publishEvent("task.updated", {
      taskId: t.id,
      projectId: a.project.id,
    });
    await drain();
    expect(requests).toHaveLength(0);
  });

  it("never delivers across workspaces", async () => {
    const { create } = await setup();
    await create();
    const other = await createWorkspaceMember({ role: "owner" });
    const o = await createProjectFixture({ workspaceId: other.workspace.id });
    const t = await task(o.project.id);
    await publishEvent("task.updated", {
      taskId: t.id,
      projectId: o.project.id,
    });
    await drain();
    expect(requests).toHaveLength(0);
  });

  it("shows the secret once and never lists it", async () => {
    const { workspaceId, create, call } = await setup();
    const { secret } = await create();
    expect(secret.length).toBeGreaterThan(20);
    const text = await (await call("GET", `/workspace/${workspaceId}`)).text();
    expect(text).not.toContain(secret);
    expect(text).not.toContain('"secret"');
    const [row] = await db.select().from(schema.workspaceWebhookTable);
    expect(row.secret).not.toBe(secret);
  });

  it("rejects a private URL when destinations are not allowed", async () => {
    const { workspaceId, call } = await setup();
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "false");
    const res = await call("POST", "", {
      workspaceId,
      label: "x",
      url: "http://127.0.0.1:9/hook",
      resourceTypes: ["task"],
    });
    expect(res.status).toBe(400);
  });

  it("edits and deletes a webhook", async () => {
    const { b, workspaceId, create, call } = await setup();
    const { webhook } = await create();
    const res = await call("PUT", `/${webhook.id}`, {
      label: "renamed",
      resourceTypes: ["task", "label"],
      projectIds: [b.project.id],
    });
    expect(await res.json()).toMatchObject({
      label: "renamed",
      resourceTypes: ["task", "label"],
      projectIds: [b.project.id],
    });
    expect((await call("DELETE", `/${webhook.id}`)).status).toBe(200);
    expect(
      await (await call("GET", `/workspace/${workspaceId}`)).json(),
    ).toEqual([]);
  });

  it("returns 403 to a member and 404 for another workspace", async () => {
    const { workspaceId, create, call } = await setup();
    const { webhook } = await create();

    const member = await createWorkspaceMember({ role: "member" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId,
      userId: member.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(member.user);
    expect((await call("GET", `/workspace/${workspaceId}`)).status).toBe(403);
    expect(
      (
        await call("POST", "", {
          workspaceId,
          label: "x",
          url,
          resourceTypes: ["task"],
        })
      ).status,
    ).toBe(403);
    expect(
      (await call("PUT", `/${webhook.id}`, { enabled: false })).status,
    ).toBe(403);
    expect((await call("DELETE", `/${webhook.id}`)).status).toBe(403);

    const outsider = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(outsider.user);
    expect((await call("GET", `/workspace/${workspaceId}`)).status).toBe(404);
    expect(
      (await call("PUT", `/${webhook.id}`, { enabled: false })).status,
    ).toBe(404);
    expect((await call("DELETE", `/${webhook.id}`)).status).toBe(404);
    const [still] = await db
      .select()
      .from(schema.workspaceWebhookTable)
      .where(eq(schema.workspaceWebhookTable.id, webhook.id));
    expect(still?.enabled).toBe(true);
  });
});
