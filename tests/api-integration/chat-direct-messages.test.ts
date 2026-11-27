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

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const [a, b, c, d, viewer] = await Promise.all(
    Array.from({ length: 5 }, () => createWorkspaceMember()),
  );
  const outsider = await createWorkspaceMember();
  const ws = owner.workspace.id;
  for (const [member, role] of [
    [a, "member"],
    [b, "member"],
    [c, "member"],
    [d, "member"],
    [viewer, "viewer"],
  ] as const)
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.user.id,
      role,
      joinedAt: new Date(),
    });
  const { app } = createApp();
  const dms = `/api/chat/workspace/${ws}/direct-messages`;
  const channels = `/api/chat/workspace/${ws}/channels`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const open = async (member: Seeded, others: Seeded[]) => {
    const response = await as(member)(
      dms,
      json("POST", { userIds: others.map((other) => other.user.id) }),
    );
    expect(response.status).toBe(200);
    return (await response.json()) as { id: string; memberIds: string[] };
  };
  const post = async (member: Seeded, channelId: string, body: string) =>
    (
      await as(member)(
        `${channels}/${channelId}/messages`,
        json("POST", { body }),
      )
    ).status;
  const read = async (member: Seeded, channelId: string) => {
    const response = await as(member)(`${channels}/${channelId}/messages`);
    return response.status === 200
      ? ((await response.json()) as { body: string }[]).map((m) => m.body)
      : response.status;
  };
  const listIds = async (member: Seeded) =>
    ((await (await as(member)(dms)).json()) as { id: string }[]).map(
      (dm) => dm.id,
    );
  return {
    owner,
    a,
    b,
    c,
    d,
    viewer,
    outsider,
    ws,
    dms,
    channels,
    as,
    open,
    post,
    read,
    listIds,
  };
}

describe("API integration: chat direct messages", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("shows a direct message only to its two people", async () => {
    const { owner, a, b, c, channels, as, open, post, read, listIds } =
      await setup();
    const dm = await open(a, [b]);
    expect(new Set(dm.memberIds)).toEqual(new Set([a.user.id, b.user.id]));
    expect(await post(a, dm.id, "just between us")).toBe(200);

    expect(await read(b, dm.id)).toEqual(["just between us"]);
    expect(await listIds(b)).toEqual([dm.id]);
    expect(await post(b, dm.id, "agreed")).toBe(200);

    for (const stranger of [c, owner]) {
      expect(await read(stranger, dm.id)).toBe(404);
      expect(await post(stranger, dm.id, "hi")).toBe(404);
      expect((await as(stranger)(`${channels}/${dm.id}`)).status).toBe(404);
      expect(
        (await as(stranger)(`${channels}/${dm.id}/join`, json("POST"))).status,
      ).toBe(404);
      expect(await listIds(stranger)).toEqual([]);
    }
  });

  it("keeps direct messages out of the channel directory", async () => {
    const { a, b, channels, as, open } = await setup();
    await open(a, [b]);
    for (const member of [a, b])
      expect(await (await as(member)(channels)).json()).toEqual([]);
  });

  it("shows a group direct message to its members and nobody else, not even through search", async () => {
    const { owner, a, b, c, d, ws, open, post, read, listIds, as } =
      await setup();
    const group = await open(a, [b, c]);
    expect(await post(a, group.id, "groupsecretword")).toBe(200);

    for (const member of [b, c]) {
      expect(await read(member, group.id)).toEqual(["groupsecretword"]);
      expect(await listIds(member)).toEqual([group.id]);
    }
    for (const stranger of [d, owner]) {
      expect(await read(stranger, group.id)).toBe(404);
      expect(await listIds(stranger)).toEqual([]);
      const search = await as(stranger)(
        `/api/search?${new URLSearchParams({ q: "groupsecretword", workspaceId: ws })}`,
      );
      expect(search.status).toBe(200);
      const { results } = (await search.json()) as { results: unknown[] };
      expect(JSON.stringify(results)).not.toContain("groupsecretword");
    }
  });

  it("reopens an existing direct message instead of making a second one", async () => {
    const { a, b, c, open, listIds } = await setup();
    const first = await open(a, [b]);
    expect((await open(a, [b])).id).toBe(first.id);
    expect((await open(b, [a])).id).toBe(first.id);

    const group = await open(a, [b, c]);
    expect(group.id).not.toBe(first.id);
    expect((await open(c, [b, a])).id).toBe(group.id);
    expect((await open(b, [c, a, c])).id).toBe(group.id);

    expect(new Set(await listIds(a))).toEqual(new Set([first.id, group.id]));
  });

  it("keeps the members of a direct message fixed", async () => {
    const { a, b, d, channels, as, open, read } = await setup();
    const dm = await open(a, [b]);
    const asA = as(a);

    for (const [method, path, body] of [
      ["POST", `${channels}/${dm.id}/members`, { userId: d.user.id }],
      ["POST", `${channels}/${dm.id}/leave`, undefined],
      ["PATCH", `${channels}/${dm.id}`, { name: "renamed" }],
      ["PATCH", `${channels}/${dm.id}`, { archived: true }],
    ] as const)
      expect((await asA(path, json(method, body))).status).toBe(403);

    expect(await read(d, dm.id)).toBe(404);
    expect(await read(a, dm.id)).toEqual([]);
  });

  it("only opens direct messages with members of the workspace", async () => {
    const { a, outsider, dms, as } = await setup();
    const asA = as(a);
    expect(
      (await asA(dms, json("POST", { userIds: [outsider.user.id] }))).status,
    ).toBe(404);
    expect(
      (await asA(dms, json("POST", { userIds: [a.user.id] }))).status,
    ).toBe(400);
    expect((await asA(dms, json("POST", { userIds: [] }))).status).toBe(400);
    expect(await (await asA(dms)).json()).toEqual([]);
  });

  it("keeps viewers and people outside the workspace from opening one", async () => {
    const { a, viewer, outsider, dms, as } = await setup();
    expect(
      (await as(viewer)(dms, json("POST", { userIds: [a.user.id] }))).status,
    ).toBe(403);
    const asOutsider = as(outsider);
    expect(
      (await asOutsider(dms, json("POST", { userIds: [a.user.id] }))).status,
    ).toBe(404);
    expect((await asOutsider(dms)).status).toBe(404);
  });
});
