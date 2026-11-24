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
type Head = {
  id: string;
  name: string;
  parentName: string | null;
  deciderName: string | null;
};
type Current = {
  topics: (Head & {
    unreviewed: number;
    current: {
      id: string;
      title: string;
      approvedAt: string | null;
      approvedByName: string | null;
      reason: string | null;
      editedSinceApproval: boolean;
      text: string | null;
    } | null;
  })[];
};
type Unreviewed = {
  topics: (Head & {
    documents: {
      id: string;
      title: string;
      kind: string;
      creatorName: string | null;
      filedAt: string | null;
      updatedAt: string;
    }[];
  })[];
};

const REASON = "The launch date moved, and this one says so.";
const APPROVED = "We launch on 5 March. The price is 40 per seat.";
const NOTHING = { topics: [] };

// What an assistant reads before it drafts or answers. The owner writes and
// approves everything, so nobody else gets in as the author.
function reading(world: DocumentWorld) {
  const { ws, owner } = world;
  const base = `/topic/workspace/${ws}`;
  const ok = async (response: Response) => {
    expect(response.status).toBe(200);
    return response.json();
  };
  const read = (route: string) => async (user: Member, topic: string) =>
    world.as(user)(`${base}/${route}?topic=${encodeURIComponent(topic)}`);
  const file = async (topicId: string, documentId: string) => {
    await ok(
      await world.as(owner)(
        `${base}/${topicId}/document/${documentId}`,
        json("PUT"),
      ),
    );
    return documentId;
  };
  const write = async (
    title: string,
    content: string,
    place: Record<string, string> = { projectId: world.alpha.id },
  ) =>
    (
      (await ok(
        await world.as(owner)(
          "/document",
          json("POST", { workspaceId: ws, title, content, ...place }),
        ),
      )) as { id: string }
    ).id;
  return {
    current: read("current"),
    unreviewed: read("unreviewed"),
    currentOf: async (user: Member, topic: string) =>
      (await ok(await read("current")(user, topic))) as Current,
    unreviewedOf: async (user: Member, topic: string) =>
      (await ok(await read("unreviewed")(user, topic))) as Unreviewed,
    topic: async (
      name: string,
      place: Record<string, string> = { projectId: world.alpha.id },
    ) =>
      (
        (await ok(
          await world.as(owner)(
            "/topic",
            json("POST", { workspaceId: ws, name, ...place }),
          ),
        )) as { id: string }
      ).id,
    write,
    file,
    approve: async (topicId: string, documentId: string) => {
      await file(topicId, documentId);
      await ok(
        await world.as(owner)(
          `${base}/${topicId}/document/${documentId}/current`,
          json("POST", { reason: REASON }),
        ),
      );
      return documentId;
    },
    edit: async (id: string, content: string) =>
      ok(
        await world.as(owner)(
          `/document/workspace/${ws}/${id}`,
          json("PATCH", { content }),
        ),
      ),
    discard: async (id: string) =>
      ok(
        await world.as(owner)(
          `/document/workspace/${ws}/${id}`,
          json("DELETE"),
        ),
      ),
    search: async (user: Member, word: string, type: string, limit = 50) =>
      (
        (await ok(
          await world.as(user)(
            `/search?q=${word}&workspaceId=${ws}&type=${type}&limit=${limit}`,
          ),
        )) as { results: { id: string; type: string; status?: string }[] }
      ).results.filter((result) => result.type === "document"),
  };
}

