import { and, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { favoriteTable } from "../../apps/api/src/database/schema";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentPlace,
  type DocumentWorld,
  json,
  SEARCH_WORD,
} from "./helpers/document-access/build-document-world";

type Member = DocumentWorld["owner"];
type Row = { id: string; parentName: string | null };

// What each member may open. Every other document must look like it does not
// exist. A later step that adds a way in, or a place, changes this table.
const VISIBLE: Record<"limited" | "open", DocumentPlace[]> = {
  limited: [
    "sharedByName",
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

const places = (world: DocumentWorld) =>
  Object.keys(world.docs) as DocumentPlace[];
const ids = (world: DocumentWorld, wanted: DocumentPlace[]) =>
  wanted.map((place) => world.docs[place]).sort();
const hiddenFrom = (world: DocumentWorld, who: keyof typeof VISIBLE) =>
  places(world).filter((place) => !VISIBLE[who].includes(place));
const one = (world: DocumentWorld, place: DocumentPlace) =>
  `/document/workspace/${world.ws}/${world.docs[place]}`;

async function listed(world: DocumentWorld, user: Member, query = "") {
  const response = await world.as(user)(
    `/document/workspace/${world.ws}${query}`,
  );
  const body = (await response.json()) as unknown;
  return Array.isArray(body) ? (body as Row[]) : [];
}

async function searched(world: DocumentWorld, user: Member, type: string) {
  const response = await world.as(user)(
    `/search?q=${SEARCH_WORD}&workspaceId=${world.ws}&type=${type}&limit=50`,
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    results: { id: string; type: string; projectName?: string }[];
    totalCount: number;
  };
  return {
    totalCount: body.totalCount,
    teamNames: Object.fromEntries(
      body.results
        .filter((result) => result.type === "document" && result.projectName)
        .map((result) => [result.id, result.projectName]),
    ),
    documentIds: body.results
      .filter((result) => result.type === "document")
      .map((result) => result.id)
      .sort(),
  };
}

describe("API integration: document access leaks", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lists for each member exactly what they can open", async () => {
    const world = await buildDocumentWorld();
    const members: [Member, DocumentPlace[]][] = [
      [world.owner, places(world)],
      [world.limited, VISIBLE.limited],
      [world.open, VISIBLE.open],
    ];
    for (const [member, expected] of members) {
      const listedIds = (await listed(world, member)).map((row) => row.id);
      expect([...listedIds].sort()).toEqual(ids(world, expected));
      for (const place of places(world)) {
        const { status } = await world.as(member)(one(world, place));
        expect({ place, status }).toEqual({
          place,
          status: listedIds.includes(world.docs[place]) ? 200 : 404,
        });
      }
    }
  });

  it("keeps hidden documents out of every list filter, search and count", async () => {
    const world = await buildDocumentWorld();
    const hidden = ids(world, hiddenFrom(world, "limited"));
    // Both issues link every document. A link opens nothing, and the links of
    // an issue the member cannot open are not listed at all.
    const links = Object.values(world.docs)
      .map(
        (id) =>
          `<a href="https://tracker.example/dashboard/workspace/${world.ws}/document/${id}">x</a>`,
      )
      .join("");
    for (const task of [world.alphaTask, world.betaTask]) {
      const saved = await world.as(world.owner)(
        `/task/description/${task.id}`,
        json("PUT", { description: links }),
      );
      expect(saved.status).toBe(200);
    }
    const linkedToAlpha = await listed(
      world,
      world.limited,
      `?linkedTaskId=${world.alphaTask.id}`,
    );
    expect(linkedToAlpha.map((row) => row.id).sort()).toEqual(
      ids(world, VISIBLE.limited).sort(),
    );
    expect(
      await listed(world, world.limited, `?linkedTaskId=${world.betaTask.id}`),
    ).toEqual([]);
    const queries = [
      "",
      "?filter=recent",
      "?filter=mine",
      "?filter=shared",
      "?filter=unfiled",
      "?filter=inbox",
      "?filter=new",
      `?projectId=${world.beta.id}`,
      `?taskId=${world.betaTask.id}`,
      `?linkedTaskId=${world.alphaTask.id}`,
      `?linkedTaskId=${world.betaTask.id}`,
      `?workProjectId=${world.workProject.id}`,
      `?workProjectId=${world.betaProject.id}`,
    ];
    for (const query of queries) {
      const rows = await listed(world, world.limited, query);
      expect({
        query,
        leaked: rows.map((row) => row.id).filter((id) => hidden.includes(id)),
      }).toEqual({ query, leaked: [] });
    }

    const documents = await searched(world, world.limited, "documents");
    expect(documents.documentIds).toEqual(ids(world, VISIBLE.limited));
    expect(documents.totalCount).toBe(VISIBLE.limited.length);
    const everything = await searched(world, world.limited, "all");
    expect(everything.documentIds).toEqual(ids(world, VISIBLE.limited));
  });

  it("answers a hidden document like an unknown id on every route under it", async () => {
    const world = await buildDocumentWorld();
    const { limited, owner } = world;
    const base = `/document/workspace/${world.ws}`;
    const unknown = await world.as(limited)(`${base}/no-such-document`);
    expect(unknown.status).toBe(404);
    const unknownBody = await unknown.json();
    const hidden = hiddenFrom(world, "limited");

    for (const place of hidden) {
      const path = one(world, place);
      const opened = await world.as(limited)(path);
      expect({ place, status: opened.status }).toEqual({ place, status: 404 });
      expect(await opened.json()).toEqual(unknownBody);

      const comment = (await (
        await world.as(owner)(
          `${path}/comments`,
          json("POST", { content: "<p>first</p>" }),
        )
      ).json()) as { id: string };
      const [version] = await db
        .select({ id: schema.documentVersionTable.id })
        .from(schema.documentVersionTable)
        .where(eq(schema.documentVersionTable.documentId, world.docs[place]));
      expect(version).toBeDefined();

      const routes: [string, ReturnType<typeof json> | undefined][] = [
        ["", json("PATCH", { title: "taken" })],
        ["", json("DELETE")],
        ["/location", json("PUT", { scope: "private" })],
        ["/snooze", json("POST", { until: null })],
        ["/lineage", json("PUT", { status: "confirmed" })],
        ["/restore", json("POST")],
        ["/settle", json("POST", { choice: "discard" })],
        [`/share/${limited.id}`, json("PUT", { access: "edit" })],
        [`/share/${limited.id}`, json("DELETE")],
        ["/subscribers", json("PUT", { userIds: [limited.id] })],
        ["/audience", undefined],
        ["/audience?scope=workspace", undefined],
        ["/versions", undefined],
        [`/versions/${version?.id}/restore`, json("POST")],
        ["/comments", undefined],
        ["/comments", json("POST", { content: "<p>hello</p>" })],
        [`/comments/${comment.id}`, json("PATCH", { content: "<p>x</p>" })],
        [`/comments/${comment.id}`, json("DELETE")],
      ];
      for (const [suffix, init] of routes) {
        const response = await world.as(limited)(`${path}${suffix}`, init);
        expect({
          place,
          route: `${init?.method ?? "GET"} ${suffix}`,
          status: response.status,
        }).toEqual({
          place,
          route: `${init?.method ?? "GET"} ${suffix}`,
          status: 404,
        });
      }
    }

    // None of the refused calls changed anything.
    const untouched = await db
      .select({
        title: schema.documentTable.title,
        deletedAt: schema.documentTable.deletedAt,
        scope: schema.documentTable.scope,
      })
      .from(schema.documentTable)
      .where(inArray(schema.documentTable.id, ids(world, hidden)));
    expect(untouched).toHaveLength(hidden.length);
    for (const doc of untouched) {
      expect(doc.title.startsWith(SEARCH_WORD)).toBe(true);
      expect(doc.deletedAt).toBeNull();
      expect(doc.scope).not.toBe("workspace");
    }
    const shares = await db
      .select({ documentId: schema.documentShareTable.documentId })
      .from(schema.documentShareTable)
      .where(eq(schema.documentShareTable.userId, limited.id));
    expect(shares.map((row) => row.documentId).sort()).toEqual(
      ids(world, ["sharedByName", "sharedInBeta", "sharedInProjectBeta"]),
    );
  });

  it("sends no notification about a document the member cannot open", async () => {
    const world = await buildDocumentWorld();
    const { limited, owner } = world;
    const mention = `<p><kaneo-mention id="${limited.id}">@limited</kaneo-mention> look</p>`;
    for (const place of places(world)) {
      // As if they subscribed while they could still open it.
      await db
        .insert(schema.documentSubscriberTable)
        .values({ documentId: world.docs[place], userId: limited.id })
        .onConflictDoNothing();
      for (const content of [mention, "<p>an update</p>"]) {
        const response = await world.as(owner)(
          `${one(world, place)}/comments`,
          json("POST", { content }),
        );
        expect(response.status).toBe(200);
      }
    }
    const stored = await db
      .select({ resourceId: schema.notificationTable.resourceId })
      .from(schema.notificationTable)
      .where(
        and(
          eq(schema.notificationTable.userId, limited.id),
          eq(schema.notificationTable.resourceType, "document"),
        ),
      );
    expect([...new Set(stored.map((row) => row.resourceId))].sort()).toEqual(
      ids(world, VISIBLE.limited),
    );

    // A row written while they could still open the document stays unread.
    await db.insert(schema.notificationTable).values({
      userId: limited.id,
      type: "document_comment",
      title: "Someone commented",
      resourceId: world.docs.teamBeta,
      resourceType: "document",
    });
    for (const query of ["", `?workspaceId=${world.ws}`]) {
      const response = await world.as(limited)(`/notification${query}`);
      expect(response.status).toBe(200);
      const rows = (await response.json()) as {
        resourceId: string | null;
        resourceType: string | null;
      }[];
      const documentIds = rows
        .filter((row) => row.resourceType === "document")
        .map((row) => row.resourceId);
      expect({ query, ids: [...new Set(documentIds)].sort() }).toEqual({
        query,
        ids: ids(world, VISIBLE.limited),
      });
    }
  });

  it("refuses and hides a favourite of a document the member cannot open", async () => {
    const world = await buildDocumentWorld();
    const { limited } = world;
    const favorites = `/favorite/workspace/${world.ws}`;
    const favorite = (targetId: string) =>
      world.as(limited)(favorites, json("PUT", { type: "document", targetId }));
    const unknown = await favorite("no-such-document");
    expect(unknown.status).toBe(404);
    const unknownBody = await unknown.json();
    const hidden = hiddenFrom(world, "limited");
    for (const place of hidden) {
      const response = await favorite(world.docs[place]);
      expect({ place, status: response.status }).toEqual({
        place,
        status: 404,
      });
      expect(await response.json()).toEqual(unknownBody);
    }

    // Favourited while they could still open it.
    await db.insert(favoriteTable).values(
      ids(world, hidden).map((targetId) => ({
        userId: limited.id,
        workspaceId: world.ws,
        type: "document" as const,
        targetId,
      })),
    );
    expect((await favorite(world.docs.teamAlpha)).status).toBe(200);
    expect((await favorite(world.docs.sharedInBeta)).status).toBe(200);
    expect((await favorite(world.docs.sharedInProjectBeta)).status).toBe(200);
    const rows = (await (await world.as(limited)(favorites)).json()) as {
      type: string;
      targetId: string;
    }[];
    expect(
      rows
        .filter((row) => row.type === "document")
        .map((row) => row.targetId)
        .sort(),
    ).toEqual(ids(world, ["teamAlpha", "sharedInBeta", "sharedInProjectBeta"]));
  });

  it("does not name a team the member cannot enter", async () => {
    const world = await buildDocumentWorld();
    const parentNames = async (member: Member) => {
      const rows = await listed(world, member);
      const names = new Map<string, string | null>();
      for (const place of places(world)) {
        const row = rows.find(
          (candidate) => candidate.id === world.docs[place],
        );
        if (!row) continue;
        const opened = (await (
          await world.as(member)(one(world, place))
        ).json()) as Row;
        // The list row and the opened document give the same name.
        expect({ place, name: opened.parentName }).toEqual({
          place,
          name: row.parentName,
        });
        names.set(place, row.parentName);
      }
      return Object.fromEntries(names);
    };

    expect(await parentNames(world.limited)).toEqual({
      sharedByName: null,
      teamAlpha: "Alpha",
      issueAlpha: "alpha-1",
      project: "Launch",
      projectAlpha: "Alpha launch",
      workspace: null,
      // Opened through the share; team Beta itself stays unnamed.
      sharedInBeta: null,
      // Every member can list every project, so a project is always named.
      sharedInProjectBeta: "Beta launch",
    });
    expect(await parentNames(world.open)).toMatchObject({
      teamBeta: "Beta",
      issueBeta: "beta-1",
      projectBeta: "Beta launch",
      sharedInBeta: "Beta",
    });

    for (const type of ["documents", "all"]) {
      expect((await searched(world, world.limited, type)).teamNames).toEqual({
        [world.docs.teamAlpha]: "Alpha",
      });
    }
    expect((await searched(world, world.open, "documents")).teamNames).toEqual({
      [world.docs.teamAlpha]: "Alpha",
      [world.docs.teamBeta]: "Beta",
      [world.docs.sharedInBeta]: "Beta",
    });
  });

  it("gives a named share its own role, not the role of the place", async () => {
    const world = await buildDocumentWorld();
    const opened = async (member: Member, place: DocumentPlace) =>
      (await (await world.as(member)(one(world, place))).json()) as {
        role: string;
        shares: { userId: string; access: string }[];
      };
    const roles = async (who: "limited" | "open") => {
      const found: Record<string, string> = {};
      for (const place of VISIBLE[who]) {
        found[place] = (await opened(world[who], place)).role;
      }
      return found;
    };

    expect(await roles("limited")).toEqual({
      sharedByName: "view",
      teamAlpha: "edit",
      issueAlpha: "edit",
      project: "edit",
      projectAlpha: "edit",
      workspace: "edit",
      // Team Beta gives its members edit; the share alone gives view.
      sharedInBeta: "view",
      sharedInProjectBeta: "view",
    });
    expect(await roles("open")).toEqual({
      teamAlpha: "edit",
      teamBeta: "edit",
      issueAlpha: "edit",
      issueBeta: "edit",
      project: "edit",
      projectAlpha: "edit",
      projectBeta: "edit",
      workspace: "edit",
      sharedInBeta: "edit",
      sharedInProjectBeta: "edit",
    });
    for (const place of ["sharedInBeta", "sharedInProjectBeta"] as const) {
      const response = await world.as(world.limited)(
        one(world, place),
        json("PATCH", { title: "taken" }),
      );
      expect({ place, status: response.status }).toEqual({
        place,
        status: 403,
      });
    }

    // The share list of one document says nothing about any other document.
    for (const place of [
      "sharedByName",
      "sharedInBeta",
      "sharedInProjectBeta",
    ] as const) {
      expect((await opened(world.limited, place)).shares).toMatchObject([
        { userId: world.limited.id, access: "view" },
      ]);
    }
    expect((await opened(world.limited, "teamAlpha")).shares).toEqual([]);
  });

  it("keeps a topic, and what is filed on it, behind the place it lives in", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open, ws, docs } = world;
    const base = `/topic/workspace/${ws}`;
    const create = async (name: string, place: Record<string, string> = {}) =>
      (
        (await (
          await world.as(owner)(
            "/topic",
            json("POST", { workspaceId: ws, name, ...place }),
          )
        ).json()) as { id: string }
      ).id;
    const everyone = await create("Everyone");
    const alpha = await create("Alpha", { projectId: world.alpha.id });
    const beta = await create("Beta", { projectId: world.beta.id });
    const projectBeta = await create("Project Beta", {
      workProjectId: world.betaProject.id,
    });
    const names = async (user: Member) =>
      ((await (await world.as(user)(base)).json()) as { name: string }[]).map(
        (topic) => topic.name,
      );
    expect(await names(open)).toEqual([
      "Alpha",
      "Beta",
      "Everyone",
      "Project Beta",
    ]);
    expect(await names(limited)).toEqual(["Alpha", "Everyone"]);

    // The Beta topic has a current document and a replaced one. The current
    // one is shared with `limited` by name.
    const decide = (id: string, suffix: string, body?: unknown) =>
      world.as(owner)(
        `${base}/${beta}/document/${id}${suffix}`,
        json(suffix ? "POST" : "PUT", body),
      );
    for (const id of [docs.teamBeta, docs.sharedInBeta]) {
      expect((await decide(id, "")).status).toBe(200);
      expect((await decide(id, "/current", { reason: "Agreed." })).status).toBe(
        200,
      );
    }

    // Every topic route answers a hidden topic like an unknown one, whichever
    // document is named, and a hidden document like an unknown one.
    const routes: [string, ReturnType<typeof json> | undefined][] = [
      ["", undefined],
      ["", json("PATCH", { name: "taken" })],
      ["/document/DOC", json("PUT")],
      ["/document/DOC/current", json("POST", { reason: "Mine now." })],
      ["/document/DOC/confirm", json("POST")],
      ["/document/DOC/set-aside", json("POST")],
    ];
    const answer = async (
      topicId: string,
      documentId: string,
      [suffix, init]: (typeof routes)[number],
    ) => {
      const response = await world.as(limited)(
        `${base}/${topicId}${suffix.replace("DOC", documentId)}`,
        init,
      );
      return {
        route: `${init?.method ?? "GET"} ${suffix}`,
        status: response.status,
        body: await response.json(),
      };
    };
    for (const route of routes) {
      const unknownTopic = await answer("no-such-topic", docs.teamAlpha, route);
      expect(unknownTopic.status).toBe(404);
      for (const hiddenTopic of [beta, projectBeta]) {
        for (const documentId of [
          docs.teamAlpha,
          docs.sharedInBeta,
          docs.teamBeta,
          "no-such-document",
        ]) {
          expect(await answer(hiddenTopic, documentId, route)).toEqual(
            unknownTopic,
          );
        }
      }
      if (!route[0].includes("DOC")) continue;
      const unknownDocument = await answer(alpha, "no-such-document", route);
      expect(unknownDocument.status).toBe(404);
      for (const hiddenDocument of [docs.teamBeta, docs.private]) {
        expect(await answer(alpha, hiddenDocument, route)).toEqual(
          unknownDocument,
        );
      }
    }
    expect(await names(open)).toContain("Beta");

    // The two read routes find a topic by its name or its id. A hidden topic
    // answers like a name nobody used, whoever shared its current document.
    for (const route of ["current", "unreviewed"]) {
      const read = async (user: Member, topic: string) => {
        const response = await world.as(user)(
          `${base}/${route}?topic=${encodeURIComponent(topic)}`,
        );
        return { status: response.status, body: await response.json() };
      };
      const nothing = await read(limited, "a name nobody used");
      expect(nothing).toEqual({ status: 200, body: { topics: [] } });
      for (const hidden of ["Beta", beta, "Project Beta", projectBeta]) {
        expect(await read(limited, hidden)).toEqual(nothing);
      }
      const seen = (await read(open, "Beta")).body as {
        topics: { name: string }[];
      };
      expect(seen.topics.map((topic) => topic.name)).toEqual([
        "Beta",
        "Project Beta",
      ]);
    }

    // A share opens the document, not the topic it is filed on.
    const seen = async (user: Member) =>
      (await (await world.as(user)(one(world, "sharedInBeta"))).json()) as {
        status: string;
        topicId: string | null;
        topicName: string | null;
        supersedesDocumentId: string | null;
      };
    expect(await seen(open)).toMatchObject({
      status: "current",
      topicId: beta,
      topicName: "Beta",
      supersedesDocumentId: docs.teamBeta,
    });
    expect(await seen(limited)).toMatchObject({
      status: "current",
      topicId: null,
      topicName: null,
      supersedesDocumentId: null,
    });
    const filed = async (user: Member, topicId: string) =>
      (await listed(world, user, `?topicId=${topicId}`)).map((row) => row.id);
    expect((await filed(open, beta)).sort()).toEqual(
      ids(world, ["teamBeta", "sharedInBeta"]),
    );
    expect(await filed(limited, beta)).toEqual([]);
    expect(await filed(limited, "no-such-topic")).toEqual([]);
    expect(await filed(limited, everyone)).toEqual([]);
    const row = (await listed(world, limited)).find(
      (found) => found.id === docs.sharedInBeta,
    ) as { topicId?: string | null } | undefined;
    expect(row).toBeDefined();
    expect(row?.topicId).toBeNull();
  });
});
