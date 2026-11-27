import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";

vi.mock("../../apps/api/src/storage/s3", async (original) => ({
  ...(await original<object>()),
  getPrivateObject: vi.fn(async () => ({
    body: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    contentLength: 3,
  })),
}));

type App = ReturnType<typeof createApp>["app"];

const CLIENT_URL = "http://localhost:5173";
const protocolVersion = "2026-07-28";

let app: App;

/** A signed-up member of a workspace with one private project asset. */
async function setUp() {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: CLIENT_URL },
    body: JSON.stringify({
      name: "Setup Pending",
      email: `${randomUUID()}@example.test`,
      password: "two-factor-gates-password",
    }),
  });
  expect(response.status).toBe(200);
  const { token, user } = (await response.json()) as {
    token: string;
    user: { id: string };
  };
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({
      id: `workspace-${randomUUID()}`,
      name: "Gates",
      slug: `gates-${randomUUID()}`,
      createdAt: new Date(),
    })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: "member",
    joinedAt: new Date(),
  });
  const { project } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [asset] = await db
    .insert(schema.assetTable)
    .values({
      workspaceId: workspace.id,
      projectId: project.id,
      objectKey: randomUUID(),
      filename: "private.png",
      mimeType: "image/png",
      size: 3,
      surface: "description",
      createdBy: user.id,
    })
    .returning();
  return { userId: user.id, token, cookie, assetId: asset.id };
}

/** Hold every session of the user to setting up two-factor, or release it. */
function holdForSetup(userId: string, held: boolean) {
  return db
    .update(schema.sessionTable)
    .set({ twoFactorSetupRequired: held })
    .where(eq(schema.sessionTable.userId, userId));
}

function initializeMcp(token: string) {
  return app.request("/api/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "mcp-method": "initialize",
      "mcp-protocol-version": protocolVersion,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion,
        capabilities: {},
        clientInfo: { name: "kaneo-two-factor-gates", version: "1.0.0" },
      },
    }),
  });
}

function decideConsent(cookie: string) {
  return app.request(`/api/mcp/authorize/request/request-${randomUUID()}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: CLIENT_URL, cookie },
    body: JSON.stringify({ approved: true }),
  });
}

function readAsset(assetId: string, headers: Record<string, string>) {
  return app.request(`/api/asset/${assetId}`, { headers });
}

beforeEach(async () => {
  await resetTestDatabase();
  ({ app } = createApp());
});

describe("API integration: sessions held to two-factor setup", () => {
  it("cannot use MCP with the session token", async () => {
    const user = await setUp();
    await holdForSetup(user.userId, true);
    expect((await initializeMcp(user.token)).status).toBe(401);

    await holdForSetup(user.userId, false);
    expect((await initializeMcp(user.token)).status).not.toBe(401);
  });

  it("cannot approve an MCP consent request", async () => {
    const user = await setUp();
    await holdForSetup(user.userId, true);
    const held = await decideConsent(user.cookie);
    expect(held.status).toBe(403);
    expect(await held.json()).toMatchObject({
      error: "two_factor_setup_required",
    });

    await holdForSetup(user.userId, false);
    // Past the gate, the made-up request id is simply unknown.
    expect((await decideConsent(user.cookie)).status).toBe(404);
  });

  it("cannot read a private asset with the bearer token or the cookie", async () => {
    const user = await setUp();
    const bearer = { authorization: `Bearer ${user.token}` };
    const cookie = { cookie: user.cookie };
    await holdForSetup(user.userId, true);
    for (const headers of [bearer, cookie]) {
      const response = await readAsset(user.assetId, headers);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        code: "TWO_FACTOR_SETUP_REQUIRED",
      });
    }

    await holdForSetup(user.userId, false);
    for (const headers of [bearer, cookie]) {
      expect((await readAsset(user.assetId, headers)).status).toBe(200);
    }
  });
});
