import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { chatMessageTable } from "../../apps/api/src/database/schema";
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
  const author = await createWorkspaceMember({ role: "owner" });
  const other = await createWorkspaceMember();
  const viewer = await createWorkspaceMember();
  const ws = author.workspace.id;
  for (const [member, role] of [
    [other, "member"],
    [viewer, "viewer"],
  ] as const)
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.user.id,
      role,
      joinedAt: new Date(),
    });
  const { app } = createApp();
  const base = `/api/chat/workspace/${ws}/channels`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const asAuthor = as(author);
  const create = async (name: string, isPrivate = false) =>
    (await asAuthor(base, json("POST", { name, isPrivate }))).json();
  const pub = await create("general");
  const priv = await create("leads", true);
  const post = async (channelId: string, body: string) =>
    (
      await as(author)(`${base}/${channelId}/messages`, json("POST", { body }))
    ).json();
  const mine = await post(pub.id, "first draft");
  const secret = await post(priv.id, "private note");
  await as(other)(`${base}/${pub.id}/join`, json("POST"));
  await as(author)(
    `${base}/${pub.id}/members`,
    json("POST", { userId: viewer.user.id }),
  );
  const messageUrl = (channelId: string, messageId: string) =>
    `${base}/${channelId}/messages/${messageId}`;
  return {
    author,
    other,
    viewer,
    base,
    as,
    pub,
    priv,
    mine,
    secret,
    messageUrl,
  };
}

describe("API integration: chat message edit, delete and pin", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lets the author edit a message and marks it edited", async () => {
    const { author, other, base, as, pub, mine, messageUrl } = await setup();
    expect(mine.editedAt).toBeNull();

    const edited = await as(author)(
      messageUrl(pub.id, mine.id),
      json("PATCH", { body: "final text" }),
    );
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({
      id: mine.id,
      body: "final text",
      editedAt: expect.any(String),
    });

    const seen = await (await as(other)(`${base}/${pub.id}/messages`)).json();
    expect(seen).toEqual([
      expect.objectContaining({
        body: "final text",
        editedAt: expect.any(String),
      }),
    ]);
  });

  it("lets the author delete a message for everyone", async () => {
    const { author, other, base, as, pub, mine, messageUrl } = await setup();

    const deleted = await as(author)(
      messageUrl(pub.id, mine.id),
      json("DELETE"),
    );
    expect(deleted.status).toBe(200);
    expect(
      await (await as(other)(`${base}/${pub.id}/messages`)).json(),
    ).toEqual([]);
    const rows = await db
      .select()
      .from(chatMessageTable)
      .where(eq(chatMessageTable.id, mine.id));
    expect(rows).toEqual([]);
    expect(
      (await as(author)(messageUrl(pub.id, mine.id), json("DELETE"))).status,
    ).toBe(404);
  });

  it("refuses edits and deletes from anyone but the author", async () => {
    const { other, viewer, as, pub, mine, messageUrl } = await setup();

    for (const member of [other, viewer]) {
      const asMember = as(member);
      expect(
        (
          await asMember(
            messageUrl(pub.id, mine.id),
            json("PATCH", { body: "hijacked" }),
          )
        ).status,
      ).toBe(403);
      expect(
        (await asMember(messageUrl(pub.id, mine.id), json("DELETE"))).status,
      ).toBe(403);
    }
    const [row] = await db
      .select({ body: chatMessageTable.body })
      .from(chatMessageTable)
      .where(eq(chatMessageTable.id, mine.id));
    expect(row?.body).toBe("first draft");
  });

  it("hides private channel messages from non-members on every action", async () => {
    const { other, as, priv, secret, messageUrl, base } = await setup();
    const asOther = as(other);
    const url = messageUrl(priv.id, secret.id);

    for (const init of [
      json("PATCH", { body: "x" }),
      json("DELETE"),
      json("POST"),
    ]) {
      const path = init.method === "POST" ? `${url}/pin` : url;
      expect((await asOther(path, init)).status).toBe(404);
    }
    expect((await asOther(`${url}/pin`, json("DELETE"))).status).toBe(404);
    expect((await asOther(`${base}/${priv.id}/pins`)).status).toBe(404);
  });

  it("answers 404 for a message id under another channel", async () => {
    const { author, as, pub, secret, messageUrl } = await setup();
    const url = messageUrl(pub.id, secret.id);
    const asAuthor = as(author);

    expect((await asAuthor(url, json("PATCH", { body: "x" }))).status).toBe(
      404,
    );
    expect((await asAuthor(url, json("DELETE"))).status).toBe(404);
    expect((await asAuthor(`${url}/pin`, json("POST"))).status).toBe(404);
  });

  it("lets any channel member pin and unpin, and lists pins for every reader", async () => {
    const { author, other, viewer, base, as, pub, mine, messageUrl } =
      await setup();
    const pinUrl = `${messageUrl(pub.id, mine.id)}/pin`;

    const pinned = await as(other)(pinUrl, json("POST"));
    expect(pinned.status).toBe(200);
    expect(await pinned.json()).toMatchObject({
      id: mine.id,
      pinnedAt: expect.any(String),
      editedAt: null,
    });

    for (const member of [author, other, viewer]) {
      const pins = await (await as(member)(`${base}/${pub.id}/pins`)).json();
      expect(pins).toEqual([expect.objectContaining({ id: mine.id })]);
    }

    const unpinned = await as(author)(pinUrl, json("DELETE"));
    expect(unpinned.status).toBe(200);
    expect((await unpinned.json()).pinnedAt).toBeNull();
    expect(await (await as(other)(`${base}/${pub.id}/pins`)).json()).toEqual(
      [],
    );
  });

  it("keeps pinning to members who can write", async () => {
    const { viewer, other, base, as, pub, mine, messageUrl } = await setup();
    const pinUrl = `${messageUrl(pub.id, mine.id)}/pin`;

    expect((await as(viewer)(pinUrl, json("POST"))).status).toBe(403);
    await as(other)(`${base}/${pub.id}/leave`, json("POST"));
    expect((await as(other)(pinUrl, json("POST"))).status).toBe(403);
    expect(await (await as(other)(`${base}/${pub.id}/pins`)).json()).toEqual(
      [],
    );
  });
});
