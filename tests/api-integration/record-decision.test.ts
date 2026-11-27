import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";
import { createWorkspaceMember } from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

type Member = DocumentWorld["owner"];
type Topic = { id: string; currentDocumentId: string | null };
type Doc = {
  id: string;
  title: string;
  content: string;
  kind: string;
  status: string;
  scope: string;
  projectId: string | null;
  topicId: string | null;
  statusReason: string | null;
  filedAt: string | null;
  contentHash: string;
  approvedHash: string | null;
  approvedById: string | null;
};

const DAY = 24 * 60 * 60 * 1000;
const REASON = "Agreed in the Monday review.";
const TEXT = "We launch on the third of March.";
const day = (offset = 0) =>
  new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

function decisions(world: DocumentWorld) {
  const { ws } = world;
  const base = `/topic/workspace/${ws}`;
  const doc = (id: string) => `/document/workspace/${ws}/${id}`;
  const api = {
    topic: async (body: Record<string, unknown> = {}) => {
      const response = await world.as(world.owner)(
        "/topic",
        json("POST", {
          workspaceId: ws,
          name: "Launch date",
          projectId: world.alpha.id,
          ...body,
        }),
      );
      expect(response.status).toBe(200);
      return (await response.json()) as Topic;
    },
    get: async (user: Member, id: string) =>
      (await (await world.as(user)(`${base}/${id}`)).json()) as Topic,
    record: (user: Member, id: string, body: Record<string, unknown> = {}) =>
      world.as(user)(
        `${base}/${id}/decision`,
        json("POST", { text: TEXT, reason: REASON, ...body }),
      ),
    open: (user: Member, id: string) => world.as(user)(doc(id)),
    document: async (user: Member, id: string) =>
      (await (await world.as(user)(doc(id))).json()) as Doc,
    edit: (user: Member, id: string, body: Record<string, unknown>) =>
      world.as(user)(doc(id), json("PATCH", body)),
    approve: (user: Member, id: string, documentId: string, reason = REASON) =>
      world.as(user)(
        `${base}/${id}/document/${documentId}/current`,
        json("POST", { reason }),
      ),
    // A document by `author` in team Alpha, current on a topic `decider`
    // decides. Everyone else in the team may only view it.
    withCurrent: async (author: Member, decider: Member, content: string) => {
      const topic = await api.topic({ deciderId: decider.id });
      const made = await world.as(author)(
        "/document",
        json("POST", {
          workspaceId: ws,
          title: "Launch plan",
          content,
          projectId: world.alpha.id,
        }),
      );
      expect(made.status).toBe(200);
      const { id } = (await made.json()) as Doc;
      await api.edit(author, id, { generalAccess: "view" });
      const filed = await world.as(author)(
        `${base}/${topic.id}/document/${id}`,
        json("PUT"),
      );
      expect(filed.status).toBe(200);
      expect((await api.approve(decider, topic.id, id)).status).toBe(200);
      return { topic, id };
    },
  };
  return api;
}

