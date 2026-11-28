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
  const a = await createWorkspaceMember({ role: "owner" });
  const b = await createWorkspaceMember();
  const outsider = await createWorkspaceMember();
  const ws = a.workspace.id;
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: ws,
    userId: b.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  const { app } = createApp();
  const base = `/api/chat/workspace/${ws}`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const create = async (name: string, isPrivate = false) =>
    (await as(a)(`${base}/channels`, json("POST", { name, isPrivate }))).json();
  const general = await create("general");
  const random = await create("random");
  const leads = await create("leads", true);
  await as(b)(`${base}/channels/${general.id}/join`, json("POST"));
  const save = (member: Seeded, channelId: string, body: string) =>
    as(member)(`${base}/channels/${channelId}/draft`, json("PUT", { body }));
  const drafts = async (member: Seeded) =>
    (await as(member)(`${base}/drafts`)).json();
  return { a, b, outsider, ws, base, as, general, random, leads, save, drafts };
}

describe("API integration: chat drafts", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("keeps one draft per channel for its author", async () => {
    const { a, general, random, save, drafts } = await setup();
    expect((await save(a, general.id, "half written")).status).toBe(200);
    await save(a, random.id, "other");
    await save(a, general.id, "half written, more");

    const list = await drafts(a);
    expect(
      list
        .map((d: { channelId: string; body: string }) => [d.channelId, d.body])
        .sort(),
    ).toEqual(
      [
        [general.id, "half written, more"],
        [random.id, "other"],
      ].sort(),
    );
  });

  it("never shows a draft to anyone but its author", async () => {
    const { a, b, outsider, general, save, drafts, as, base } = await setup();
    await save(a, general.id, "secret plan");
    await save(b, general.id, "b's own");

    expect(await drafts(b)).toEqual([
      expect.objectContaining({ channelId: general.id, body: "b's own" }),
    ]);
    const outsiderList = await as(outsider)(
      `/api/chat/workspace/${outsider.workspace.id}/drafts`,
    );
    expect(JSON.stringify(await outsiderList.json())).not.toContain(
      "secret plan",
    );
    // Another workspace's member cannot read this workspace's drafts at all.
    expect((await as(outsider)(`${base}/drafts`)).status).toBe(404);
    // Nor do messages or channels carry the draft.
    const messages = await as(b)(`${base}/channels/${general.id}/messages`);
    expect(JSON.stringify(await messages.json())).not.toContain("secret plan");
  });

  it("clears the draft when its author sends the message", async () => {
    const { a, b, general, save, drafts, as, base } = await setup();
    await save(a, general.id, "almost");
    await save(b, general.id, "b keeps this");

    await as(a)(
      `${base}/channels/${general.id}/messages`,
      json("POST", { body: "almost done" }),
    );

    expect(await drafts(a)).toEqual([]);
    expect(await drafts(b)).toHaveLength(1);
  });

  it("deletes the draft when saved empty", async () => {
    const { a, general, save, drafts } = await setup();
    await save(a, general.id, "x");
    expect((await save(a, general.id, "")).status).toBe(200);
    expect(await drafts(a)).toEqual([]);
  });

  it("saves drafts only where the caller may post", async () => {
    const { a, b, outsider, general, random, leads, save } = await setup();
    // A private channel answers like a missing one to non-members.
    expect((await save(b, leads.id, "x")).status).toBe(404);
    // A public channel needs joining first.
    expect((await save(b, random.id, "x")).status).toBe(403);
    // A channel id from another workspace is not found.
    expect((await save(outsider, general.id, "x")).status).toBe(404);
    expect((await save(a, leads.id, "ok")).status).toBe(200);
  });

  it("stops listing a draft once its private channel is closed to the author", async () => {
    const { a, b, leads, save, drafts, as, base } = await setup();
    await as(a)(
      `${base}/channels/${leads.id}/members`,
      json("POST", { userId: b.user.id }),
    );
    await save(b, leads.id, "for leads only");
    expect(await drafts(b)).toHaveLength(1);

    await as(a)(`${base}/channels/${leads.id}/members/${b.user.id}`, {
      method: "DELETE",
    });

    expect(await drafts(b)).toEqual([]);
  });

  it("stops listing a guest's draft once the guest leaves the channel", async () => {
    const { a, ws, general, save, drafts, as, base } = await setup();
    const guest = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: guest.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId: ws,
      userId: guest.user.id,
      projectAccess: "selected",
      guest: true,
    });
    await as(a)(
      `${base}/channels/${general.id}/members`,
      json("POST", { userId: guest.user.id }),
    );
    expect((await save(guest, general.id, "guest note")).status).toBe(200);
    expect(await drafts(guest)).toHaveLength(1);

    await as(guest)(`${base}/channels/${general.id}/leave`, json("POST"));

    // A member who left a public channel can still read it; a guest cannot.
    expect(await drafts(guest)).toEqual([]);
  });
});
