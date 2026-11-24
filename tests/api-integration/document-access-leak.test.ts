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
    const queries = [
      "",
      "?filter=recent",
      "?filter=mine",
      "?filter=shared",
      `?projectId=${world.beta.id}`,
      `?taskId=${world.betaTask.id}`,
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
        ["/restore", json("POST")],
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
});
