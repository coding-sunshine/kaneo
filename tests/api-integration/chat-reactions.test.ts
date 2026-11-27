import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { chatMessageReactionTable } from "../../apps/api/src/database/schema";
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
  const viewer = await createWorkspaceMember();
  const ws = a.workspace.id;
  for (const [member, role] of [
    [b, "member"],
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
  const create = async (name: string, isPrivate = false) =>
    (await as(a)(base, json("POST", { name, isPrivate }))).json();
  const pub = await create("general");
  const priv = await create("leads", true);
  const post = async (channelId: string) =>
    (
      await as(a)(`${base}/${channelId}/messages`, json("POST", { body: "hi" }))
    ).json();
  const message = await post(pub.id);
  const secret = await post(priv.id);
  await as(b)(`${base}/${pub.id}/join`, json("POST"));
  const reactions = (channelId: string, messageId: string) =>
    `${base}/${channelId}/messages/${messageId}/reactions`;
  const list = async (member: Seeded, channelId = pub.id) =>
    (await as(member)(`${base}/${channelId}/messages`)).json();
  return { a, b, viewer, ws, as, pub, priv, message, secret, reactions, list };
}

describe("API integration: chat reactions", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("counts a reaction from two users and drops one when it is taken back", async () => {
    const { a, b, as, pub, message, reactions, list } = await setup();
    const url = reactions(pub.id, message.id);

    for (const member of [a, b])
      expect(
        (await as(member)(url, json("POST", { emoji: "👍" }))).status,
      ).toBe(200);
    // Adding the same reaction twice is a no-op.
    await as(a)(url, json("POST", { emoji: "👍" }));
    expect((await list(b))[0].reactions).toEqual([
      { emoji: "👍", userIds: [a.user.id, b.user.id] },
    ]);

    expect((await as(a)(url, json("DELETE", { emoji: "👍" }))).status).toBe(
      200,
    );
    expect((await list(a))[0].reactions).toEqual([
      { emoji: "👍", userIds: [b.user.id] },
    ]);
  });

  it("accepts a workspace custom emoji and refuses an unknown one", async () => {
    const { a, ws, as, pub, message, reactions, list } = await setup();
    const url = reactions(pub.id, message.id);

    expect(
      (await as(a)(url, json("POST", { emoji: ":party_parrot:" }))).status,
    ).toBe(400);
    await db.insert(schema.workspaceEmojiTable).values({
      workspaceId: ws,
      name: "party_parrot",
      objectKey: "workspace/x/emoji/emoji-v1",
      mimeType: "image/png",
      version: "v1",
      createdBy: a.user.id,
    });
    expect(
      (await as(a)(url, json("POST", { emoji: ":party_parrot:" }))).status,
    ).toBe(200);
    expect((await list(a))[0].reactions).toEqual([
      { emoji: ":party_parrot:", userIds: [a.user.id] },
    ]);
  });

  it("refuses a custom emoji from another workspace", async () => {
    const { a, b, as, pub, message, reactions } = await setup();
    await db.insert(schema.workspaceEmojiTable).values({
      workspaceId: b.workspace.id,
      name: "elsewhere",
      objectKey: "workspace/y/emoji/emoji-v1",
      mimeType: "image/png",
      version: "v1",
      createdBy: b.user.id,
    });
    expect(
      (
        await as(a)(
          reactions(pub.id, message.id),
          json("POST", { emoji: ":elsewhere:" }),
        )
      ).status,
    ).toBe(400);
  });

  it("keeps reactions to members who can write and hides private messages", async () => {
    const { a, b, viewer, as, pub, priv, message, secret, reactions } =
      await setup();

    expect(
      (
        await as(viewer)(
          reactions(pub.id, message.id),
          json("POST", { emoji: "👍" }),
        )
      ).status,
    ).toBe(403);
    await as(b)(
      `/api/chat/workspace/${a.workspace.id}/channels/${pub.id}/leave`,
      json("POST"),
    );
    expect(
      (
        await as(b)(
          reactions(pub.id, message.id),
          json("POST", { emoji: "👍" }),
        )
      ).status,
    ).toBe(403);
    for (const method of ["POST", "DELETE"])
      expect(
        (
          await as(b)(
            reactions(priv.id, secret.id),
            json(method, { emoji: "👍" }),
          )
        ).status,
      ).toBe(404);
    // A message id under the wrong channel is missing too.
    expect(
      (await as(a)(reactions(pub.id, secret.id), json("POST", { emoji: "👍" })))
        .status,
    ).toBe(404);
  });

  it("removes a message's reactions with the message", async () => {
    const { a, as, pub, message, reactions } = await setup();
    const url = reactions(pub.id, message.id);
    await as(a)(url, json("POST", { emoji: "👍" }));
    expect(
      (await as(a)(url.replace("/reactions", ""), json("DELETE"))).status,
    ).toBe(200);
    expect(await db.select().from(chatMessageReactionTable)).toEqual([]);
  });
});
