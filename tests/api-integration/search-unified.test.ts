import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  chatChannelMemberTable,
  chatChannelTable,
  chatMessageTable,
} from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type Seeded = Awaited<ReturnType<typeof createWorkspaceMember>>;
type Result = {
  id: string;
  type: string;
  title: string;
  content?: string;
  description?: string;
  channelId?: string;
  isDirect?: boolean;
};

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const ws = owner.workspace.id;
  const [a, b, c] = await Promise.all([
    createWorkspaceMember({ userName: "Alpha Person" }),
    createWorkspaceMember({ userName: "Bravo Person" }),
    createWorkspaceMember({ userName: "Charlie Person" }),
  ]);
  for (const member of [a, b, c])
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.user.id,
      role: "member",
      joinedAt: new Date(),
    });
  const outsider = await createWorkspaceMember({ userName: "Outside Person" });
  const { project } = await createProjectFixture({ workspaceId: ws });
  const { app } = createApp();
  const channels = `/api/chat/workspace/${ws}/channels`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const createChannel = async (
    member: Seeded,
    name: string,
    isPrivate: boolean,
  ) => {
    const response = await as(member)(
      channels,
      json("POST", { name, isPrivate }),
    );
    expect(response.status).toBe(200);
    return ((await response.json()) as { id: string }).id;
  };
  const post = async (member: Seeded, channelId: string, body: string) => {
    const response = await as(member)(
      `${channels}/${channelId}/messages`,
      json("POST", { body }),
    );
    expect(response.status).toBe(200);
    return ((await response.json()) as { id: string }).id;
  };
  const openDm = async (member: Seeded, other: Seeded) => {
    const response = await as(member)(
      `/api/chat/workspace/${ws}/direct-messages`,
      json("POST", { userIds: [other.user.id] }),
    );
    expect(response.status).toBe(200);
    return ((await response.json()) as { id: string }).id;
  };
  const searchStatus = async (
    member: Seeded,
    q: string,
    type = "all",
    workspaceId = ws,
  ) =>
    as(member)(
      `/api/search?${new URLSearchParams({ q, type, workspaceId, limit: "50" })}`,
    );
  const search = async (member: Seeded, q: string, type = "all") => {
    const response = await searchStatus(member, q, type);
    expect(response.status).toBe(200);
    return ((await response.json()) as { results: Result[] }).results;
  };
  const ids = (results: Result[]) => new Set(results.map((r) => r.id));
  return {
    owner,
    a,
    b,
    c,
    outsider,
    ws,
    project,
    channels,
    as,
    createChannel,
    post,
    openDm,
    search,
    searchStatus,
    ids,
  };
}

async function seedZebra(ctx: Awaited<ReturnType<typeof setup>>) {
  const { a, b, c, ws, project, createChannel, post, openDm, as, channels } =
    ctx;
  const general = await createChannel(a, "general", false);
  const secret = await createChannel(a, "secret", true);
  await as(a)(
    `${channels}/${secret}/members`,
    json("POST", { userId: c.user.id }),
  );
  const dm = await openDm(a, c);
  const publicMessage = await post(a, general, "zebra-launch in public");
  const privateMessage = await post(a, secret, "zebra-launch in private");
  const directMessage = await post(a, dm, "zebra-launch between us");
  expect(
    (await as(b)(`${channels}/${general}/join`, json("POST"))).status,
  ).toBe(200);
  await post(b, general, "unrelated chatter");
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Plan zebra-launch", number: 1 })
    .returning();
  const [document] = await db
    .insert(schema.documentTable)
    .values({
      workspaceId: ws,
      title: "zebra-launch notes",
      scope: "workspace",
    })
    .returning();
  return {
    general,
    secret,
    dm,
    publicMessage,
    privateMessage,
    directMessage,
    taskId: task!.id,
    documentId: document!.id,
  };
}

