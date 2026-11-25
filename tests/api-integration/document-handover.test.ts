import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

type Member = DocumentWorld["owner"];

const base = (world: DocumentWorld) => `/document/workspace/${world.ws}`;
const write = async (
  world: DocumentWorld,
  author: Member,
  title: string,
  parent: Record<string, string> = {},
) => {
  const response = await world.as(author)(
    "/document",
    json("POST", {
      workspaceId: world.ws,
      title,
      content: `<p>${title}</p>`,
      ...parent,
    }),
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { id: string }).id;
};
const opens = async (world: DocumentWorld, user: Member, id: string) =>
  (await world.as(user)(`${base(world)}/${id}`)).status;
const handOver = (
  world: DocumentWorld,
  user: Member,
  fromUserId: string,
  toUserId: string,
) =>
  world.as(user)(
    `${base(world)}/hand-over`,
    json("POST", { fromUserId, toUserId }),
  );
const ownerless = (world: DocumentWorld, user: Member) =>
  world.as(user)(`${base(world)}/ownerless`);
const takeOver = (world: DocumentWorld, user: Member, id: string) =>
  world.as(user)(`${base(world)}/${id}/take-over`, json("POST"));
const leave = (world: DocumentWorld, user: Member) =>
  db
    .delete(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, world.ws),
        eq(schema.workspaceUserTable.userId, user.id),
      ),
    );
const creatorOf = async (id: string) =>
  (
    await db
      .select({ creatorId: schema.documentTable.creatorId })
      .from(schema.documentTable)
      .where(eq(schema.documentTable.id, id))
  )[0]?.creatorId;
const audit = (action: string) =>
  db
    .select()
    .from(schema.adminAuditLogTable)
    .where(eq(schema.adminAuditLogTable.action, action));

describe("API integration: handing over a leaving member's drafts", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("moves a member's private documents to a colleague, and nothing else", async () => {
    const world = await buildDocumentWorld();
    const { owner, open, limited } = world;
    const first = await write(world, open, "Pricing notes");
    const second = await write(world, open, "Hiring notes");
    const inTeam = await write(world, open, "Team page", {
      projectId: world.alpha.id,
    });
    const colleagues = await write(world, limited, "My own notes");

    // The drafts of somebody who is still a member never change hands.
    const early = await handOver(world, owner, open.id, limited.id);
    expect(early.status).toBe(200);
    expect(await early.json()).toEqual({ moved: 0 });
    expect(await creatorOf(first)).toBe(open.id);
    expect(await opens(world, limited, first)).toBe(404);

    await leave(world, open);
    const response = await handOver(world, owner, open.id, limited.id);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ moved: 2 });

    for (const id of [first, second]) {
      expect(await opens(world, limited, id)).toBe(200);
      // The owner who moved them still cannot read them.
      expect(await opens(world, owner, id)).toBe(404);
      expect(await creatorOf(id)).toBe(limited.id);
    }
    expect(await creatorOf(inTeam)).toBe(open.id);
    expect(await creatorOf(colleagues)).toBe(limited.id);
    expect(await creatorOf(world.docs.private)).toBe(owner.id);

    const entries = await audit("document.handed_over");
    expect(entries.map((entry) => entry.targetId).sort()).toEqual(
      [first, second].sort(),
    );
    for (const entry of entries) {
      expect(entry.actorUserId).toBe(owner.id);
      expect(entry.targetType).toBe("document");
      // The log is read by instance administrators: no private title in it.
      expect(JSON.stringify(entry)).not.toContain("notes");
    }
  });

  it("is the owner's to do, and only towards a member", async () => {
    const world = await buildDocumentWorld();
    const { owner, open, limited } = world;
    const draft = await write(world, open, "Pricing notes");

    expect((await handOver(world, limited, open.id, limited.id)).status).toBe(
      403,
    );
    expect((await ownerless(world, limited)).status).toBe(403);
    expect((await takeOver(world, limited, draft)).status).toBe(403);

    // Somebody who left reads like somebody who never existed.
    await leave(world, limited);
    const gone = await handOver(world, owner, open.id, limited.id);
    const nobody = await handOver(world, owner, open.id, "nobody");
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual(await nobody.json());
    expect(nobody.status).toBe(404);
    expect(await creatorOf(draft)).toBe(open.id);
    expect(await audit("document.handed_over")).toEqual([]);
  });

  it("lists the drafts nobody can open once their author left", async () => {
    const world = await buildDocumentWorld();
    const { owner, open, limited } = world;
    const left = await write(world, open, "Left behind");
    await write(world, open, "Team page", { projectId: world.alpha.id });
    const kept = await write(world, limited, "Still mine");

    const before = await ownerless(world, owner);
    expect(before.status).toBe(200);
    expect(await before.json()).toEqual([]);

    await leave(world, open);
    const after = (await (await ownerless(world, owner)).json()) as Record<
      string,
      unknown
    >[];
    expect(after).toEqual([
      { id: left, title: "Left behind", updatedAt: expect.any(String) },
    ]);

    // A deleted account leaves its drafts with no author at all.
    await db
      .delete(schema.userTable)
      .where(eq(schema.userTable.id, limited.id));
    expect(await creatorOf(kept)).toBeNull();
    const titles = (
      (await (await ownerless(world, owner)).json()) as { title: string }[]
    ).map((doc) => doc.title);
    expect(titles.sort()).toEqual(["Left behind", "Still mine"]);
  });

  it("lets the owner take over a draft that has no author", async () => {
    const world = await buildDocumentWorld();
    const { owner, open, limited } = world;
    const left = await write(world, open, "Left behind");
    const inTeam = await write(world, open, "Team page", {
      projectId: world.alpha.id,
    });
    const kept = await write(world, limited, "Still mine");
    await leave(world, open);

    // A draft whose author is still here answers like one that does not exist.
    const unknown = await takeOver(world, owner, "nope");
    expect(unknown.status).toBe(404);
    for (const id of [kept, inTeam]) {
      const refused = await takeOver(world, owner, id);
      expect(refused.status).toBe(404);
      expect(await refused.clone().json()).toEqual(
        await unknown.clone().json(),
      );
    }
    expect(await creatorOf(kept)).toBe(limited.id);
    expect(await creatorOf(inTeam)).toBe(open.id);

    expect(await opens(world, owner, left)).toBe(404);
    const taken = await takeOver(world, owner, left);
    expect(taken.status).toBe(200);
    expect(await opens(world, owner, left)).toBe(200);
    expect(await creatorOf(left)).toBe(owner.id);
    expect(await (await ownerless(world, owner)).json()).toEqual([]);

    const entries = await audit("document.taken_over");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actorUserId: owner.id,
      targetType: "document",
      targetId: left,
    });
    expect(JSON.stringify(entries[0])).not.toContain("Left behind");
  });
});
