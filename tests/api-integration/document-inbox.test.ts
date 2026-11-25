import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentPlace,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

type Member = DocumentWorld["owner"];
type Row = { id: string; snoozedUntil: string | null; updatedAt: string };

// Documents in a shared place, as each member sees them.
const SHARED: Record<"owner" | "limited" | "open", DocumentPlace[]> = {
  owner: [
    "teamAlpha",
    "teamBeta",
    "issueAlpha",
    "issueBeta",
    "project",
    "projectAlpha",
    "projectBeta",
    "workspace",
    "sharedInBeta",
    "sharedInProjectBeta",
  ],
  limited: [
    "teamAlpha",
    "issueAlpha",
    "project",
    "projectAlpha",
    "workspace",
    "sharedInBeta",
    "sharedInProjectBeta",
  ],
  open: [
    "teamAlpha",
    "teamBeta",
    "issueAlpha",
    "issueBeta",
    "project",
    "projectAlpha",
    "projectBeta",
    "workspace",
    "sharedInBeta",
    "sharedInProjectBeta",
  ],
};

const base = (world: DocumentWorld) => `/document/workspace/${world.ws}`;
const list = async (world: DocumentWorld, user: Member, filter: string) => {
  const response = await world.as(user)(`${base(world)}?filter=${filter}`);
  expect(response.status).toBe(200);
  return (await response.json()) as Row[];
};
const listed = async (world: DocumentWorld, user: Member, filter: string) =>
  (await list(world, user, filter)).map((row) => row.id).sort();
const ids = (world: DocumentWorld, places: DocumentPlace[]) =>
  places.map((place) => world.docs[place]).sort();
const write = async (world: DocumentWorld, author: Member, title: string) => {
  const response = await world.as(author)(
    "/document",
    json("POST", { workspaceId: world.ws, title, content: `<p>${title}</p>` }),
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { id: string }).id;
};
// A topic in team Alpha with one document filed on it.
const fileOnTopic = async (world: DocumentWorld, documentId: string) => {
  const topic = await world.as(world.owner)(
    "/topic",
    json("POST", {
      workspaceId: world.ws,
      name: "Launch plan",
      projectId: world.alpha.id,
    }),
  );
  expect(topic.status).toBe(200);
  const { id } = (await topic.json()) as { id: string };
  const filed = await world.as(world.owner)(
    `/topic/workspace/${world.ws}/${id}/document/${documentId}`,
    json("PUT"),
  );
  expect(filed.status).toBe(200);
};
const snooze = (
  world: DocumentWorld,
  user: Member,
  id: string,
  until: unknown,
) => world.as(user)(`${base(world)}/${id}/snooze`, json("POST", { until }));
const row = async (world: DocumentWorld, user: Member, id: string) =>
  (await list(world, user, "inbox")).find((doc) => doc.id === id);

const NEXT_YEAR = new Date(Date.now() + 365 * 86_400_000).toISOString();

describe("API integration: Not yet filed and the document Inbox", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lists under Not yet filed the private drafts a person can open", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;

    expect(await listed(world, owner, "unfiled")).toEqual(
      ids(world, ["private", "sharedByName"]),
    );
    // A draft shared by name is not yet filed for the person it names too.
    expect(await listed(world, limited, "unfiled")).toEqual(
      ids(world, ["sharedByName"]),
    );
    expect(await listed(world, open, "unfiled")).toEqual([]);

    const mine = await write(world, open, "My notes");
    expect(await listed(world, open, "unfiled")).toEqual([mine]);
    expect(await listed(world, owner, "unfiled")).not.toContain(mine);

    // Filing is the step where a draft stops being private.
    await fileOnTopic(world, world.docs.private);
    expect(await listed(world, owner, "unfiled")).toEqual(
      ids(world, ["sharedByName"]),
    );
    expect(await listed(world, owner, "inbox")).not.toContain(
      world.docs.private,
    );
  });

  it("lists in the Inbox the shared documents with no topic, to those who can open them", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;

    expect(await listed(world, owner, "inbox")).toEqual(
      ids(world, SHARED.owner),
    );
    expect(await listed(world, limited, "inbox")).toEqual(
      ids(world, SHARED.limited),
    );
    expect(await listed(world, open, "inbox")).toEqual(ids(world, SHARED.open));

    await fileOnTopic(world, world.docs.teamAlpha);
    for (const member of [owner, limited, open]) {
      expect(await listed(world, member, "inbox")).not.toContain(
        world.docs.teamAlpha,
      );
    }
    expect(await listed(world, limited, "inbox")).toHaveLength(
      SHARED.limited.length - 1,
    );
  });

  it("snoozes an Inbox item to a date, for everybody who sees it", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited } = world;
    const { teamAlpha, teamBeta, sharedInBeta } = world.docs;
    const before = await row(world, owner, teamAlpha);
    expect(before?.snoozedUntil).toBeNull();

    // Hidden answers like unknown; opening without editing is not enough.
    const unknown = await snooze(world, limited, "nope", NEXT_YEAR);
    const hidden = await snooze(world, limited, teamBeta, NEXT_YEAR);
    expect(unknown.status).toBe(404);
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toEqual(await unknown.json());
    expect((await snooze(world, limited, sharedInBeta, NEXT_YEAR)).status).toBe(
      403,
    );
    expect((await snooze(world, limited, teamAlpha, "soon")).status).toBe(400);
    for (const id of [teamAlpha, teamBeta, sharedInBeta]) {
      expect((await row(world, owner, id))?.snoozedUntil).toBeNull();
    }

    const response = await snooze(world, limited, teamAlpha, NEXT_YEAR);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: teamAlpha,
      snoozedUntil: NEXT_YEAR,
    });
    for (const member of [owner, limited]) {
      const snoozed = await row(world, member, teamAlpha);
      expect(snoozed?.snoozedUntil).toBe(NEXT_YEAR);
      // Setting an item aside is not an edit.
      expect(snoozed?.updatedAt).toBe(before?.updatedAt);
    }
    expect((await row(world, owner, world.docs.project))?.snoozedUntil).toBe(
      null,
    );

    // A date that has passed no longer hides the item; one a minute away
    // still does, whatever the time zone of the database.
    const setTo = (offset: number) =>
      db
        .update(schema.documentTable)
        .set({ inboxSnoozedUntil: new Date(Date.now() + offset) })
        .where(eq(schema.documentTable.id, teamAlpha));
    await setTo(-60_000);
    expect((await row(world, owner, teamAlpha))?.snoozedUntil).toBeNull();
    await setTo(60_000);
    expect((await row(world, owner, teamAlpha))?.snoozedUntil).not.toBeNull();

    await snooze(world, owner, teamAlpha, NEXT_YEAR);
    expect((await row(world, owner, teamAlpha))?.snoozedUntil).toBe(NEXT_YEAR);
    const cleared = await snooze(world, owner, teamAlpha, null);
    expect(cleared.status).toBe(200);
    expect((await row(world, owner, teamAlpha))?.snoozedUntil).toBeNull();
  });
});
