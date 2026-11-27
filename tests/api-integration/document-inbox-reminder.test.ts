import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { checkInboxReminders } from "../../apps/api/src/scheduler/inbox-reminders";
import { resetTestDatabase } from "./helpers/database";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const TYPE = "document_inbox_waiting";

const later = (ms: number) => new Date(Date.now() + ms);

const remindersFor = async (documentId: string) =>
  db
    .select({ userId: schema.notificationTable.userId })
    .from(schema.notificationTable)
    .where(
      and(
        eq(schema.notificationTable.type, TYPE),
        eq(schema.notificationTable.resourceId, documentId),
      ),
    );

const recipients = async (documentId: string) =>
  (await remindersFor(documentId)).map((row) => row.userId).sort();

const follow = (documentId: string, userId: string) =>
  db.insert(schema.documentSubscriberTable).values({ documentId, userId });

describe("Inbox reminder", () => {
  let world: DocumentWorld;

  beforeEach(async () => {
    await resetTestDatabase();
    world = await buildDocumentWorld();
  });

  it("reminds once, after three days, only the people who can open the document", async () => {
    const doc = world.docs.teamBeta;
    // `limited` follows the document but cannot enter team Beta.
    await follow(doc, world.open.id);
    await follow(doc, world.limited.id);

    await checkInboxReminders(later(3 * DAY_MS - MINUTE_MS));
    expect(await recipients(doc)).toEqual([]);

    await checkInboxReminders(later(3 * DAY_MS + MINUTE_MS));
    expect(await recipients(doc)).toEqual(
      [world.owner.id, world.open.id].sort(),
    );

    await checkInboxReminders(later(3 * DAY_MS + 2 * MINUTE_MS));
    await checkInboxReminders(later(10 * DAY_MS));
    expect(await recipients(doc)).toEqual(
      [world.owner.id, world.open.id].sort(),
    );
  });

  it("drops a follower who lost access to the document's team", async () => {
    const doc = world.docs.teamAlpha;
    await follow(doc, world.limited.id);
    await restrictToProjects(world.ws, world.limited.id, [world.beta.id]);

    await checkInboxReminders(later(3 * DAY_MS + MINUTE_MS));
    expect(await recipients(doc)).toEqual([world.owner.id]);
  });

  it("leaves out private, filed, snoozed and deleted documents", async () => {
    const topic = await world.as(world.owner)(
      "/topic",
      json("POST", {
        workspaceId: world.ws,
        name: "Launch plan",
        projectId: world.alpha.id,
      }),
    );
    expect(topic.status).toBe(200);
    const topicId = ((await topic.json()) as { id: string }).id;
    const filed = await world.as(world.owner)(
      `/topic/workspace/${world.ws}/${topicId}/document/${world.docs.teamAlpha}`,
      json("PUT"),
    );
    expect(filed.status).toBe(200);
    await db
      .update(schema.documentTable)
      .set({ inboxSnoozedUntil: later(5 * DAY_MS) })
      .where(eq(schema.documentTable.id, world.docs.workspace));
    const deleted = await world.as(world.owner)(
      `/document/workspace/${world.ws}/${world.docs.project}`,
      json("DELETE"),
    );
    expect(deleted.status).toBe(200);

    await checkInboxReminders(later(4 * DAY_MS));

    expect(await recipients(world.docs.private)).toEqual([]);
    expect(await recipients(world.docs.teamAlpha)).toEqual([]);
    expect(await recipients(world.docs.workspace)).toEqual([]);
    expect(await recipients(world.docs.project)).toEqual([]);
    expect(await recipients(world.docs.teamBeta)).toEqual([world.owner.id]);
  });

  it("counts the wait from when a private draft moved into the Inbox", async () => {
    const doc = world.docs.private;
    await db
      .update(schema.documentTable)
      .set({ inboxSince: new Date(Date.now() - 10 * DAY_MS) })
      .where(eq(schema.documentTable.id, doc));
    const moved = await world.as(world.owner)(
      `/document/workspace/${world.ws}/${doc}/location`,
      json("PUT", { scope: "team", projectId: world.alpha.id }),
    );
    expect(moved.status).toBe(200);

    await checkInboxReminders(later(DAY_MS));
    expect(await recipients(doc)).toEqual([]);

    await checkInboxReminders(later(3 * DAY_MS + MINUTE_MS));
    expect(await recipients(doc)).toEqual([world.owner.id]);
  });
});
