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
type Team = DocumentWorld["alpha"];

const REASON = "The launch date moved, and this one says so.";
const base = (world: DocumentWorld) => `/topic/workspace/${world.ws}`;

const createTopic = async (
  world: DocumentWorld,
  user: Member,
  body: Record<string, unknown>,
) => {
  const response = await world.as(user)(
    "/topic",
    json("POST", { workspaceId: world.ws, ...body }),
  );
  expect(response.status).toBe(200);
  return (await response.json()) as { id: string };
};
const write = async (world: DocumentWorld, author: Member, title: string) => {
  const response = await world.as(author)(
    "/document",
    json("POST", { workspaceId: world.ws, title, content: `<p>${title}</p>` }),
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { id: string }).id;
};
const file = async (
  world: DocumentWorld,
  user: Member,
  topicId: string,
  documentId: string,
) => {
  const response = await world.as(user)(
    `${base(world)}/${topicId}/document/${documentId}`,
    json("PUT"),
  );
  expect(response.status).toBe(200);
};
const makeCurrent = async (
  world: DocumentWorld,
  user: Member,
  topicId: string,
  documentId: string,
) => {
  const response = await world.as(user)(
    `${base(world)}/${topicId}/document/${documentId}/current`,
    json("POST", { reason: REASON }),
  );
  expect(response.status).toBe(200);
};
const follow = (world: DocumentWorld, user: Member, id: string) =>
  world.as(user)(`${base(world)}/${id}/follow`, json("PUT"));
const told = async (user: Member, type: string) =>
  db
    .select()
    .from(schema.notificationTable)
    .where(
      and(
        eq(schema.notificationTable.userId, user.id),
        eq(schema.notificationTable.type, type),
      ),
    );

const linkTo = (world: DocumentWorld, id: string) =>
  `<p>See <a href="https://tracker.example/dashboard/workspace/${world.ws}/document/${id}">the plan</a>.</p>`;

// An issue in a team, with a number of its own, assigned to `assignee`, whose
// description holds the address of each document in `links`. The description is
// saved through the API, which writes the task_document rows.
const issue = async (
  world: DocumentWorld,
  team: Team,
  number: number,
  assignee: Member | null,
  links: string[],
) => {
  const [column] = await db
    .select()
    .from(schema.columnTable)
    .where(
      and(
        eq(schema.columnTable.projectId, team.id),
        eq(schema.columnTable.slug, "to-do"),
      ),
    );
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: team.id,
      title: `Issue ${number} of ${team.slug}`,
      status: "to-do",
      columnId: column.id,
      userId: assignee?.id ?? null,
      number,
    })
    .returning();
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: number })
    .where(eq(schema.projectTable.id, team.id));
  if (links.length) {
    const response = await world.as(world.owner)(
      `/task/description/${task.id}`,
      json("PUT", {
        description: links.map((id) => linkTo(world, id)).join(""),
      }),
    );
    expect(response.status).toBe(200);
  }
  return task;
};

// A topic whose current document is `before`, and a filed proposal `after`.
const scene = async (world: DocumentWorld, projectId?: string) => {
  const topic = await createTopic(world, world.owner, {
    name: "Launch plan",
    ...(projectId ? { projectId } : {}),
  });
  const before = await write(world, world.owner, "Launch plan, first version");
  await file(world, world.owner, topic.id, before);
  await makeCurrent(world, world.owner, topic.id, before);
  const after = await write(world, world.owner, "Launch plan, second version");
  await file(world, world.owner, topic.id, after);
  return { topic, before, after };
};

