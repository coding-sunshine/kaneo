import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { chatPresenceTable } from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type Seeded = Awaited<ReturnType<typeof createWorkspaceMember>>;

async function setup() {
  const a = await createWorkspaceMember({ role: "owner" });
  const b = await createWorkspaceMember();
  const c = await createWorkspaceMember();
  const outsider = await createWorkspaceMember();
  const ws = a.workspace.id;
  for (const member of [b, c])
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.user.id,
      role: "member",
      joinedAt: new Date(),
    });
  const { app } = createApp();
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const setPresence = async (member: Seeded, enabled: boolean) =>
    as(member)("/api/chat/presence", json("PUT", { enabled }));
  const online = async (member: Seeded, workspaceId = ws) => {
    const response = await as(member)(
      `/api/chat/workspace/${workspaceId}/presence`,
    );
    return response.status === 200
      ? ((await response.json()).online as string[]).sort()
      : response.status;
  };
  return { a, b, c, outsider, ws, as, setPresence, online };
}

describe("API integration: chat presence", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("is off for a fresh user, who sees nobody online", async () => {
    const { a, b, as, setPresence, online } = await setup();
    expect(await (await as(b)("/api/chat/presence")).json()).toEqual({
      enabled: false,
    });
    await setPresence(a, true);
    expect(await online(b)).toEqual([]);
  });

  it("shows only users who turned it on, and only to users who did too", async () => {
    const { a, b, c, setPresence, online } = await setup();
    expect((await setPresence(a, true)).status).toBe(200);
    await setPresence(c, true);

    expect(await online(c)).toEqual([a.user.id, c.user.id].sort());
    expect(await online(a)).toEqual([a.user.id, c.user.id].sort());
    expect(await online(b)).toEqual([]);
    expect(await online(a)).not.toContain(b.user.id);
  });

  it("removes a user's dot as soon as they turn it off", async () => {
    const { a, c, as, setPresence, online } = await setup();
    await setPresence(a, true);
    await setPresence(c, true);

    expect(await (await setPresence(a, false)).json()).toEqual({
      enabled: false,
    });
    expect(await online(c)).toEqual([c.user.id]);
    expect(await (await as(a)("/api/chat/presence")).json()).toEqual({
      enabled: false,
    });
    // A heartbeat never turns it back on.
    await as(a)("/api/chat/presence/heartbeat", json("POST"));
    expect(await online(c)).toEqual([c.user.id]);
  });

  it("drops a user who stopped sending heartbeats", async () => {
    const { a, c, as, setPresence, online } = await setup();
    await setPresence(a, true);
    await setPresence(c, true);
    await db
      .update(chatPresenceTable)
      .set({ lastSeenAt: new Date(Date.now() - 10 * 60 * 1000) });

    expect(await online(c)).toEqual([]);
    await as(c)("/api/chat/presence/heartbeat", json("POST"));
    expect(await online(c)).toEqual([c.user.id]);
  });

  it("never shows anyone outside the workspace", async () => {
    const { a, outsider, ws, setPresence, online } = await setup();
    await setPresence(a, true);
    await setPresence(outsider, true);

    expect(await online(a)).toEqual([a.user.id]);
    expect(await online(outsider, ws)).toBe(404);
  });
});
