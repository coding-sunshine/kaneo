import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { topicSubscriberTable } from "../../apps/api/src/database/schema";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

type Member = DocumentWorld["owner"];
type Topic = { id: string; following: boolean };
type Row = { id: string; filedAt: string | null; approvedAt: string | null };

const REASON = "The launch date moved, and this one says so.";
const NEXT_YEAR = new Date(Date.now() + 365 * 86_400_000).toISOString();

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
  return (await response.json()) as Topic;
};
const getTopic = async (world: DocumentWorld, user: Member, id: string) =>
  (await (await world.as(user)(`${base(world)}/${id}`)).json()) as Topic;
const follow = (world: DocumentWorld, user: Member, id: string) =>
  world.as(user)(`${base(world)}/${id}/follow`, json("PUT"));
const unfollow = (world: DocumentWorld, user: Member, id: string) =>
  world.as(user)(`${base(world)}/${id}/follow`, json("DELETE"));
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
// A follower row written past the API: somebody who followed a topic and
// then lost the way in.
const forceFollow = (topicId: string, user: Member) =>
  db
    .insert(topicSubscriberTable)
    .values({ topicId, userId: user.id })
    .onConflictDoNothing();
const followers = async (topicId: string) =>
  (
    await db
      .select({ userId: topicSubscriberTable.userId })
      .from(topicSubscriberTable)
      .where(eq(topicSubscriberTable.topicId, topicId))
  )
    .map((row) => row.userId)
    .sort();
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
const fresh = async (world: DocumentWorld, user: Member) => {
  const response = await world.as(user)(
    `/document/workspace/${world.ws}?filter=new`,
  );
  expect(response.status).toBe(200);
  return (await response.json()) as Row[];
};
const freshIds = async (world: DocumentWorld, user: Member) =>
  (await fresh(world, user)).map((row) => row.id).sort();
const seen = (world: DocumentWorld, user: Member, until: unknown) =>
  world.as(user)(
    `/document/workspace/${world.ws}/seen`,
    json("POST", { until }),
  );