describe("API integration: recording a decision on a topic", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("saves the note as the current document of a topic that has none", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;
    const api = decisions(world);
    const topic = await api.topic({ deciderId: open.id });

    const response = await api.record(open, topic.id);
    expect(response.status).toBe(200);
    const note = (await response.json()) as Doc;

    expect(note).toMatchObject({
      title: "Launch date",
      content: `## Decisions\n\n- ${day()}: ${TEXT}`,
      kind: "decision",
      status: "current",
      scope: "team",
      projectId: world.alpha.id,
      topicId: topic.id,
      statusReason: REASON,
      approvedById: open.id,
    });
    expect(note.filedAt).not.toBeNull();
    expect(note.approvedHash).toBe(note.contentHash);
    expect((await api.get(owner, topic.id)).currentDocumentId).toBe(note.id);
    // It lives in the topic's place: who can open the topic can open it.
    expect((await api.open(limited, note.id)).status).toBe(200);
  });

  it("puts the note where the topic is, for nobody else", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;
    const api = decisions(world);
    const inBeta = await api.topic({ projectId: world.beta.id });
    const everyone = await api.topic({ projectId: undefined });

    const hidden = (await (await api.record(owner, inBeta.id)).json()) as Doc;
    expect(hidden).toMatchObject({ scope: "team", projectId: world.beta.id });
    // `limited` cannot enter team Beta.
    expect((await api.open(limited, hidden.id)).status).toBe(404);
    expect((await api.open(open, hidden.id)).status).toBe(200);

    const shared = (await (await api.record(owner, everyone.id)).json()) as Doc;
    expect(shared).toMatchObject({ scope: "workspace", projectId: null });
    expect((await api.open(limited, shared.id)).status).toBe(200);
  });

  it("adds a dated line to the current document and leaves it to be approved", async () => {
    const world = await buildDocumentWorld();
    const { owner, open } = world;
    const api = decisions(world);
    const text = "The launch is in March.\n\nMore to follow.";
    const { topic, id } = await api.withCurrent(owner, open, text);
    const before = await api.document(owner, id);

    const response = await api.record(open, topic.id, { date: day(-1) });
    expect(response.status).toBe(200);
    const first = (await response.json()) as Doc;

    expect(first.id).toBe(id);
    expect(first.status).toBe("current");
    expect(first.content).toBe(
      `## Decisions\n\n- ${day(-1)}: ${TEXT}\n\n${text}`,
    );
    // Edited after approval: what was approved is still the text before.
    expect(first.approvedHash).toBe(before.approvedHash);
    expect(first.contentHash).not.toBe(first.approvedHash);
    expect(first.statusReason).toBe(before.statusReason);
    expect((await api.get(owner, topic.id)).currentDocumentId).toBe(id);

    // The next one goes on top of the same list.
    const second = (await (
      await api.record(open, topic.id, { text: "Invites go out in January." })
    ).json()) as Doc;
    expect(second.id).toBe(id);
    expect(second.content).toBe(
      `## Decisions\n\n- ${day()}: Invites go out in January.\n- ${day(-1)}: ${TEXT}\n\n${text}`,
    );

    // The decider approves the lines the way they approve any edit.
    const why = "Two decisions from the Monday review.";
    expect((await api.approve(open, topic.id, id, why)).status).toBe(200);
    const approved = await api.document(owner, id);
    expect(approved.approvedHash).toBe(approved.contentHash);
    expect(approved.statusReason).toBe(why);
  });

  it("tells the topic's followers once, when a recorded line is approved", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;
    const api = decisions(world);
    const { topic, id } = await api.withCurrent(owner, open, "The plan.");
    const followed = await world.as(limited)(
      `/topic/workspace/${world.ws}/${topic.id}/follow`,
      json("PUT"),
    );
    expect(followed.status).toBe(200);
    const notices = async (user: Member) =>
      db
        .select({
          title: schema.notificationTable.title,
          resourceId: schema.notificationTable.resourceId,
        })
        .from(schema.notificationTable)
        .where(
          and(
            eq(schema.notificationTable.userId, user.id),
            eq(schema.notificationTable.type, "document_decision"),
          ),
        );

    // Only added: nobody hears of it yet.
    expect((await api.record(open, topic.id)).status).toBe(200);
    expect(await notices(limited)).toHaveLength(0);

    expect((await api.approve(open, topic.id, id)).status).toBe(200);
    expect(await notices(limited)).toEqual([
      { title: expect.stringContaining("recorded a decision"), resourceId: id },
    ]);
    // Not the decider who approved it.
    expect(await notices(open)).toHaveLength(0);

    // An edit with no new decision, approved again, tells nobody.
    await api.edit(owner, id, {
      content: `${(await api.document(owner, id)).content}\n\nMore.`,
    });
    expect((await api.approve(open, topic.id, id)).status).toBe(200);
    expect(await notices(limited)).toHaveLength(1);
  });

  it("takes the line from whoever decides, whatever the document lets them do", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;
    const api = decisions(world);
    // `limited` wrote it, `open` decides. The workspace owner may only view.
    const { topic, id } = await api.withCurrent(limited, open, "Draft.");
    expect((await api.edit(owner, id, { content: "Mine." })).status).toBe(403);

    const response = await api.record(owner, topic.id);
    expect(response.status).toBe(200);
    expect(((await response.json()) as Doc).content).toBe(
      `## Decisions\n\n- ${day()}: ${TEXT}\n\nDraft.`,
    );
    // Still no editor of the document.
    expect((await api.edit(owner, id, { content: "Mine." })).status).toBe(403);
  });

  it("refuses a member who does not decide on the topic", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;
    const api = decisions(world);
    const { topic, id } = await api.withCurrent(owner, open, "Draft.");
    // `limited` may edit the document, and still does not decide.
    await api.edit(owner, id, { generalAccess: "edit" });
    expect((await api.edit(limited, id, { title: "Plan" })).status).toBe(200);
    const empty = await api.topic({ deciderId: open.id });
    const viewer = await addWorkspaceMember(world.ws, "viewer");

    for (const user of [limited, viewer]) {
      expect((await api.record(user, topic.id)).status).toBe(403);
      expect((await api.record(user, empty.id)).status).toBe(403);
    }
    expect((await api.document(owner, id)).content).toBe("Draft.");
    expect((await api.get(owner, empty.id)).currentDocumentId).toBeNull();
  });

  it("answers for a topic that cannot be opened as for one that does not exist", async () => {
    const world = await buildDocumentWorld();
    const { limited } = world;
    const api = decisions(world);
    const inBeta = await api.topic({ projectId: world.beta.id });

    const hidden = await api.record(limited, inBeta.id);
    const missing = await api.record(limited, "no-such-topic");
    expect(hidden.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await hidden.text()).toBe(await missing.text());
    expect(
      (await api.get(world.owner, inBeta.id)).currentDocumentId,
    ).toBeNull();

    // The owner of another workspace gets what any other write here gives.
    const { user: outsider } = await createWorkspaceMember({ role: "owner" });
    const refused = await api.record(outsider, inBeta.id);
    const sameAs = await world.as(outsider)(
      `/topic/workspace/${world.ws}/${inBeta.id}`,
      json("PATCH", { name: "Taken" }),
    );
    expect(refused.status).not.toBe(200);
    expect(refused.status).toBe(sameAs.status);
    expect(
      (await api.get(world.owner, inBeta.id)).currentDocumentId,
    ).toBeNull();
  });

  it("writes one line, dated a day near today", async () => {
    const world = await buildDocumentWorld();
    const { owner } = world;
    const api = decisions(world);
    const topic = await api.topic();
    const status = async (body: Record<string, unknown>) =>
      (await api.record(owner, topic.id, body)).status;

    expect(await status({ text: "   " })).toBe(400);
    expect(await status({ reason: "" })).toBe(400);
    expect(await status({ date: "2020-01-01" })).toBe(400);
    expect(await status({ date: day(3) })).toBe(400);
    // No such day, in a month that is otherwise close enough.
    expect(await status({ date: `${day().slice(0, 8)}32` })).toBe(400);
    expect(await status({ date: "tomorrow" })).toBe(400);
    expect((await api.get(owner, topic.id)).currentDocumentId).toBeNull();

    const response = await api.record(owner, topic.id, {
      text: "  We launch\n\n## on the third.  ",
      date: day(1),
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as Doc).content).toBe(
      `## Decisions\n\n- ${day(1)}: We launch ## on the third.`,
    );
  });
});
