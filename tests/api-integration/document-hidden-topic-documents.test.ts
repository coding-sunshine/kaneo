import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

type Member = DocumentWorld["owner"];

const REASON = "The launch date moved, and this one says so.";
const base = (world: DocumentWorld) => `/topic/workspace/${world.ws}`;

const createTopic = async (world: DocumentWorld, name: string) => {
  const response = await world.as(world.owner)(
    "/topic",
    json("POST", { workspaceId: world.ws, name, projectId: world.alpha.id }),
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { id: string }).id;
};
// A document the owner writes, files on the topic and makes current.
const current = async (
  world: DocumentWorld,
  topicId: string,
  title: string,
) => {
  const as = world.as(world.owner);
  const written = await as(
    "/document",
    json("POST", { workspaceId: world.ws, title, content: `<p>${title}</p>` }),
  );
  expect(written.status).toBe(200);
  const { id } = (await written.json()) as { id: string };
  const topic = `${base(world)}/${topicId}/document/${id}`;
  expect((await as(topic, json("PUT"))).status).toBe(200);
  const made = await as(`${topic}/current`, json("POST", { reason: REASON }));
  expect(made.status).toBe(200);
  return id;
};
// Moved into team Beta past the API, as a document moved after it was filed:
// the topic stays in team Alpha, which `limited` can enter.
const moveToBeta = (world: DocumentWorld, id: string) =>
  db
    .update(schema.documentTable)
    .set({ scope: "team", projectId: world.beta.id, workProjectId: null })
    .where(eq(schema.documentTable.id, id));

describe("API integration: documents a topic points to, for someone who cannot open them", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("leaves out the document a readable one replaced", async () => {
    const world = await buildDocumentWorld();
    const topicId = await createTopic(world, "Launch plan");
    const first = await current(world, topicId, "Launch plan, first");
    const second = await current(world, topicId, "Launch plan, second");
    await moveToBeta(world, first);

    const replaced = async (user: Member) => {
      const response = await world.as(user)(
        `/document/workspace/${world.ws}/${second}`,
      );
      expect(response.status).toBe(200);
      return ((await response.json()) as { supersedesDocumentId: unknown })
        .supersedesDocumentId;
    };
    expect(await replaced(world.open)).toBe(first);
    expect(await replaced(world.limited)).toBeNull();
  });

  it("leaves out a current document the person cannot open", async () => {
    const world = await buildDocumentWorld();
    const topicId = await createTopic(world, "Roadmap");
    const doc = await current(world, topicId, "Roadmap for the year");
    await moveToBeta(world, doc);

    const topic = async (user: Member) => {
      const response = await world.as(user)(`${base(world)}/${topicId}`);
      expect(response.status).toBe(200);
      return (await response.json()) as { currentDocumentId: unknown };
    };
    expect((await topic(world.open)).currentDocumentId).toBe(doc);
    expect((await topic(world.limited)).currentDocumentId).toBeNull();

    const listed = await world.as(world.limited)(base(world));
    expect(await listed.json()).toEqual([
      expect.objectContaining({ id: topicId, currentDocumentId: null }),
    ]);
  });

  it("does not let a decider replace a current document they cannot open by recording a decision", async () => {
    const world = await buildDocumentWorld();
    const topicId = await createTopic(world, "Roadmap");
    const doc = await current(world, topicId, "Roadmap for the year");
    await moveToBeta(world, doc);
    const named = await world.as(world.owner)(
      `${base(world)}/${topicId}`,
      json("PATCH", { deciderId: world.limited.id }),
    );
    expect(named.status).toBe(200);

    const recorded = await world.as(world.limited)(
      `${base(world)}/${topicId}/decision`,
      json("POST", { text: "Ship in March.", reason: REASON }),
    );
    expect(recorded.status).toBe(404);
    const rows = await db
      .select({ id: schema.documentTable.id })
      .from(schema.documentTable)
      .where(eq(schema.documentTable.status, "current"));
    expect(rows).toEqual([{ id: doc }]);
  });

  it("does not let someone replace a current document they cannot open", async () => {
    const world = await buildDocumentWorld();
    const topicId = await createTopic(world, "Roadmap");
    const doc = await current(world, topicId, "Roadmap for the year");
    await moveToBeta(world, doc);

    const settle = async (user: Member) => {
      const saved = await world.as(user)(
        "/document/file",
        json("POST", {
          workspaceId: world.ws,
          title: "Roadmap, next",
          markdown: "Next steps.",
          idempotencyKey: `replace-${user.id}`,
        }),
      );
      expect(saved.status).toBe(200);
      const { id } = (await saved.json()) as { id: string };
      const settled = await world.as(user)(
        `/document/workspace/${world.ws}/${id}/settle`,
        json("POST", { choice: "replace", topicId }),
      );
      const [row] = await db
        .select({ replaces: schema.documentTable.supersedesDocumentId })
        .from(schema.documentTable)
        .where(eq(schema.documentTable.id, id));
      return { status: settled.status, replaces: row?.replaces };
    };
    expect(await settle(world.open)).toEqual({ status: 200, replaces: doc });
    // Like a topic with no current document: nothing names the hidden one.
    expect(await settle(world.limited)).toEqual({
      status: 409,
      replaces: null,
    });
  });

  it("leaves out a current document the person cannot open from a draft's topics", async () => {
    const world = await buildDocumentWorld();
    const topicId = await createTopic(world, "Roadmap");
    const doc = await current(world, topicId, "Roadmap for the year");
    await moveToBeta(world, doc);

    const draft = async (user: Member) => {
      const response = await world.as(user)(
        "/document/file",
        json("POST", {
          workspaceId: world.ws,
          title: "Roadmap",
          markdown: "Next steps.",
          idempotencyKey: `draft-${user.id}`,
        }),
      );
      expect(response.status).toBe(200);
      return (
        (await response.json()) as {
          topics: { id: string; currentDocument: { id: string } | null }[];
        }
      ).topics;
    };
    expect(await draft(world.open)).toEqual([
      expect.objectContaining({
        id: topicId,
        currentDocument: expect.objectContaining({ id: doc }),
      }),
    ]);
    const hidden = await draft(world.limited);
    expect(hidden).toEqual([
      expect.objectContaining({ id: topicId, currentDocument: null }),
    ]);
    expect(JSON.stringify(hidden)).not.toContain(doc);
  });
});
