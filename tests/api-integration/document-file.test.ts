import { and, eq, isNull } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

type Member = DocumentWorld["owner"];
type Receipt = {
  id: string;
  title: string;
  characters: number;
  kind: string;
  status: string;
  scope: string;
  created: boolean;
  needsDecision: boolean;
  topics: {
    id: string;
    name: string;
    parentName: string | null;
    currentDocument: {
      id: string;
      title: string;
      approvedAt: string | null;
    } | null;
  }[];
};
type Settled = {
  id: string;
  choice: string;
  title: string;
  kind: string;
  status: string;
  scope: string;
  topicId: string | null;
  replacesDocumentId: string | null;
  discarded: boolean;
};

const TEXT = "# Launch plan\n\nWe launch on 12 March. Zürich first, 東京 next.";
const REASON = "The launch date moved, and this one says so.";

// What an assistant does for a person: save the text, then settle the draft.
function chat(world: DocumentWorld) {
  const { ws, owner } = world;
  const one = (id: string) => `/document/workspace/${ws}/${id}`;
  const file = (user: Member, body: Record<string, unknown> = {}) =>
    world.as(user)(
      "/document/file",
      json("POST", {
        workspaceId: ws,
        title: "Launch plan v3",
        markdown: TEXT,
        idempotencyKey: "key-1",
        ...body,
      }),
    );
  const topicPath = (topicId: string, documentId: string) =>
    `/topic/workspace/${ws}/${topicId}/document/${documentId}`;
  return {
    file,
    saved: async (user: Member, body: Record<string, unknown> = {}) => {
      const response = await file(user, body);
      expect(response.status).toBe(200);
      return (await response.json()) as Receipt;
    },
    settle: (user: Member, id: string, body: unknown) =>
      world.as(user)(`${one(id)}/settle`, json("POST", body)),
    open: (user: Member, id: string) => world.as(user)(one(id)),
    topic: async (name: string, place: Record<string, string> = {}) => {
      const response = await world.as(owner)(
        "/topic",
        json("POST", { workspaceId: ws, name, ...place }),
      );
      expect(response.status).toBe(200);
      return ((await response.json()) as { id: string }).id;
    },
    // The owner files a document on a topic and approves it.
    makeCurrent: async (topicId: string, documentId: string) => {
      const filed = await world.as(owner)(
        topicPath(topicId, documentId),
        json("PUT"),
      );
      expect(filed.status).toBe(200);
      const approved = await world.as(owner)(
        `${topicPath(topicId, documentId)}/current`,
        json("POST", { reason: REASON }),
      );
      expect(approved.status).toBe(200);
    },
    setAside: (topicId: string, documentId: string) =>
      world.as(owner)(
        `${topicPath(topicId, documentId)}/set-aside`,
        json("POST"),
      ),
    current: (topicId: string, documentId: string) =>
      world.as(owner)(
        `${topicPath(topicId, documentId)}/current`,
        json("POST", { reason: REASON }),
      ),
    refile: (user: Member, topicId: string, documentId: string) =>
      world.as(user)(topicPath(topicId, documentId), json("PUT")),
    move: (user: Member, id: string, body: Record<string, string>) =>
      world.as(user)(`${one(id)}/location`, json("PUT", body)),
  };
}

const stored = async (id: string) => {
  const [row] = await db
    .select({
      title: schema.documentTable.title,
      content: schema.documentTable.content,
      kind: schema.documentTable.kind,
      status: schema.documentTable.status,
      scope: schema.documentTable.scope,
      projectId: schema.documentTable.projectId,
      topicId: schema.documentTable.topicId,
      supersedesDocumentId: schema.documentTable.supersedesDocumentId,
      creatorId: schema.documentTable.creatorId,
      deletedAt: schema.documentTable.deletedAt,
      externalSource: schema.documentTable.externalSource,
      externalId: schema.documentTable.externalId,
      sourceClient: schema.documentTable.sourceClient,
    })
    .from(schema.documentTable)
    .where(eq(schema.documentTable.id, id));
  if (!row) throw new Error(`Document ${id} is not stored`);
  return row;
};
const savedFromChat = () =>
  db
    .select({ id: schema.documentTable.id })
    .from(schema.documentTable)
    .where(eq(schema.documentTable.externalSource, "mcp"));
