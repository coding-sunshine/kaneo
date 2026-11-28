import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  chatChannelMemberTable,
  chatMessageTable,
  dailyBriefTable,
  semanticChunkTable,
} from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type User = typeof schema.userTable.$inferSelect;

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const ws = owner.workspace.id;
  const join = async (guest = false) => {
    const { user } = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: user.id,
      role: "member",
      joinedAt: new Date(),
    });
    if (guest)
      await db.insert(schema.workspaceMemberAccessTable).values({
        workspaceId: ws,
        userId: user.id,
        projectAccess: "selected",
        guest: true,
      });
    return user;
  };
  const a = await join();
  const b = await join();
  const c = await join();
  const { app } = createApp();
  const as = (user: User) => {
    mockAuthenticatedSession(user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const base = `/api/chat/workspace/${ws}`;
  const openDm = async (from: User, to: User) => {
    const res = await as(from)(
      `${base}/direct-messages`,
      json("POST", { userIds: [to.id] }),
    );
    expect(res.status, await res.clone().text()).toBe(200);
    return ((await res.json()) as { id: string }).id;
  };
  const createChannel = async (by: User, name: string) => {
    const res = await as(by)(`${base}/channels`, json("POST", { name }));
    expect(res.status, await res.clone().text()).toBe(200);
    return ((await res.json()) as { id: string }).id;
  };
  const post = async (by: User, channelId: string, body: string) => {
    const res = await as(by)(
      `${base}/channels/${channelId}/messages`,
      json("POST", { body }),
    );
    expect(res.status, await res.clone().text()).toBe(200);
    return ((await res.json()) as { id: string }).id;
  };
  const setAi = (by: User, channelId: string, body: object) =>
    as(by)(`${base}/channels/${channelId}`, json("PATCH", body));
  const includeDms = async (user: User, includeDirectMessages: boolean) => {
    const res = await as(user)(
      `/api/catch-up/workspace/${ws}/preference`,
      json("PUT", { includeDirectMessages }),
    );
    expect(res.status, await res.clone().text()).toBe(200);
  };
  const search = async (user: User, q: string, forAi: boolean) => {
    const res = await as(user)(
      `/api/search?q=${encodeURIComponent(q)}&workspaceId=${ws}&type=messages`,
      forAi ? { headers: { "x-kaneo-ai-reader": "1" } } : undefined,
    );
    expect(res.status, await res.clone().text()).toBe(200);
    return JSON.stringify(await res.json());
  };
  return {
    owner: owner.user,
    ws,
    a,
    b,
    c,
    join,
    as,
    base,
    openDm,
    createChannel,
    post,
    setAi,
    includeDms,
    search,
  };
}

describe("API integration: AI opt-out for channels and direct messages", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
  });

  it("lets a person in a direct message turn its AI off and on, and nothing else", async () => {
    const { a, b, c, openDm, setAi } = await setup();
    const dm = await openDm(a, b);

    const off = await setAi(b, dm, { aiDisabled: true });
    expect(off.status, await off.clone().text()).toBe(200);
    expect((await off.json()).aiDisabled).toBe(true);
    const on = await setAi(a, dm, { aiDisabled: false });
    expect((await on.json()).aiDisabled).toBe(false);

    // Members of a direct message stay fixed, AI switch or not.
    for (const body of [
      { archived: true },
      { topic: "renamed" },
      { aiDisabled: true, archived: true },
    ])
      expect((await setAi(a, dm, body)).status).toBe(403);
    // Someone outside the direct message cannot find it.
    expect((await setAi(c, dm, { aiDisabled: true })).status).toBe(404);
  });

  it("keeps the channel AI switch to members who are not guests", async () => {
    const { a, b, join, createChannel, setAi } = await setup();
    const general = await createChannel(a, "general");
    expect((await setAi(b, general, { aiDisabled: true })).status).toBe(403);
    const guest = await join(true);
    await db
      .insert(chatChannelMemberTable)
      .values({ channelId: general, userId: guest.id });
    expect((await setAi(guest, general, { aiDisabled: true })).status).toBe(
      403,
    );
    expect((await setAi(a, general, { aiDisabled: true })).status).toBe(200);
  });

  it("leaves direct messages out of an AI search unless the person opts in", async () => {
    const { a, b, c, openDm, createChannel, post, setAi, includeDms, search } =
      await setup();
    const dm = await openDm(a, b);
    await post(a, dm, "Quokka plans in private");
    const general = await createChannel(a, "general");
    await post(a, general, "Quokka plans in public");

    // The person's own search finds both.
    expect(await search(a, "Quokka", false)).toContain("in private");
    // An AI reading for them gets the channel only.
    const ai = await search(a, "Quokka", true);
    expect(ai).toContain("in public");
    expect(ai).not.toContain("in private");

    await includeDms(a, true);
    expect(await search(a, "Quokka", true)).toContain("in private");
    // One person's opt-in is theirs alone.
    expect(await search(b, "Quokka", true)).not.toContain("in private");
    expect(await search(c, "Quokka", true)).not.toContain("in private");

    // A direct message marked no AI stays out even after the opt-in.
    expect((await setAi(b, dm, { aiDisabled: true })).status).toBe(200);
    expect(await search(a, "Quokka", true)).not.toContain("in private");
    expect(await search(a, "Quokka", false)).toContain("in private");
  });

  it("forgets embeddings and brief lines of a channel as soon as its AI is turned off", async () => {
    const { ws, a, createChannel, post, setAi } = await setup();
    const quiet = await createChannel(a, "quiet");
    const open = await createChannel(a, "open");
    const secret = await post(a, quiet, "Quokka plans for the quiet room");
    const kept = await post(a, open, "Quokka plans for everyone");
    await db.insert(semanticChunkTable).values(
      [secret, kept].map((messageId) => ({
        workspaceId: ws,
        messageId,
        contentHash: messageId,
        embedding: [1, 0],
      })),
    );
    const mention = (messageId: string, channelId: string) => ({
      messageId,
      channelId,
      channelName: channelId === quiet ? "quiet" : "open",
      preview: channelId === quiet ? "quiet room words" : "open words",
      createdAt: new Date().toISOString(),
    });
    await db.insert(dailyBriefTable).values({
      workspaceId: ws,
      userId: a.id,
      day: "2026-11-27",
      content: {
        dueToday: [],
        moved: [],
        mentions: [mention(secret, quiet), mention(kept, open)],
      },
    });

    expect((await setAi(a, quiet, { aiDisabled: true })).status).toBe(200);

    const chunks = await db
      .select({ messageId: semanticChunkTable.messageId })
      .from(semanticChunkTable);
    expect(chunks).toEqual([{ messageId: kept }]);
    const [brief] = await db.select().from(dailyBriefTable);
    expect(JSON.stringify(brief?.content)).not.toContain("quiet room words");
    expect(brief?.content.mentions).toEqual(
      [mention(kept, open)].map((m) => ({
        ...m,
        createdAt: expect.any(String),
      })),
    );
    // The messages themselves stay.
    expect(
      await db
        .select({ id: chatMessageTable.id })
        .from(chatMessageTable)
        .where(eq(chatMessageTable.id, secret)),
    ).toHaveLength(1);
  });
});