describe("API integration: reading a topic before writing", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("answers with the topic's current document and its approved text", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited } = world;
    const api = reading(world);
    const topicId = await api.topic("Launch plan");
    const v2 = await api.approve(
      topicId,
      await api.write("Launch plan v2", APPROVED),
    );
    await api.file(topicId, await api.write("Launch plan v3", "March 12."));
    await api.file(topicId, await api.write("Launch ideas", "Maybe April."));
    // A draft that was never filed on the topic does not wait on it.
    await api.write("Launch plan scratch", "Not filed.");

    const body = await api.currentOf(limited, "launch plan");
    expect(body).toEqual({
      topics: [
        {
          id: topicId,
          name: "Launch plan",
          parentName: world.alpha.name,
          deciderName: owner.name,
          unreviewed: 2,
          current: {
            id: v2,
            title: "Launch plan v2",
            approvedAt: expect.any(String),
            approvedByName: owner.name,
            reason: REASON,
            editedSinceApproval: false,
            text: APPROVED,
          },
        },
      ],
    });
    // The text comes last, so an answer cut for length keeps what is above it.
    expect(Object.keys(body.topics[0] ?? {}).at(-1)).toBe("current");
    expect(Object.keys(body.topics[0]?.current ?? {}).at(-1)).toBe("text");

    // A topic is found by its id, or by its name inside a longer text.
    expect(await api.currentOf(limited, topicId)).toEqual(body);
    expect(
      await api.currentOf(limited, "What does the Launch Plan say?"),
    ).toEqual(body);
    // The form a query takes when a client builds it with URLSearchParams.
    const plus = await world.as(limited)(
      `/topic/workspace/${world.ws}/current?topic=launch+plan`,
    );
    expect(await plus.json()).toEqual(body);
    // Whole words only: "plan" is not "planet".
    expect(await api.currentOf(limited, "launch planet")).toEqual(NOTHING);
    expect(await api.currentOf(limited, "pricing")).toEqual(NOTHING);
  });

  it("serves the approved text, not a later edit", async () => {
    const world = await buildDocumentWorld();
    const api = reading(world);
    const topicId = await api.topic("Launch plan");
    const v2 = await api.approve(
      topicId,
      await api.write("Launch plan v2", APPROVED),
    );
    await api.edit(v2, "We launch whenever. Nobody approved this line.");

    const edited = (await api.currentOf(world.limited, topicId)).topics[0]
      ?.current;
    expect(edited).toMatchObject({
      id: v2,
      editedSinceApproval: true,
      text: APPROVED,
    });

    // With the approved text gone, the edit is still not passed off as it.
    await db
      .delete(schema.documentVersionTable)
      .where(eq(schema.documentVersionTable.documentId, v2));
    const lost = (await api.currentOf(world.limited, topicId)).topics[0]
      ?.current;
    expect(lost).toMatchObject({
      id: v2,
      editedSinceApproval: true,
      text: null,
    });
  });

  it("names every matching topic, and sends the text for one only", async () => {
    const world = await buildDocumentWorld();
    const api = reading(world);
    const plan = await api.topic("Launch plan");
    const europe = await api.topic("Launch plan Europe", {});
    const empty = await api.topic("Second launch plan");
    await api.approve(plan, await api.write("Launch plan v2", APPROVED));
    const eu = await api.approve(
      europe,
      await api.write("Europe plan", "Berlin first.", {}),
    );
    await api.file(empty, await api.write("Second try", "Waiting."));

    const several = (await api.currentOf(world.limited, "launch plan")).topics;
    expect(several.map((topic) => topic.name)).toEqual([
      "Launch plan",
      "Launch plan Europe",
      "Second launch plan",
    ]);
    expect(several.map((topic) => topic.current?.text ?? null)).toEqual([
      null,
      null,
      null,
    ]);
    expect(several.map((topic) => topic.current?.title ?? null)).toEqual([
      "Launch plan v2",
      "Europe plan",
      null,
    ]);
    // A topic with nothing approved says so, and says what waits.
    expect(several[2]).toMatchObject({ current: null, unreviewed: 1 });

    const one = (await api.currentOf(world.limited, europe)).topics;
    expect(one).toHaveLength(1);
    expect(one[0]?.current).toMatchObject({ id: eu, text: "Berlin first." });
  });

  it("answers a hidden topic like no topic", async () => {
    const world = await buildDocumentWorld();
    const { limited, open } = world;
    const api = reading(world);
    const inBeta = { projectId: world.beta.id };
    const pricing = await api.topic("Pricing", inBeta);
    await api.approve(
      pricing,
      await api.write("Pricing sheet", "40 per seat, secret.", inBeta),
    );
    await api.file(
      pricing,
      await api.write("Pricing rethink", "50 per seat, secret.", inBeta),
    );
    const hiringAlpha = await api.topic("Hiring plan");
    await api.topic("Hiring plan", inBeta);

    for (const read of [api.current, api.unreviewed]) {
      const answer = async (user: Member, topic: string) => {
        const response = await read(user, topic);
        return { status: response.status, body: await response.json() };
      };
      const nothing = await answer(limited, "a name nobody used");
      expect(nothing).toEqual({ status: 200, body: NOTHING });
      // By name, by words around the name, and by id.
      for (const hidden of ["Pricing", "the pricing topic", pricing]) {
        expect(await answer(limited, hidden)).toEqual(nothing);
      }
      expect(
        ((await answer(open, "pricing")).body as Current).topics,
      ).toHaveLength(1);

      // Two topics share a name. Only the one the person can open is named.
      const mine = ((await answer(limited, "hiring plan")).body as Current)
        .topics;
      expect(mine.map((topic) => topic.id)).toEqual([hiringAlpha]);
      expect(
        ((await answer(open, "hiring plan")).body as Current).topics,
      ).toHaveLength(2);
    }
  });

  it("lists what waits for a decision, without its text", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited } = world;
    const api = reading(world);
    const topicId = await api.topic("Launch plan");
    await api.approve(topicId, await api.write("Launch plan v1", "Old."));
    await api.approve(topicId, await api.write("Launch plan v2", APPROVED));
    const proposal = await api.file(
      topicId,
      await api.write("Launch plan v3", "UNAPPROVED-TEXT March 12."),
    );
    const idea = await api.file(
      topicId,
      await api.write("Launch ideas", "UNAPPROVED-TEXT maybe April."),
    );
    await api.discard(
      await api.file(topicId, await api.write("Launch typo", "Thrown away.")),
    );
    await api.write("Launch plan scratch", "Not filed.");

    const response = await api.unreviewed(limited, "launch plan");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("UNAPPROVED-TEXT");
    const body = JSON.parse(text) as Unreviewed;
    const waiting = (id: string, title: string) => ({
      id,
      title,
      kind: "unsorted",
      creatorName: owner.name,
      filedAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    // Newest first. The current, the replaced and the discarded are not here.
    expect(body).toEqual({
      topics: [
        {
          id: topicId,
          name: "Launch plan",
          parentName: world.alpha.name,
          deciderName: owner.name,
          documents: [
            waiting(idea, "Launch ideas"),
            waiting(proposal, "Launch plan v3"),
          ],
        },
      ],
    });
    expect((await api.currentOf(limited, topicId)).topics[0]?.unreviewed).toBe(
      2,
    );
  });

  it("refuses a request that names no topic", async () => {
    const world = await buildDocumentWorld();
    const api = reading(world);
    const base = `/topic/workspace/${world.ws}`;
    for (const route of ["current", "unreviewed"]) {
      expect((await world.as(world.limited)(`${base}/${route}`)).status).toBe(
        400,
      );
    }
    expect((await api.current(world.limited, "   ")).status).toBe(400);
    expect((await api.unreviewed(world.limited, "x".repeat(201))).status).toBe(
      400,
    );
  });

  it("lists current documents first in search", async () => {
    const world = await buildDocumentWorld();
    const api = reading(world);
    const topicId = await api.topic("Fish");
    // The current document matches in its text only and is older. The other
    // two match by title, and one of them is exactly the word.
    const current = await api.approve(
      topicId,
      await api.write("Field notes", "A zebrafish was seen once."),
    );
    const titled = await api.write("zebrafish sightings", "Many.");
    const exact = await api.write("zebrafish", "The word itself.");

    for (const type of ["documents", "all"]) {
      // With room for one result, it is the current document.
      const first = await api.search(world.limited, "zebrafish", type, 1);
      expect(first.map((result) => result.id)).toEqual([current]);
      const found = await api.search(world.limited, "zebrafish", type);
      expect(found.map((result) => result.id)).toEqual([
        current,
        exact,
        titled,
      ]);
      expect(found.map((result) => result.status)).toEqual([
        "current",
        "draft",
        "draft",
      ]);
    }
  });
});