const currentIds = async () =>
  (
    await db
      .select({ id: schema.documentTable.id })
      .from(schema.documentTable)
      .where(
        and(
          eq(schema.documentTable.status, "current"),
          isNull(schema.documentTable.deletedAt),
        ),
      )
  )
    .map((row) => row.id)
    .sort();

describe("API integration: save a document from chat", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("saves the text as a private draft only its author can open", async () => {
    const world = await buildDocumentWorld();
    const { open, owner, limited } = world;
    const api = chat(world);

    const response = await api.file(open, { sourceClient: "claude" });
    expect(response.status).toBe(200);
    const receipt = (await response.json()) as Receipt;
    expect(receipt).toMatchObject({
      title: "Launch plan v3",
      characters: TEXT.length,
      kind: "unsorted",
      status: "draft",
      scope: "private",
      created: true,
      needsDecision: true,
      topics: [],
    });
    // The receipt counts the text. It does not send it back.
    expect(JSON.stringify(receipt)).not.toContain("12 March");

    expect(await stored(receipt.id)).toMatchObject({
      title: "Launch plan v3",
      content: TEXT,
      creatorId: open.id,
      projectId: null,
      topicId: null,
      externalSource: "mcp",
      externalId: `${open.id}:key-1`,
      sourceClient: "claude",
      deletedAt: null,
    });
    const opened = await api.open(open, receipt.id);
    expect(opened.status).toBe(200);
    expect(((await opened.json()) as { content: string }).content).toBe(TEXT);
    expect((await api.open(owner, receipt.id)).status).toBe(404);
    expect((await api.open(limited, receipt.id)).status).toBe(404);

    // Like any new document: the author follows it and its history starts.
    const versions = await db
      .select({ id: schema.documentVersionTable.id })
      .from(schema.documentVersionTable)
      .where(eq(schema.documentVersionTable.documentId, receipt.id));
    expect(versions).toHaveLength(1);
    const followers = await db
      .select({ userId: schema.documentSubscriberTable.userId })
      .from(schema.documentSubscriberTable)
      .where(eq(schema.documentSubscriberTable.documentId, receipt.id));
    expect(followers).toEqual([{ userId: open.id }]);
  });

  it("refuses a save it cannot store", async () => {
    const world = await buildDocumentWorld();
    const { open } = world;
    const api = chat(world);
    const statusOf = async (body: Record<string, unknown>) =>
      (await api.file(open, body)).status;

    expect(await statusOf({ title: "  " })).toBe(400);
    expect(await statusOf({ idempotencyKey: "" })).toBe(400);
    expect(await statusOf({ idempotencyKey: "k".repeat(201) })).toBe(400);
    expect(await statusOf({ markdown: "x".repeat(1_000_001) })).toBe(400);
    expect(await statusOf({ sourceClient: "web" })).toBe(400);
    expect(await statusOf({ workspaceId: "no-such-workspace" })).not.toBe(200);
    expect(await savedFromChat()).toHaveLength(0);
  });

  it("answers a repeated call with the same draft", async () => {
    const world = await buildDocumentWorld();
    const { open } = world;
    const api = chat(world);

    const first = await api.saved(open);
    const again = await api.saved(open, {
      title: "Something else",
      markdown: "Other text",
    });
    expect(again).toMatchObject({
      id: first.id,
      created: false,
      title: "Launch plan v3",
      characters: TEXT.length,
    });
    expect((await stored(first.id)).content).toBe(TEXT);
    expect(await savedFromChat()).toHaveLength(1);

    // An assistant that timed out sends the call again while the first runs.
    const twins = await Promise.all([
      api.saved(open, { idempotencyKey: "key-2" }),
      api.saved(open, { idempotencyKey: "key-2" }),
    ]);
    expect(twins[0].id).toBe(twins[1].id);
    expect(twins.filter((twin) => twin.created)).toHaveLength(1);
    expect(await savedFromChat()).toHaveLength(2);
  });

  it("gives two people with the same key a draft each", async () => {
    const world = await buildDocumentWorld();
    const { open, limited } = world;
    const api = chat(world);

    const mine = await api.saved(open);
    const theirs = await api.saved(limited, { title: "Their plan" });
    expect(theirs.created).toBe(true);
    expect(theirs.id).not.toBe(mine.id);
    expect(theirs.title).toBe("Their plan");

    expect((await api.open(limited, mine.id)).status).toBe(404);
    expect((await api.open(open, theirs.id)).status).toBe(404);
    expect((await api.saved(open)).id).toBe(mine.id);
    expect((await api.saved(limited)).id).toBe(theirs.id);
  });

  it("names the matching topics the author can open, and their current document", async () => {
    const world = await buildDocumentWorld();
    const { open, limited, docs } = world;
    const api = chat(world);
    const inAlpha = await api.topic("Launch plan", {
      projectId: world.alpha.id,
    });
    const inBeta = await api.topic("Launch plan", { projectId: world.beta.id });
    await api.topic("Hiring", { projectId: world.alpha.id });
    await api.makeCurrent(inBeta, docs.teamBeta);

    // Nothing is current on the topic yet.
    const early = await api.saved(limited, { idempotencyKey: "early" });
    expect(early.topics).toEqual([
      {
        id: inAlpha,
        name: "Launch plan",
        parentName: "Alpha",
        currentDocument: null,
      },
    ]);

    await api.makeCurrent(inAlpha, docs.teamAlpha);
    const response = await api.file(limited, { idempotencyKey: "later" });
    const text = await response.text();
    const later = JSON.parse(text) as Receipt;
    expect(later.topics).toHaveLength(1);
    expect(later.topics[0]).toMatchObject({
      id: inAlpha,
      currentDocument: { id: docs.teamAlpha, title: "leakdoc teamAlpha" },
    });
    expect(later.topics[0]?.currentDocument?.approvedAt).toEqual(
      expect.any(String),
    );
    // The topic in the team `limited` cannot enter is not named at all.
    expect(text).not.toContain(inBeta);
    expect(text).not.toContain(docs.teamBeta);
    expect(text).not.toContain("Beta");

    const both = await api.saved(open, { title: "launch PLAN, third draft" });
    expect(both.topics.map((topic) => topic.id).sort()).toEqual(
      [inAlpha, inBeta].sort(),
    );
    // A repeated call lists the topics again.
    expect((await api.saved(open)).topics).toHaveLength(2);
    // A title with no letters or digits matches no topic, not even one whose
    // name has none either.
    await api.topic("—", { projectId: world.alpha.id });
    const blank = await api.saved(open, { title: "—", idempotencyKey: "dash" });
    expect(blank.topics).toEqual([]);
    const other = await api.saved(open, {
      title: "Pricing",
      idempotencyKey: "pricing",
    });
    expect(other.topics).toEqual([]);
  });

  it("settles a draft four ways, and none makes it current", async () => {
    const world = await buildDocumentWorld();
    const { limited, docs } = world;
    const api = chat(world);
    const topic = await api.topic("Launch plan", { projectId: world.alpha.id });
    await api.makeCurrent(topic, docs.teamAlpha);
    const draft = async (key: string) =>
      (await api.saved(limited, { idempotencyKey: key })).id;
    const settled = async (id: string, body: unknown) => {
      const response = await api.settle(limited, id, body);
      expect(response.status).toBe(200);
      return (await response.json()) as Settled;
    };

    const proposal = await draft("proposal");
    expect(
      await settled(proposal, { choice: "proposal", topicId: topic }),
    ).toEqual({
      id: proposal,
      choice: "proposal",
      title: "Launch plan v3",
      kind: "unsorted",
      status: "in_review",
      scope: "team",
      topicId: topic,
      replacesDocumentId: null,
      discarded: false,
    });
    expect(await stored(proposal)).toMatchObject({
      status: "in_review",
      scope: "team",
      projectId: world.alpha.id,
      topicId: topic,
      supersedesDocumentId: null,
    });

    const replacement = await draft("replace");
    expect(
      await settled(replacement, { choice: "replace", topicId: topic }),
    ).toMatchObject({
      choice: "replace",
      status: "in_review",
      topicId: topic,
      replacesDocumentId: docs.teamAlpha,
    });
    // It says which document its author means it to replace.
    expect(await stored(replacement)).toMatchObject({
      status: "in_review",
      topicId: topic,
      supersedesDocumentId: docs.teamAlpha,
    });

    const brainstorm = await draft("brainstorm");
    expect(await settled(brainstorm, { choice: "brainstorm" })).toMatchObject({
      choice: "brainstorm",
      kind: "brainstorm",
      status: "draft",
      scope: "private",
      topicId: null,
      discarded: false,
    });
    // Its author has decided, so a repeated save no longer asks.
    expect(
      (await api.saved(limited, { idempotencyKey: "brainstorm" }))
        .needsDecision,
    ).toBe(false);

    const discarded = await draft("discard");
    expect(await settled(discarded, { choice: "discard" })).toMatchObject({
      id: discarded,
      choice: "discard",
      discarded: true,
    });
    expect((await stored(discarded)).deletedAt).not.toBeNull();
    expect((await api.open(limited, discarded)).status).toBe(404);
    // The key is spent: the same call does not quietly bring the text back.
    expect(
      (await api.file(limited, { idempotencyKey: "discard" })).status,
    ).toBe(409);

    // A filed document is settled. A second answer does not move it again.
    for (const choice of ["proposal", "replace", "brainstorm", "discard"]) {
      const response = await api.settle(limited, proposal, {
        choice,
        topicId: topic,
      });
      expect({ choice, status: response.status }).toEqual({
        choice,
        status: 409,
      });
    }
    expect(await stored(proposal)).toMatchObject({
      kind: "unsorted",
      status: "in_review",
      deletedAt: null,
    });
    expect(await currentIds()).toEqual([docs.teamAlpha]);
  });

  it("refuses a topic the author cannot open like one that does not exist", async () => {
    const world = await buildDocumentWorld();
    const { limited, docs } = world;
    const api = chat(world);
    const withCurrent = await api.topic("Launch plan", {
      projectId: world.beta.id,
    });
    await api.makeCurrent(withCurrent, docs.teamBeta);
    const withoutCurrent = await api.topic("Pricing", {
      projectId: world.beta.id,
    });
    const empty = await api.topic("Hiring", { projectId: world.alpha.id });
    const { id } = await api.saved(limited);

    const unknown = await api.settle(limited, id, {
      choice: "proposal",
      topicId: "no-such-topic",
    });
    expect(unknown.status).toBe(404);
    const unknownBody = await unknown.text();
    for (const topicId of [withCurrent, withoutCurrent, "no-such-topic"]) {
      for (const choice of ["proposal", "replace"]) {
        const response = await api.settle(limited, id, { choice, topicId });
        expect({ topicId, choice, status: response.status }).toEqual({
          topicId,
          choice,
          status: 404,
        });
        expect(await response.text()).toBe(unknownBody);
      }
    }

    // Filing needs a topic, and replacing needs something to replace.
    expect((await api.settle(limited, id, { choice: "proposal" })).status).toBe(
      400,
    );
    expect((await api.settle(limited, id, { choice: "replace" })).status).toBe(
      400,
    );
    expect(
      (await api.settle(limited, id, { choice: "replace", topicId: empty }))
        .status,
    ).toBe(409);
    expect((await api.settle(limited, id, { choice: "publish" })).status).toBe(
      400,
    );
    expect(await stored(id)).toMatchObject({
      kind: "unsorted",
      status: "draft",
      scope: "private",
      projectId: null,
      topicId: null,
      supersedesDocumentId: null,
      deletedAt: null,
    });
    expect(await currentIds()).toEqual([docs.teamBeta]);
  });

  it("lets only the author settle, and never a current document", async () => {
    const world = await buildDocumentWorld();
    const { owner, open, limited, docs } = world;
    const api = chat(world);
    const topic = await api.topic("Launch plan", { projectId: world.alpha.id });
    await api.makeCurrent(topic, docs.teamAlpha);
    const { id } = await api.saved(limited);

    // Nobody else can open a private draft, so to them it does not exist.
    for (const user of [owner, open]) {
      for (const choice of ["proposal", "discard"]) {
        const response = await api.settle(user, id, { choice, topicId: topic });
        expect({ choice, status: response.status }).toEqual({
          choice,
          status: 404,
        });
      }
    }
    expect(await stored(id)).toMatchObject({
      status: "draft",
      deletedAt: null,
    });

    // `open` may edit this team document, but did not write it.
    for (const choice of ["proposal", "replace", "brainstorm", "discard"]) {
      const response = await api.settle(open, docs.issueAlpha, {
        choice,
        topicId: topic,
      });
      expect({ choice, status: response.status }).toEqual({
        choice,
        status: 403,
      });
    }
    expect(await stored(docs.issueAlpha)).toMatchObject({
      kind: "unsorted",
      status: "draft",
      topicId: null,
      deletedAt: null,
    });

    // The author of a current document cannot settle it away.
    for (const choice of ["proposal", "replace", "brainstorm", "discard"]) {
      const response = await api.settle(owner, docs.teamAlpha, {
        choice,
        topicId: topic,
      });
      expect({ choice, status: response.status }).toEqual({
        choice,
        status: 409,
      });
    }
    expect(await stored(docs.teamAlpha)).toMatchObject({
      kind: "unsorted",
      status: "current",
      deletedAt: null,
    });
  });

  it("keeps the stated intent true when the topic changes under it", async () => {
    const world = await buildDocumentWorld();
    const { limited, docs } = world;
    const api = chat(world);
    const topic = await api.topic("Launch plan", { projectId: world.alpha.id });
    const other = await api.topic("Pricing", { projectId: world.alpha.id });
    await api.makeCurrent(topic, docs.teamAlpha);
    const replacementOf = async (key: string) => {
      const { id } = await api.saved(limited, { idempotencyKey: key });
      const response = await api.settle(limited, id, {
        choice: "replace",
        topicId: topic,
      });
      expect(response.status).toBe(200);
      expect((await stored(id)).supersedesDocumentId).toBe(docs.teamAlpha);
      return id;
    };

    // Filed on another topic, it no longer means to replace anything here.
    const refiled = await replacementOf("refiled");
    expect((await api.refile(limited, other, refiled)).status).toBe(200);
    expect(await stored(refiled)).toMatchObject({
      topicId: other,
      supersedesDocumentId: null,
    });

    // Moved off the topic, it is a draft again.
    const moved = await replacementOf("moved");
    expect(
      (
        await api.move(limited, moved, {
          scope: "team",
          projectId: world.alpha.id,
        })
      ).status,
    ).toBe(200);
    expect(await stored(moved)).toMatchObject({
      status: "draft",
      topicId: null,
      supersedesDocumentId: null,
    });

    // The decider sets the current document aside, then approves the
    // replacement. Nothing was current, so it replaced nothing.
    const approved = await replacementOf("approved");
    expect((await api.setAside(topic, docs.teamAlpha)).status).toBe(200);
    expect((await api.current(topic, approved)).status).toBe(200);
    expect(await stored(approved)).toMatchObject({
      status: "current",
      supersedesDocumentId: null,
    });
    expect((await stored(docs.teamAlpha)).status).toBe("in_review");
  });
});