describe("API integration: unified search", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("finds a member's public, private and direct messages next to tickets and documents", async () => {
    const ctx = await setup();
    const seeded = await seedZebra(ctx);
    const results = await ctx.search(ctx.a, "zebra-launch");
    expect(ctx.ids(results)).toEqual(
      new Set([
        seeded.publicMessage,
        seeded.privateMessage,
        seeded.directMessage,
        seeded.taskId,
        seeded.documentId,
      ]),
    );
    const byId = new Map(results.map((r) => [r.id, r]));
    expect(byId.get(seeded.publicMessage)).toMatchObject({
      type: "message",
      channelId: seeded.general,
      title: "general",
      content: "zebra-launch in public",
      isDirect: false,
    });
    expect(byId.get(seeded.directMessage)).toMatchObject({
      type: "message",
      channelId: seeded.dm,
      isDirect: true,
    });
    expect(byId.get(seeded.taskId)?.type).toBe("task");
    expect(byId.get(seeded.documentId)?.type).toBe("document");
  });

  it("hides private channel and direct messages from people outside them", async () => {
    const ctx = await setup();
    const seeded = await seedZebra(ctx);
    for (const stranger of [ctx.b, ctx.owner])
      expect(ctx.ids(await ctx.search(stranger, "zebra-launch"))).toEqual(
        new Set([seeded.publicMessage, seeded.taskId, seeded.documentId]),
      );
    expect(
      ctx.ids(await ctx.search(ctx.c, "zebra-launch", "messages")),
    ).toEqual(
      new Set([
        seeded.publicMessage,
        seeded.privateMessage,
        seeded.directMessage,
      ]),
    );
  });

  it("drops a private channel's messages once the searcher leaves it", async () => {
    const ctx = await setup();
    const seeded = await seedZebra(ctx);
    const left = await ctx.as(ctx.c)(
      `${ctx.channels}/${seeded.secret}/leave`,
      json("POST"),
    );
    expect(left.status).toBe(200);
    expect(
      ctx.ids(await ctx.search(ctx.c, "zebra-launch", "messages")),
    ).toEqual(new Set([seeded.publicMessage, seeded.directMessage]));
  });

  it("keeps messages in archived channels searchable", async () => {
    const ctx = await setup();
    const seeded = await seedZebra(ctx);
    const archived = await ctx.as(ctx.a)(
      `${ctx.channels}/${seeded.general}`,
      json("PATCH", { archived: true }),
    );
    expect(archived.status).toBe(200);
    expect(
      ctx.ids(await ctx.search(ctx.b, "zebra-launch", "messages")),
    ).toEqual(new Set([seeded.publicMessage]));
  });

  it("finds an edited message by its new text and never a deleted one", async () => {
    const ctx = await setup();
    const general = await ctx.createChannel(ctx.a, "general", false);
    const edited = await ctx.post(ctx.a, general, "zebra-launch draft");
    const deleted = await ctx.post(ctx.a, general, "zebra-launch typo");
    const messages = `${ctx.channels}/${general}/messages`;
    expect(
      (
        await ctx.as(ctx.a)(
          `${messages}/${edited}`,
          json("PATCH", { body: "walrus-launch final" }),
        )
      ).status,
    ).toBe(200);
    expect(
      (await ctx.as(ctx.a)(`${messages}/${deleted}`, json("DELETE"))).status,
    ).toBe(200);

    expect(await ctx.search(ctx.b, "zebra-launch", "messages")).toEqual([]);
    const found = await ctx.search(ctx.b, "walrus-launch", "messages");
    expect(found.map((r) => [r.id, r.content])).toEqual([
      [edited, "walrus-launch final"],
    ]);
  });

  it("matches short queries in messages by substring", async () => {
    const ctx = await setup();
    const general = await ctx.createChannel(ctx.a, "general", false);
    const message = await ctx.post(ctx.a, general, "ok go");
    expect(ctx.ids(await ctx.search(ctx.b, "ok", "messages"))).toEqual(
      new Set([message]),
    );
  });

  it("keeps messages from other workspaces out", async () => {
    const ctx = await setup();
    const seeded = await seedZebra(ctx);
    const elsewhere = await createWorkspaceMember();
    const [channel] = await db
      .insert(chatChannelTable)
      .values({ workspaceId: elsewhere.workspace.id, name: "general" })
      .returning();
    await db.insert(chatMessageTable).values({
      channelId: channel!.id,
      userId: elsewhere.user.id,
      body: "zebra-launch far away",
    });
    expect(
      ctx.ids(await ctx.search(ctx.b, "zebra-launch", "messages")),
    ).toEqual(new Set([seeded.publicMessage]));
    const refused = await ctx.searchStatus(ctx.outsider, "zebra-launch");
    expect(refused.status).toBe(404);
  });

  it("finds workspace members by name and nobody from other workspaces", async () => {
    const ctx = await setup();
    const results = await ctx.search(ctx.b, "person", "people");
    expect(ctx.ids(results)).toEqual(
      new Set([ctx.a.user.id, ctx.b.user.id, ctx.c.user.id]),
    );
    expect(results.find((r) => r.id === ctx.a.user.id)).toMatchObject({
      type: "person",
      title: "Alpha Person",
    });
    expect(ctx.ids(await ctx.search(ctx.b, "alpha")).has(ctx.a.user.id)).toBe(
      true,
    );
  });

  it("never matches people by email", async () => {
    const ctx = await setup();
    for (const searcher of [ctx.b, ctx.owner])
      expect(await ctx.search(searcher, ctx.a.user.email, "people")).toEqual(
        [],
      );
    expect(await ctx.search(ctx.b, "example.com", "people")).toEqual([]);
  });
});

