import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { aiDestinationChangeTable } from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const SELF_HOSTED = "http://models.internal/v1";

async function addMember(workspaceId: string, role: string) {
  const other = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: other.user.id,
    role,
    joinedAt: new Date(),
  });
  return other.user;
}

// A fake model server: records each request and answers "ok" as one SSE chunk.
function fakeModelServer() {
  const requests: { url: string; headers: Headers; body: { model: string } }[] =
    [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      requests.push({
        url: String(url),
        headers: new Headers(init.headers),
        body: JSON.parse(String(init.body)),
      });
      return new Response(
        'data: {"choices":[{"delta":{"content":"ok"}}],"usage":{"prompt_tokens":3,"completion_tokens":1}}\n\n',
      );
    }),
  );
  return requests;
}

describe("API integration: AI data destination", () => {
  const { app } = createApp();

  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    delete process.env.AI_SELF_HOSTED_URL;
    delete process.env.AGENT_MODEL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AI_SELF_HOSTED_URL;
  });

  it("is off, and hidden, when the server has no key", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const config = await (await app.request("/api/config")).json();
    expect(config.hasAgent).toBe(false);
    const res = await app.request(
      `/api/agent/workspace/${owner.workspace.id}/ai-destination`,
    );
    expect(res.status).toBe(404);
  });

  it("names the provider and model that receive the workspace's text", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const res = await app.request(
      `/api/agent/workspace/${owner.workspace.id}/ai-destination`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      provider: "openrouter",
      model: expect.any(String),
      openRouter: { configured: true },
      selfHosted: { configured: false },
      canChange: true,
    });
  });

  it("lets a member read the destination but not change it", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const member = await addMember(owner.workspace.id, "member");
    process.env.AI_SELF_HOSTED_URL = SELF_HOSTED;
    mockAuthenticatedSession(member);
    const url = `/api/agent/workspace/${owner.workspace.id}/ai-destination`;
    const read = await app.request(url);
    expect(read.status).toBe(200);
    expect((await read.json()).canChange).toBe(false);
    const change = await app.request(
      url,
      json("PUT", { provider: "self-hosted", model: "local-llm" }),
    );
    expect(change.status).toBe(403);
    expect(await db.select().from(aiDestinationChangeTable)).toEqual([]);
  });

  it("keeps another workspace's admin out", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const stranger = await createWorkspaceMember({ role: "owner" });
    process.env.AI_SELF_HOSTED_URL = SELF_HOSTED;
    mockAuthenticatedSession(stranger.user);
    const url = `/api/agent/workspace/${owner.workspace.id}/ai-destination`;
    expect((await app.request(url)).status).not.toBe(200);
    const change = await app.request(
      url,
      json("PUT", { provider: "self-hosted", model: "local-llm" }),
    );
    expect(change.status).not.toBe(200);
    expect(await db.select().from(aiDestinationChangeTable)).toEqual([]);
  });

  it("refuses a self-hosted model the server has not configured", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(owner.user);
    const res = await app.request(
      `/api/agent/workspace/${owner.workspace.id}/ai-destination`,
      json("PUT", { provider: "self-hosted", model: "local-llm" }),
    );
    expect(res.status).toBe(400);
  });

  it("sends the assistant's calls to the chosen self-hosted model and records the change in the AI audit", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    process.env.AI_SELF_HOSTED_URL = SELF_HOSTED;
    mockAuthenticatedSession(owner.user);
    const ws = owner.workspace.id;
    const change = await app.request(
      `/api/agent/workspace/${ws}/ai-destination`,
      json("PUT", { provider: "self-hosted", model: "local-llm" }),
    );
    expect(change.status).toBe(200);
    expect(await change.json()).toMatchObject({
      provider: "self-hosted",
      model: "local-llm",
    });

    const requests = fakeModelServer();
    const sent = await app.request(
      `/api/agent/workspace/${ws}/messages`,
      json("POST", { message: "hello" }),
    );
    expect(sent.status).toBe(200);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(`${SELF_HOSTED}/chat/completions`);
    expect(requests[0]?.body.model).toBe("local-llm");
    expect(requests[0]?.headers.get("authorization")).toBeNull();

    const audit = await (
      await app.request(`/api/agent/workspace/${ws}/audit`)
    ).json();
    expect(audit[0]).toMatchObject({
      kind: "setting",
      tool: "set_ai_destination",
      acceptedBy: { id: owner.user.id },
      diff: [
        { field: "provider", from: "openrouter", to: "self-hosted" },
        { field: "model", to: "local-llm" },
      ],
    });
  });

  it("lists a save in the AI audit only when it changes the destination", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    process.env.AI_SELF_HOSTED_URL = SELF_HOSTED;
    mockAuthenticatedSession(owner.user);
    const ws = owner.workspace.id;
    const put = (body: unknown) =>
      app.request(
        `/api/agent/workspace/${ws}/ai-destination`,
        json("PUT", body),
      );
    const audit = async () =>
      (await (
        await app.request(`/api/agent/workspace/${ws}/audit`)
      ).json()) as {
        kind: string;
      }[];

    expect((await put({ provider: "openrouter" })).status).toBe(200);
    expect(await audit()).toEqual([]);

    const local = { provider: "self-hosted", model: "local-llm" };
    expect((await put(local)).status).toBe(200);
    expect((await put(local)).status).toBe(200);
    const rows = await audit();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "setting" });
  });

  it("keeps a self-hosted workspace off when the server drops its URL, rather than sending its text to OpenRouter", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    process.env.AI_SELF_HOSTED_URL = SELF_HOSTED;
    mockAuthenticatedSession(owner.user);
    const ws = owner.workspace.id;
    await app.request(
      `/api/agent/workspace/${ws}/ai-destination`,
      json("PUT", { provider: "self-hosted", model: "local-llm" }),
    );
    delete process.env.AI_SELF_HOSTED_URL;
    const requests = fakeModelServer();
    await app.request(
      `/api/agent/workspace/${ws}/messages`,
      json("POST", { message: "hello" }),
    );
    expect(requests).toEqual([]);
  });
});
