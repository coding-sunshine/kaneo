import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
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

async function addToWorkspace(
  workspaceId: string,
  member: Seeded,
  role = "member",
) {
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: member.user.id,
    role,
    joinedAt: new Date(),
  });
}

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const teammate = await createWorkspaceMember();
  const outsider = await createWorkspaceMember();
  const viewer = await createWorkspaceMember();
  const ws = owner.workspace.id;
  await addToWorkspace(ws, teammate);
  await addToWorkspace(ws, viewer, "viewer");
  const { app } = createApp();
  const base = `/api/chat/workspace/${ws}/channels`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };

  const asOwner = as(owner);
  const pub = await (
    await asOwner(base, json("POST", { name: "general" }))
  ).json();
  const priv = await (
    await asOwner(base, json("POST", { name: "leads", isPrivate: true }))
  ).json();
  for (const channel of [pub, priv])
    expect(
      (
        await asOwner(
          `${base}/${channel.id}/messages`,
          json("POST", { body: `hello ${channel.name}` }),
        )
      ).status,
    ).toBe(200);

  return { owner, teammate, outsider, viewer, ws, base, as, pub, priv };
}

describe("API integration: chat channels", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lists public channels to every member and private ones to members only", async () => {
    const { owner, teammate, base, as, pub, priv } = await setup();

    const ownerList = await (await as(owner)(base)).json();
    expect(ownerList.map((c: { name: string }) => c.name)).toEqual([
      "general",
      "leads",
    ]);

    const asTeammate = as(teammate);
    const teammateList = await (await asTeammate(base)).json();
    expect(teammateList).toEqual([
      expect.objectContaining({ id: pub.id, isMember: false }),
    ]);

    for (const path of [`${base}/${priv.id}`, `${base}/${priv.id}/messages`])
      expect((await asTeammate(path)).status).toBe(404);
    for (const [path, body] of [
      [`${base}/${priv.id}/join`, undefined],
      [`${base}/${priv.id}/leave`, undefined],
      [`${base}/${priv.id}/messages`, { body: "hi" }],
      [`${base}/${priv.id}/members`, { userId: teammate.user.id }],
    ] as const)
      expect((await asTeammate(path, json("POST", body))).status).toBe(404);
    expect(
      (await asTeammate(`${base}/${priv.id}`, json("PATCH", { topic: "x" })))
        .status,
    ).toBe(404);
  });

  it("lets a member join a public channel before posting in it", async () => {
    const { teammate, base, as, pub } = await setup();
    const asTeammate = as(teammate);

    const messages = await (
      await asTeammate(`${base}/${pub.id}/messages`)
    ).json();
    expect(messages).toEqual([
      expect.objectContaining({ body: "hello general" }),
    ]);
    const post = () =>
      asTeammate(`${base}/${pub.id}/messages`, json("POST", { body: "hi" }));
    expect((await post()).status).toBe(403);
    expect(
      (await asTeammate(`${base}/${pub.id}`, json("PATCH", { topic: "x" })))
        .status,
    ).toBe(403);

    const joined = await asTeammate(`${base}/${pub.id}/join`, json("POST"));
    expect(joined.status).toBe(200);
    expect((await joined.json()).isMember).toBe(true);
    expect(
      (await asTeammate(`${base}/${pub.id}/join`, json("POST"))).status,
    ).toBe(200);
    expect((await post()).status).toBe(200);

    const left = await asTeammate(`${base}/${pub.id}/leave`, json("POST"));
    expect(left.status).toBe(200);
    expect((await post()).status).toBe(403);
  });

  it("shows a private channel once a member invites you", async () => {
    const { owner, teammate, outsider, base, as, priv } = await setup();

    expect(
      (
        await as(owner)(
          `${base}/${priv.id}/members`,
          json("POST", { userId: outsider.user.id }),
        )
      ).status,
    ).toBe(404);
    const invited = await as(owner)(
      `${base}/${priv.id}/members`,
      json("POST", { userId: teammate.user.id }),
    );
    expect(invited.status).toBe(200);
    expect((await invited.json()).memberIds).toContain(teammate.user.id);

    const asTeammate = as(teammate);
    const list = await (await asTeammate(base)).json();
    expect(list.map((c: { id: string }) => c.id)).toContain(priv.id);
    expect((await asTeammate(`${base}/${priv.id}/messages`)).status).toBe(200);
  });

  it("sets a topic and archives a channel while keeping its history readable", async () => {
    const { owner, teammate, base, as, pub } = await setup();
    const asOwner = as(owner);

    const topic = await asOwner(
      `${base}/${pub.id}`,
      json("PATCH", { topic: "Daily standup notes" }),
    );
    expect((await topic.json()).topic).toBe("Daily standup notes");

    const archived = await asOwner(
      `${base}/${pub.id}`,
      json("PATCH", { archived: true }),
    );
    expect((await archived.json()).archivedAt).not.toBeNull();
    expect(
      (
        await asOwner(
          `${base}/${pub.id}/messages`,
          json("POST", { body: "late" }),
        )
      ).status,
    ).toBe(409);
    expect(
      await (await asOwner(`${base}/${pub.id}/messages`)).json(),
    ).toHaveLength(1);

    const asTeammate = as(teammate);
    expect(
      (await asTeammate(`${base}/${pub.id}/join`, json("POST"))).status,
    ).toBe(409);
    expect((await asTeammate(`${base}/${pub.id}/messages`)).status).toBe(200);

    const restored = await as(owner)(
      `${base}/${pub.id}`,
      json("PATCH", { archived: false }),
    );
    expect((await restored.json()).archivedAt).toBeNull();
  });

  it("gives a user outside the workspace no channel at all", async () => {
    const { outsider, base, as, pub, priv } = await setup();
    const asOutsider = as(outsider);

    expect((await asOutsider(base)).status).toBe(404);
    expect(
      (await asOutsider(base, json("POST", { name: "sneaky" }))).status,
    ).toBe(404);
    for (const channel of [pub, priv]) {
      expect((await asOutsider(`${base}/${channel.id}`)).status).toBe(404);
      expect((await asOutsider(`${base}/${channel.id}/messages`)).status).toBe(
        404,
      );
      expect(
        (await asOutsider(`${base}/${channel.id}/join`, json("POST"))).status,
      ).toBe(404);
    }
  });

  it("answers 404 for a channel id from another workspace", async () => {
    const { outsider, as, pub } = await setup();
    const foreignBase = `/api/chat/workspace/${outsider.workspace.id}/channels`;
    const asOutsider = as(outsider);

    expect((await asOutsider(`${foreignBase}/${pub.id}`)).status).toBe(404);
    expect((await asOutsider(`${foreignBase}/${pub.id}/messages`)).status).toBe(
      404,
    );
    expect(
      (await asOutsider(`${foreignBase}/${pub.id}/join`, json("POST"))).status,
    ).toBe(404);
  });

  it("lets a viewer read channels but not write to them", async () => {
    const { owner, viewer, base, as, pub } = await setup();
    await as(owner)(
      `${base}/${pub.id}/members`,
      json("POST", { userId: viewer.user.id }),
    );
    const asViewer = as(viewer);

    expect((await asViewer(base)).status).toBe(200);
    expect((await asViewer(`${base}/${pub.id}/messages`)).status).toBe(200);
    for (const [method, path, body] of [
      ["POST", base, { name: "viewer-room" }],
      ["PATCH", `${base}/${pub.id}`, { topic: "x" }],
      ["PATCH", `${base}/${pub.id}`, { archived: true }],
      ["POST", `${base}/${pub.id}/join`, undefined],
      ["POST", `${base}/${pub.id}/leave`, undefined],
      ["POST", `${base}/${pub.id}/members`, { userId: owner.user.id }],
      ["POST", `${base}/${pub.id}/messages`, { body: "hi" }],
    ] as const)
      expect((await asViewer(path, json(method, body))).status).toBe(403);
  });

  it("keeps adding members and archiving to channel members", async () => {
    const { owner, teammate, base, as, pub } = await setup();
    const asTeammate = as(teammate);

    expect(
      (
        await asTeammate(
          `${base}/${pub.id}/members`,
          json("POST", { userId: owner.user.id }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await asTeammate(`${base}/${pub.id}`, json("PATCH", { archived: true })))
        .status,
    ).toBe(403);
    const channel = await (await as(owner)(`${base}/${pub.id}`)).json();
    expect(channel.archivedAt).toBeNull();
  });

  it("refuses to add a member to an archived channel", async () => {
    const { owner, teammate, base, as, pub } = await setup();
    const asOwner = as(owner);
    await asOwner(`${base}/${pub.id}`, json("PATCH", { archived: true }));

    expect(
      (
        await asOwner(
          `${base}/${pub.id}/members`,
          json("POST", { userId: teammate.user.id }),
        )
      ).status,
    ).toBe(409);
  });

  it("refuses writes to a channel through another workspace's URL", async () => {
    const { owner, outsider, as, pub, priv } = await setup();
    // The outsider owns their own workspace, so the workspace check passes and
    // only the channel lookup can refuse.
    const foreignBase = `/api/chat/workspace/${outsider.workspace.id}/channels`;
    const asOutsider = as(outsider);

    for (const channel of [pub, priv])
      for (const [method, path, body] of [
        ["POST", `${foreignBase}/${channel.id}/messages`, { body: "hi" }],
        ["PATCH", `${foreignBase}/${channel.id}`, { archived: true }],
        [
          "POST",
          `${foreignBase}/${channel.id}/members`,
          { userId: outsider.user.id },
        ],
      ] as const)
        expect((await asOutsider(path, json(method, body))).status).toBe(404);

    const messages = await (
      await as(owner)(
        `/api/chat/workspace/${owner.workspace.id}/channels/${pub.id}/messages`,
      )
    ).json();
    expect(messages).toHaveLength(1);
  });

  it("keeps the last member of a private channel from leaving", async () => {
    const { owner, teammate, base, as, priv } = await setup();
    const asOwner = as(owner);
    const leave = () => asOwner(`${base}/${priv.id}/leave`, json("POST"));

    expect((await leave()).status).toBe(409);
    expect((await asOwner(`${base}/${priv.id}`)).status).toBe(200);

    await asOwner(
      `${base}/${priv.id}/members`,
      json("POST", { userId: teammate.user.id }),
    );
    expect((await leave()).status).toBe(200);
    expect(
      (await as(teammate)(`${base}/${priv.id}/leave`, json("POST"))).status,
    ).toBe(409);
  });
});