describe("API integration: following a topic", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lets a person follow and unfollow a topic they can open", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;
    const topic = await createTopic(world, owner, {
      name: "Launch plan",
      projectId: world.alpha.id,
    });
    const hiddenTopic = await createTopic(world, owner, {
      name: "Pricing",
      projectId: world.beta.id,
    });

    // Whoever creates a topic decides on it, and a decider follows it.
    expect(topic.following).toBe(true);
    expect((await getTopic(world, limited, topic.id)).following).toBe(false);

    const followed = await follow(world, limited, topic.id);
    expect(followed.status).toBe(200);
    expect(((await followed.json()) as Topic).following).toBe(true);
    // Twice is the same as once.
    expect((await follow(world, limited, topic.id)).status).toBe(200);
    const listed = (await (
      await world.as(limited)(base(world))
    ).json()) as Topic[];
    expect(listed.map(({ id, following }) => ({ id, following }))).toEqual([
      { id: topic.id, following: true },
    ]);
    expect((await getTopic(world, open, topic.id)).following).toBe(false);

    const left = await unfollow(world, limited, topic.id);
    expect(left.status).toBe(200);
    expect(((await left.json()) as Topic).following).toBe(false);
    expect(await followers(topic.id)).toEqual([owner.id]);

    // A topic the person cannot open answers like one that does not exist.
    const unknown = await follow(world, limited, "nope");
    const hidden = await follow(world, limited, hiddenTopic.id);
    expect(unknown.status).toBe(404);
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toEqual(await unknown.json());
    expect((await unfollow(world, limited, hiddenTopic.id)).status).toBe(404);
    expect(await followers(hiddenTopic.id)).toEqual([owner.id]);

    // Naming a decider or a backup makes them a follower.
    const renamed = await world.as(owner)(
      `${base(world)}/${topic.id}`,
      json("PATCH", { deciderId: open.id, backupDeciderId: limited.id }),
    );
    expect(renamed.status).toBe(200);
    expect(await followers(topic.id)).toEqual(
      [owner.id, open.id, limited.id].sort(),
    );
  });

  it("tells followers about a new proposal and a new current document, and nobody else", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;
    // Team Beta: `limited` cannot open it.
    const topic = await createTopic(world, owner, {
      name: "Pricing",
      projectId: world.beta.id,
    });
    expect((await follow(world, open, topic.id)).status).toBe(200);
    await forceFollow(topic.id, limited);

    const proposal = await write(world, open, "Pricing for next year");
    await file(world, open, topic.id, proposal);

    const proposed = await told(owner, "document_proposed");
    expect(proposed).toHaveLength(1);
    expect(proposed[0]).toMatchObject({
      resourceType: "document",
      resourceId: proposal,
      eventData: {
        documentTitle: "Pricing for next year",
        topicId: topic.id,
        topicName: "Pricing",
        actorName: open.name,
        workspaceId: world.ws,
      },
    });
    // Not the person who filed it, and nobody who cannot open it.
    expect(await told(open, "document_proposed")).toEqual([]);
    expect(await told(limited, "document_proposed")).toEqual([]);

    // Filing it again on the same topic is not news.
    await file(world, open, topic.id, proposal);
    expect(await told(owner, "document_proposed")).toHaveLength(1);

    await makeCurrent(world, owner, topic.id, proposal);
    const current = await told(open, "document_current");
    expect(current).toHaveLength(1);
    expect(current[0]).toMatchObject({
      resourceType: "document",
      resourceId: proposal,
      eventData: { topicName: "Pricing", actorName: owner.name },
    });
    expect(await told(owner, "document_current")).toEqual([]);
    expect(await told(limited, "document_current")).toEqual([]);

    // Approving the same document again after an edit is not a new one.
    await makeCurrent(world, owner, topic.id, proposal);
    expect(await told(open, "document_current")).toHaveLength(1);

    // Somebody who stopped following hears nothing more.
    expect((await unfollow(world, open, topic.id)).status).toBe(200);
    const second = await write(world, owner, "Pricing, second take");
    await file(world, owner, topic.id, second);
    await makeCurrent(world, owner, topic.id, second);
    expect(await told(open, "document_proposed")).toEqual([]);
    expect(await told(open, "document_current")).toHaveLength(1);
  });

  it("leaves the topic unnamed for a follower who cannot open its place", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;
    // Team Beta: `limited` cannot open it, but the document is shared with
    // them by name.
    const topic = await createTopic(world, owner, {
      name: "Pricing",
      projectId: world.beta.id,
    });
    expect((await follow(world, open, topic.id)).status).toBe(200);
    await forceFollow(topic.id, limited);

    await file(world, owner, topic.id, world.docs.sharedInBeta);

    const [hidden, ...more] = await told(limited, "document_proposed");
    expect(more).toEqual([]);
    expect(hidden?.resourceId).toBe(world.docs.sharedInBeta);
    expect(hidden?.eventData).not.toHaveProperty("topicName");
    expect(hidden?.eventData).not.toHaveProperty("topicId");
    const [named] = await told(open, "document_proposed");
    expect(named?.eventData).toMatchObject({
      topicId: topic.id,
      topicName: "Pricing",
    });

    await makeCurrent(world, owner, topic.id, world.docs.sharedInBeta);
    const [current, ...moreCurrent] = await told(limited, "document_current");
    expect(moreCurrent).toEqual([]);
    expect(current?.eventData).not.toHaveProperty("topicName");
  });

  it("lists what is new on followed topics since the last visit", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;
    const topic = await createTopic(world, owner, {
      name: "Launch plan",
      projectId: world.alpha.id,
    });
    const hiddenTopic = await createTopic(world, owner, {
      name: "Pricing",
      projectId: world.beta.id,
    });

    // Filed before `limited` followed: not news for them.
    const early = await write(world, owner, "First plan");
    await file(world, owner, topic.id, early);
    expect((await follow(world, limited, topic.id)).status).toBe(200);
    await forceFollow(hiddenTopic.id, limited);
    expect(await freshIds(world, limited)).toEqual([]);

    const plan = await write(world, owner, "Second plan");
    await file(world, owner, topic.id, plan);
    const secret = await write(world, owner, "Prices");
    await file(world, owner, hiddenTopic.id, secret);

    // Only on a topic the person follows, and only what they can open.
    expect(await freshIds(world, limited)).toEqual([plan]);
    expect(await freshIds(world, open)).toEqual([]);
    // Not the author's own proposal.
    expect(await freshIds(world, owner)).toEqual([]);

    expect((await seen(world, limited, "soon")).status).toBe(400);
    const [row] = await fresh(world, limited);
    const marked = await seen(world, limited, row?.filedAt);
    expect(marked.status).toBe(200);
    expect(await marked.json()).toEqual({ seenAt: row?.filedAt });
    expect(await freshIds(world, limited)).toEqual([]);
    // One person's visit is not another's.
    expect((await follow(world, open, topic.id)).status).toBe(200);
    const third = await write(world, owner, "Third plan");
    await file(world, owner, topic.id, third);
    expect(await freshIds(world, open)).toEqual([third]);
    expect(await freshIds(world, limited)).toEqual([third]);

    // An approval after the visit is news again, and an earlier time never
    // moves the visit back.
    await makeCurrent(world, owner, topic.id, plan);
    expect(await freshIds(world, limited)).toEqual([plan, third].sort());
    const approved = (await fresh(world, limited)).find(
      (doc) => doc.id === plan,
    );
    expect((await seen(world, limited, approved?.approvedAt)).status).toBe(200);
    expect((await seen(world, limited, row?.filedAt)).status).toBe(200);
    expect(await freshIds(world, limited)).toEqual([]);

    // A time in the future counts as now, so the next filing is still news.
    expect((await seen(world, limited, NEXT_YEAR)).status).toBe(200);
    const fourth = await write(world, owner, "Fourth plan");
    await file(world, owner, topic.id, fourth);
    expect(await freshIds(world, limited)).toEqual([fourth]);
  });

  it("counts a proposal as news for its author when somebody else filed it", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited } = world;
    const topic = await createTopic(world, owner, {
      name: "Launch plan",
      projectId: world.alpha.id,
    });
    expect((await follow(world, limited, topic.id)).status).toBe(200);
    // Written by the owner in team Alpha, where everyone may edit it.
    const response = await world.as(owner)(
      "/document",
      json("POST", {
        workspaceId: world.ws,
        title: "Owner's draft",
        content: "<p>Owner's draft</p>",
        projectId: world.alpha.id,
      }),
    );
    const { id: draft } = (await response.json()) as { id: string };

    await file(world, limited, topic.id, draft);
    expect(await freshIds(world, owner)).toEqual([draft]);
    expect(await freshIds(world, limited)).toEqual([]);
  });
});