describe("API integration: telling the assignee that a linked document was replaced", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("tells the assignee of an open issue that links to the replaced document", async () => {
    const world = await buildDocumentWorld();
    const { owner, open } = world;
    const { topic, before, after } = await scene(world, world.alpha.id);
    const task = await issue(world, world.alpha, 2, open, [before]);

    await makeCurrent(world, owner, topic.id, after);

    const sent = await told(open, "document_replaced");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: "document_replaced",
      resourceType: "document",
      resourceId: after,
      eventData: {
        taskId: task.id,
        taskNumber: 2,
        taskTitle: task.title,
        projectId: world.alpha.id,
        projectSlug: "alpha",
        taskCount: 1,
        topicId: topic.id,
        topicName: "Launch plan",
        documentTitle: "Launch plan, second version",
        actorName: owner.name,
        workspaceId: world.ws,
      },
    });
  });

  it("tells nobody about a closed, archived or canceled issue", async () => {
    const world = await buildDocumentWorld();
    const { owner, open } = world;
    const { topic, before, after } = await scene(world, world.alpha.id);
    const closed = await issue(world, world.alpha, 2, open, [before]);
    const archived = await issue(world, world.alpha, 3, open, [before]);
    const canceled = await issue(world, world.alpha, 4, open, [before]);

    const moved = await world.as(owner)(
      `/task/status/${closed.id}`,
      json("PUT", { status: "done" }),
    );
    expect(moved.status).toBe(200);
    const [row] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, closed.id));
    expect(row?.completedAt).not.toBeNull();
    // Direct row updates: these two states have no simple API route.
    await db
      .update(schema.taskTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.taskTable.id, archived.id));
    await db
      .update(schema.taskTable)
      .set({ canceledAt: new Date() })
      .where(eq(schema.taskTable.id, canceled.id));

    await makeCurrent(world, owner, topic.id, after);

    expect(await told(open, "document_replaced")).toEqual([]);
  });

  it("tells nobody about an issue with no assignee", async () => {
    const world = await buildDocumentWorld();
    const { owner, open } = world;
    const { topic, before, after } = await scene(world, world.alpha.id);
    await issue(world, world.alpha, 2, null, [before]);

    await makeCurrent(world, owner, topic.id, after);

    expect(await told(open, "document_replaced")).toEqual([]);
    expect(await told(owner, "document_replaced")).toEqual([]);
  });

  it("does not tell the person who made the document current, even as the assignee", async () => {
    const world = await buildDocumentWorld();
    const { owner } = world;
    const { topic, before, after } = await scene(world, world.alpha.id);
    await issue(world, world.alpha, 2, owner, [before]);

    await makeCurrent(world, owner, topic.id, after);

    expect(await told(owner, "document_replaced")).toEqual([]);
  });

  it("tells an assignee of two open issues once, with the count", async () => {
    const world = await buildDocumentWorld();
    const { owner, open } = world;
    const { topic, before, after } = await scene(world, world.alpha.id);
    await issue(world, world.alpha, 2, open, [before]);
    await issue(world, world.alpha, 3, open, [before]);

    await makeCurrent(world, owner, topic.id, after);

    const sent = await told(open, "document_replaced");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.eventData).toMatchObject({
      taskNumber: 2,
      projectSlug: "alpha",
      taskCount: 2,
    });
  });

  it("tells nobody who cannot open the new document", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited } = world;
    // A topic in team Beta: `limited` cannot open its documents.
    const { topic, before, after } = await scene(world, world.beta.id);
    // The link row is written although `limited` cannot open the old document.
    await issue(world, world.alpha, 2, limited, [before]);

    await makeCurrent(world, owner, topic.id, after);

    expect(await told(limited, "document_replaced")).toEqual([]);
  });

  it("leaves the topic unnamed for an assignee who cannot open its place", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited } = world;
    // A topic in team Beta, which `limited` cannot enter. The new document is
    // shared with them by name, so they may hear of it.
    const { topic, before, after } = await scene(world, world.beta.id);
    await issue(world, world.alpha, 2, limited, [before]);
    const shared = await world.as(owner)(
      `/document/workspace/${world.ws}/${after}/share/${limited.id}`,
      json("PUT", { access: "view" }),
    );
    expect(shared.status).toBe(200);

    await makeCurrent(world, owner, topic.id, after);

    const sent = await told(limited, "document_replaced");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      resourceId: after,
      eventData: { taskNumber: 2, projectSlug: "alpha" },
    });
    expect(sent[0]?.eventData).not.toHaveProperty("topicName");
    expect(sent[0]?.eventData).not.toHaveProperty("topicId");
  });

  it("tells nobody who can no longer enter the issue's team", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited } = world;
    // A topic at workspace level: `limited` can open the new document.
    const { topic, before, after } = await scene(world);
    const task = await issue(world, world.beta, 2, owner, [before]);
    // Assigned past the API, as someone who lost the team would still be.
    await db
      .update(schema.taskTable)
      .set({ userId: limited.id })
      .where(eq(schema.taskTable.id, task.id));

    await makeCurrent(world, owner, topic.id, after);

    expect(await told(limited, "document_replaced")).toEqual([]);
  });

  it("tells an assignee who follows the topic once, and a plain follower as before", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;
    const { topic, before, after } = await scene(world, world.alpha.id);
    expect((await follow(world, open, topic.id)).status).toBe(200);
    expect((await follow(world, limited, topic.id)).status).toBe(200);
    await issue(world, world.alpha, 2, open, [before]);

    await makeCurrent(world, owner, topic.id, after);

    expect(await told(open, "document_replaced")).toHaveLength(1);
    expect(await told(open, "document_current")).toEqual([]);
    expect(await told(limited, "document_current")).toHaveLength(1);
    expect(await told(limited, "document_replaced")).toEqual([]);
  });

  it("tells nobody when nothing was replaced", async () => {
    const world = await buildDocumentWorld();
    const { owner, open } = world;
    const topic = await createTopic(world, owner, {
      name: "Launch plan",
      projectId: world.alpha.id,
    });
    const first = await write(world, owner, "Launch plan, first version");
    await file(world, owner, topic.id, first);
    await issue(world, world.alpha, 2, open, [first]);

    // The first document made current replaces nothing.
    await makeCurrent(world, owner, topic.id, first);
    expect(await told(open, "document_replaced")).toEqual([]);

    // Approving the same document again after an edit replaces nothing.
    await makeCurrent(world, owner, topic.id, first);
    expect(await told(open, "document_replaced")).toEqual([]);
  });

  it("tells nobody when the issue links to the new document only", async () => {
    const world = await buildDocumentWorld();
    const { owner, open } = world;
    const { topic, after } = await scene(world, world.alpha.id);
    await issue(world, world.alpha, 2, open, [after]);

    await makeCurrent(world, owner, topic.id, after);

    expect(await told(open, "document_replaced")).toEqual([]);
  });
});
