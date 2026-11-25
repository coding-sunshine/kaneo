import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";
import { createWorkspaceMember } from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

type Member = DocumentWorld["owner"];
type Week = {
  from: string;
  to: string;
  added: number;
  filed: number;
  chatSaves: number;
};
type Usage = { topicsWithCurrent: number; weeks: Week[] };

const DAY = 24 * 60 * 60 * 1000;
const path = (ws: string) => `/document/workspace/${ws}/usage`;

const ask = (world: DocumentWorld, user: Member) =>
  world.as(user)(path(world.ws));
const read = async (world: DocumentWorld) => {
  const response = await ask(world, world.owner);
  expect(response.status).toBe(200);
  return (await response.json()) as Usage;
};
const write = async (world: DocumentWorld, author: Member, title: string) => {
  const response = await world.as(author)(
    "/document",
    json("POST", { workspaceId: world.ws, title, content: `<p>${title}</p>` }),
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { id: string }).id;
};
const saveFromChat = async (
  world: DocumentWorld,
  author: Member,
  title: string,
) => {
  const response = await world.as(author)(
    "/document/file",
    json("POST", {
      workspaceId: world.ws,
      title,
      markdown: `${title}, as an assistant wrote it.`,
      idempotencyKey: title,
    }),
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { id: string }).id;
};
// A topic with `documentId` filed on it, and made current when asked.
const fileOnTopic = async (
  world: DocumentWorld,
  documentId: string,
  current: boolean,
) => {
  const { owner, ws } = world;
  const made = await world.as(owner)(
    "/topic",
    json("POST", { workspaceId: ws, name: `Topic of ${documentId}` }),
  );
  expect(made.status).toBe(200);
  const topic = (await made.json()) as { id: string };
  const at = `/topic/workspace/${ws}/${topic.id}/document/${documentId}`;
  expect((await world.as(owner)(at, json("PUT"))).status).toBe(200);
  if (current) {
    const decided = await world.as(owner)(
      `${at}/current`,
      json("POST", { reason: "Starting point" }),
    );
    expect(decided.status).toBe(200);
  }
};
const addedAt = (id: string, daysAgo: number) =>
  db
    .update(schema.documentTable)
    .set({ createdAt: new Date(Date.now() - daysAgo * DAY) })
    .where(eq(schema.documentTable.id, id));

describe("API integration: the usage numbers of documents", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("counts every document, also the ones the owner cannot open", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;
    const before = await read(world);

    // Private documents of two other members: the owner cannot open them.
    await write(world, limited, "Venue shortlist");
    await saveFromChat(world, open, "Catering notes");
    const filed = await write(world, owner, "Launch plan");
    const proposal = await write(world, owner, "Launch plan, second draft");
    await fileOnTopic(world, filed, true);
    await fileOnTopic(world, proposal, false);

    const after = await read(world);
    expect(after.weeks[0]).toMatchObject({
      added: before.weeks[0].added + 4,
      filed: before.weeks[0].filed + 2,
      chatSaves: before.weeks[0].chatSaves + 1,
    });
    expect(after.topicsWithCurrent).toBe(before.topicsWithCurrent + 1);
  });

  it("returns numbers and dates only: no title, topic or person", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited } = world;
    const id = await write(world, limited, "Venue shortlist");
    await fileOnTopic(world, await write(world, owner, "Launch plan"), true);

    const response = await ask(world, owner);
    const text = await response.text();
    const body = JSON.parse(text) as Usage;

    expect(Object.keys(body).sort()).toEqual(["topicsWithCurrent", "weeks"]);
    expect(body.weeks).toHaveLength(4);
    for (const week of body.weeks) {
      expect(Object.keys(week).sort()).toEqual([
        "added",
        "chatSaves",
        "filed",
        "from",
        "to",
      ]);
    }
    for (const hidden of ["Venue", "Launch", "Topic of", id, limited.id]) {
      expect(text).not.toContain(hidden);
    }
  });

  it("puts a document in the week it was added, four weeks back", async () => {
    const world = await buildDocumentWorld();
    const { owner } = world;
    const lastWeek = await write(world, owner, "Added ten days ago");
    const old = await write(world, owner, "Added thirty days ago");
    const before = await read(world);

    await addedAt(lastWeek, 10);
    await addedAt(old, 30);

    const after = await read(world);
    expect(after.weeks[0].added).toBe(before.weeks[0].added - 2);
    expect(after.weeks[1].added).toBe(before.weeks[1].added + 1);
    expect(after.weeks[2].added).toBe(before.weeks[2].added);
    expect(after.weeks[3].added).toBe(before.weeks[3].added);
    // Each week ends where the one after it starts.
    expect(after.weeks[1].to).toBe(after.weeks[0].from);
    expect(
      new Date(after.weeks[0].to).getTime() -
        new Date(after.weeks[0].from).getTime(),
    ).toBe(7 * DAY);
  });

  it("counts a document dated ahead of this clock in the current week", async () => {
    const world = await buildDocumentWorld();
    const { owner } = world;
    const before = await read(world);
    // The database clock can run ahead of the API's by a few milliseconds.
    const ahead = await write(world, owner, "Added a moment from now");
    await addedAt(ahead, -1 / 24);

    const after = await read(world);
    expect(after.weeks[0].added).toBe(before.weeks[0].added + 1);
  });

  it("leaves out a document in the trash", async () => {
    const world = await buildDocumentWorld();
    const { owner, ws } = world;
    const id = await saveFromChat(world, owner, "Catering notes");
    const before = await read(world);

    const deleted = await world.as(owner)(
      `/document/workspace/${ws}/${id}`,
      json("DELETE"),
    );
    expect(deleted.status).toBe(200);

    const after = await read(world);
    expect(after.weeks[0].added).toBe(before.weeks[0].added - 1);
    expect(after.weeks[0].chatSaves).toBe(before.weeks[0].chatSaves - 1);
  });

  it("answers 403 to every member who is not an owner", async () => {
    const world = await buildDocumentWorld();
    const viewer = await addWorkspaceMember(world.ws, "viewer");
    const admin = await addWorkspaceMember(world.ws, "admin");

    for (const user of [world.limited, world.open, viewer, admin]) {
      const response = await ask(world, user);
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain("weeks");
    }
  });

  it("keeps workspaces apart", async () => {
    const world = await buildDocumentWorld();
    const { user: outsider, workspace: other } = await createWorkspaceMember({
      role: "owner",
    });

    // The owner of another workspace gets what any other owner-only route
    // of this workspace gives them.
    const refused = await world.as(outsider)(path(world.ws));
    const sameAs = await world.as(outsider)(
      `/document/workspace/${world.ws}/ownerless`,
    );
    expect(refused.status).not.toBe(200);
    expect(refused.status).toBe(sameAs.status);
    expect(await refused.text()).not.toContain("weeks");

    // Their own workspace counts none of this workspace's documents.
    mockAuthenticatedSession(outsider);
    const own = await world.as(outsider)(path(other.id));
    expect(own.status).toBe(200);
    const body = (await own.json()) as Usage;
    expect(body.topicsWithCurrent).toBe(0);
    expect(body.weeks.map((week) => week.added)).toEqual([0, 0, 0, 0]);
  });
});