async function setupGuest() {
  const ctx = await setup();
  const { ws, project, createChannel, post, openDm } = ctx;
  const other = await createProjectFixture({ workspaceId: ws, name: "Other" });
  const guest = await createWorkspaceMember({ userName: "Guest Person" });
  const outOfReach = await createWorkspaceMember({ userName: "Delta Person" });
  for (const member of [guest, outOfReach])
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.user.id,
      role: "member",
      joinedAt: new Date(),
    });
  await restrictToProjects(ws, outOfReach.user.id, [other.project.id]);
  await restrictToProjects(ws, guest.user.id, [project.id]);
  await db
    .update(schema.workspaceMemberAccessTable)
    .set({ guest: true })
    .where(eq(schema.workspaceMemberAccessTable.userId, guest.user.id));

  const general = await createChannel(ctx.a, "general", false);
  const client = await createChannel(ctx.a, "client", true);
  // A workspace admin adds a guest to a channel; seeded directly here.
  await db
    .insert(chatChannelMemberTable)
    .values({ channelId: client, userId: guest.user.id });
  const inGeneral = await post(ctx.a, general, "zebra-launch for staff");
  const inClient = await post(ctx.a, client, "zebra-launch for the client");
  const dm = await openDm(ctx.a, guest);
  const inDm = await post(ctx.a, dm, "zebra-launch just for you");
  // A direct message with someone the guest no longer works with.
  const [hiddenDm] = await db
    .insert(chatChannelTable)
    .values({
      workspaceId: ws,
      name: "",
      isPrivate: true,
      directKey: [guest.user.id, outOfReach.user.id].sort().join(","),
    })
    .returning();
  await db.insert(chatChannelMemberTable).values([
    { channelId: hiddenDm!.id, userId: guest.user.id },
    { channelId: hiddenDm!.id, userId: outOfReach.user.id },
  ]);
  await db.insert(chatMessageTable).values({
    channelId: hiddenDm!.id,
    userId: outOfReach.user.id,
    body: "zebra-launch out of reach",
  });
  return {
    ...ctx,
    guest,
    outOfReach,
    general,
    client,
    inGeneral,
    inClient,
    inDm,
  };
}

describe("API integration: unified search for a guest", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("shows a guest only messages from channels they joined and direct messages in reach", async () => {
    const ctx = await setupGuest();
    for (const type of ["messages", "all"])
      expect(
        ctx.ids(
          (await ctx.search(ctx.guest, "zebra-launch", type)).filter(
            (r) => r.type === "message",
          ),
        ),
      ).toEqual(new Set([ctx.inClient, ctx.inDm]));
    const around = await ctx.as(ctx.guest)(
      `${ctx.channels}/${ctx.general}/messages?around=${ctx.inGeneral}`,
    );
    expect(around.status).toBe(404);
    // A member still sees the public channel's message.
    expect(
      ctx.ids(await ctx.search(ctx.b, "zebra-launch", "messages")),
    ).toEqual(new Set([ctx.inGeneral]));
  });

  it("shows a guest only people in reach and no email addresses", async () => {
    const ctx = await setupGuest();
    const results = await ctx.search(ctx.guest, "person", "people");
    expect(ctx.ids(results)).toEqual(
      new Set([ctx.a.user.id, ctx.b.user.id, ctx.c.user.id, ctx.guest.user.id]),
    );
    for (const result of results)
      if (result.id !== ctx.guest.user.id)
        expect(result.description).toBeFalsy();
    const body = JSON.stringify(await ctx.search(ctx.guest, "person", "all"));
    for (const member of [ctx.a, ctx.b, ctx.c, ctx.outOfReach])
      expect(body).not.toContain(member.user.email);
    expect(body).not.toContain("Delta Person");
  });
});

describe("API integration: chat messages around one message", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("returns the target with its neighbours, oldest first", async () => {
    const ctx = await setup();
    const general = await ctx.createChannel(ctx.a, "general", false);
    const start = Date.now() - 1000 * 60 * 60;
    const rows = await db
      .insert(chatMessageTable)
      .values(
        Array.from({ length: 80 }, (_, i) => ({
          channelId: general,
          userId: ctx.a.user.id,
          body: `message ${i}`,
          createdAt: new Date(start + i * 1000),
        })),
      )
      .returning({ id: chatMessageTable.id });
    const posted = rows.map((row) => row.id);
    const target = posted[10]!;
    const response = await ctx.as(ctx.b)(
      `${ctx.channels}/${general}/messages?around=${target}`,
    );
    expect(response.status).toBe(200);
    const page = (await response.json()) as {
      id: string;
      reactions?: unknown[];
    }[];
    // Same shape as the newest page, reactions included.
    expect(page.every((m) => Array.isArray(m.reactions))).toBe(true);
    const window = page.map((m) => m.id);
    expect(window).toEqual(posted.slice(0, 35));
    expect(window).toContain(target);
  });

  it("answers 404 for a private channel outside the reader and for a message from another channel", async () => {
    const ctx = await setup();
    const general = await ctx.createChannel(ctx.a, "general", false);
    const secret = await ctx.createChannel(ctx.a, "secret", true);
    const hidden = await ctx.post(ctx.a, secret, "hidden");
    const open = await ctx.post(ctx.a, general, "open");
    expect(
      (
        await ctx.as(ctx.b)(
          `${ctx.channels}/${secret}/messages?around=${hidden}`,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await ctx.as(ctx.b)(
          `${ctx.channels}/${general}/messages?around=${hidden}`,
        )
      ).status,
    ).toBe(404);
    expect(
      (await ctx.as(ctx.a)(`${ctx.channels}/${secret}/messages?around=${open}`))
        .status,
    ).toBe(404);
  });
});
