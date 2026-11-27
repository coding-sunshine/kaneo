import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  favoriteTable,
  statementTable,
  topicTable,
} from "../../apps/api/src/database/schema";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentPlace,
  type DocumentWorld,
  json,
  SEARCH_WORD,
} from "./helpers/document-access/build-document-world";
import { filing, type Said, type Statement } from "./helpers/statement-filing";

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

type Flag = { id: string; cause: unknown; task: { id: string } | null };

const RIPPLE_DATE: Said = {
  slot: "launch_date",
  value: "2027-03-05",
  quote: "5 March 2027",
};
const rippleCodename: Said = {
  slot: "codename",
  value: "Falcon",
  quote: "Falcon",
};
const ripplePrice = (amount: number): Said => ({
  slot: "price",
  value: String(amount),
  quote: `${amount} USD`,
});
const rippleText = (saids: Said[]) =>
  saids.map((s) => `<p>We state ${s.quote}.</p>`).join("");

// A topic whose current "Launch plan" states a price of 40, plus the calls
// that link work to it, list the flags and clear one.
async function rippleSetup() {
  const world = await buildDocumentWorld();
  const { ws, owner } = world;
  const api = filing(world);
  const ok = async (response: Response) =>
    expect(response.status, await response.clone().text()).toBe(200);
  const confirmAll = async (docId: string, saids: Said[]) => {
    const made: Statement[] = [];
    for (const said of saids) {
      const statement = await api.add(docId, said);
      await ok(await api.decide(docId, statement.id, "confirm"));
      made.push(statement);
    }
    return made;
  };
  const topicId = await api.topic();
  for (const [name, type] of [
    ["Launch date", "date"],
    ["Price", "number"],
    ["Codename", "term"],
  ]) {
    await api.addSlot(topicId, { name, type });
  }
  const docId = await api.filed(
    topicId,
    "Launch plan",
    rippleText([RIPPLE_DATE, ripplePrice(40), rippleCodename]),
  );
  const [, cost] = await confirmAll(docId, [RIPPLE_DATE, ripplePrice(40)]);
  await ok(await api.approve(topicId, docId));

  const replace = async () => {
    const saids = [RIPPLE_DATE, ripplePrice(45)];
    const id = await api.filed(topicId, "Launch plan v2", rippleText(saids));
    await confirmAll(id, saids);
    for (const conflict of (await api.receipt(id)).conflicts) {
      await ok(
        await api.settleConflict(id, conflict.id, {
          decision: "replace",
          reason: "Changed.",
        }),
      );
    }
    await ok(await api.approve(topicId, id));
  };
  const depend = (
    on: string,
    statementId: string,
    body: Record<string, unknown>,
    user: Member = owner,
  ) =>
    world.as(user)(
      `/document/workspace/${ws}/${on}/statements/${statementId}/dependents`,
      json("PUT", body),
    );
  const remove = (
    on: string,
    statementId: string,
    dependencyId: string,
    user: Member = owner,
  ) =>
    world.as(user)(
      `/document/workspace/${ws}/${on}/statements/${statementId}/dependents/${dependencyId}`,
      json("DELETE"),
    );
  const flags = async (user: Member = owner) => {
    const response = await world.as(user)(
      `/topic/workspace/${ws}/needs-review`,
    );
    expect(response.status).toBe(200);
    return (await response.json()) as { items: Flag[] };
  };
  const clear = (id: string, user: Member = owner) =>
    world.as(user)(
      `/topic/workspace/${ws}/needs-review/${id}/clear`,
      json("POST"),
    );
  // Moves the document into team Beta, which `limited` cannot enter.
  const hide = (id: string) =>
    db
      .update(schema.documentTable)
      .set({ projectId: world.beta.id })
      .where(eq(schema.documentTable.id, id));
  return {
    world,
    api,
    topicId,
    docId,
    cost,
    confirmAll,
    ok,
    replace,
    depend,
    remove,
    flags,
    clear,
    hide,
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

  it("answers the file of a hidden document like an unknown file", async () => {
    const world = await buildDocumentWorld();
    const request = world.as(world.limited);
    const unknown = await request("/asset/no-such-file");
    const unknownBody = await unknown.json();

    for (const place of hiddenFrom(world, "limited")) {
      const [file] = await db
        .insert(schema.assetTable)
        .values({
          workspaceId: world.ws,
          documentId: world.docs[place],
          objectKey: randomUUID(),
          filename: "notes.pdf",
          mimeType: "application/pdf",
          size: 3,
          kind: "attachment",
          surface: "document",
          createdBy: world.owner.id,
        })
        .returning();
      const fetched = await request(`/asset/${file?.id}`);
      expect({ place, status: fetched.status }).toEqual({
        place,
        status: unknown.status,
      });
      expect(await fetched.json()).toEqual(unknownBody);
    }
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
        [`/task/${world.alphaTask.id}/audience`, undefined],
        [`/task/${world.alphaTask.id}/share`, json("PUT")],
        [`/task/${world.alphaTask.id}/share`, json("DELETE")],
        ["/versions", undefined],
        [`/versions/${version?.id}/restore`, json("POST")],
        ["/comments", undefined],
        ["/comments", json("POST", { content: "<p>hello</p>" })],
        [`/comments/${comment.id}`, json("PATCH", { content: "<p>x</p>" })],
        [`/comments/${comment.id}`, json("DELETE")],
        ["/statements", undefined],
        ["/statements", json("POST", { slot: "s", value: "v", quote: place })],
        ["/statements/no-such-statement/confirm", json("POST")],
        [
          "/statements/no-such-statement/reject",
          json("POST", { reason: "No." }),
        ],
        ["/receipt", undefined],
        [
          "/conflicts/no-such-conflict/decide",
          json("POST", { decision: "keep", reason: "No." }),
        ],
        ["/statements/x/dependents", json("PUT", { taskId: "x" })],
        ["/statements/x/dependents/y", json("DELETE")],
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

  // A pin on the Documents page is a favorite of its own type, with the same rule.
  it.each(["document", "documentPin"] as const)(
    "refuses and hides a %s favorite of a document the member cannot open",
    async (type) => {
      const world = await buildDocumentWorld();
      const { limited } = world;
      const favorites = `/favorite/workspace/${world.ws}`;
      const favorite = (targetId: string) =>
        world.as(limited)(favorites, json("PUT", { type, targetId }));
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
          type,
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
          .filter((row) => row.type === type)
          .map((row) => row.targetId)
          .sort(),
      ).toEqual(
        ids(world, ["teamAlpha", "sharedInBeta", "sharedInProjectBeta"]),
      );
    },
  );

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

    // The Beta topic keeps one fact, and its current document states it.
    const slotsOf = async (user: Member, topicId: string) =>
      (await world.as(user)(`${base}/${topicId}/slots`)).json();
    const slot = (await (
      await world.as(owner)(
        `${base}/${beta}/slots`,
        json("POST", { name: "Codename", type: "term" }),
      )
    ).json()) as { id: string; key: string };
    expect(slot.key).toBe("codename");
    const said = {
      slot: "codename",
      value: "sharedInBeta",
      quote: "sharedInBeta",
    };
    const statements = `${one(world, "sharedInBeta")}/statements`;
    const statement = (await (
      await world.as(owner)(statements, json("POST", said))
    ).json()) as { id: string };
    expect(statement.id).toBeTruthy();

    // Every topic route answers a hidden topic like an unknown one, whichever
    // document is named, and a hidden document like an unknown one.
    const routes: [string, ReturnType<typeof json> | undefined][] = [
      ["", undefined],
      ["", json("PATCH", { name: "taken" })],
      ["/slots", undefined],
      ["/slots", json("POST", { name: "Taken", type: "date" })],
      [`/slots/${slot.id}`, json("DELETE")],
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
    expect(await slotsOf(open, beta)).toMatchObject([{ key: "codename" }]);

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

    // A statement names a slot of the topic. To someone the document is
    // shared with who cannot open the topic, the document has no statements,
    // like one that is on no topic, even when they may edit it.
    const call = async (
      user: Member,
      path: string,
      init?: ReturnType<typeof json>,
    ) => {
      const response = await world.as(user)(path, init);
      return { status: response.status, body: await response.json() };
    };
    const unfiled = `${one(world, "sharedByName")}/statements`;
    expect((await call(open, statements)).body).toMatchObject([
      { id: statement.id, slot: "codename", slotName: "Codename" },
    ]);
    for (const id of [docs.sharedInBeta, docs.sharedByName]) {
      const shared = await world.as(owner)(
        `/document/workspace/${ws}/${id}/share/${limited.id}`,
        json("PUT", { access: "edit" }),
      );
      expect(shared.status).toBe(200);
    }
    expect(await call(limited, statements)).toEqual({ status: 200, body: [] });
    // The comparison with the topic names its slots, so it is empty too.
    expect(
      (await call(open, `${one(world, "sharedInBeta")}/receipt`)).body,
    ).toMatchObject({
      new: [{ slot: "codename" }],
    });
    expect(
      await call(limited, `${one(world, "sharedInBeta")}/receipt`),
    ).toEqual({
      status: 200,
      body: {
        repeats: [],
        new: [],
        conflicts: [],
        unjudged: [],
        notChecked: [],
      },
    });
    const refused = await call(limited, unfiled, json("POST", said));
    expect(refused.status).toBe(409);
    expect(await call(limited, statements, json("POST", said))).toEqual(
      refused,
    );
    for (const [verb, body] of [
      ["confirm", undefined],
      ["reject", { reason: "No." }],
    ] as const) {
      const unknown = await call(
        limited,
        `${statements}/no-such-statement/${verb}`,
        json("POST", body),
      );
      expect(unknown.status).toBe(404);
      expect(
        await call(
          limited,
          `${statements}/${statement.id}/${verb}`,
          json("POST", body),
        ),
      ).toEqual(unknown);
    }
    const [kept] = await db
      .select({ status: statementTable.status })
      .from(statementTable)
      .where(eq(statementTable.id, statement.id));
    expect(kept?.status).toBe("proposed");
    expect(await call(open, statements)).toMatchObject({
      body: [{ id: statement.id, status: "proposed" }],
    });
  });

  it("does not show what a hidden current document states through a comparison", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open, ws, docs } = world;
    const topics = `/topic/workspace/${ws}`;
    const doc = (id: string) => `/document/workspace/${ws}/${id}`;
    const call = async (
      user: Member,
      path: string,
      init?: ReturnType<typeof json>,
    ) => {
      const response = await world.as(user)(path, init);
      return { status: response.status, body: await response.json() };
    };
    const done = async (path: string, init: ReturnType<typeof json>) => {
      const { status, body } = await call(owner, path, init);
      expect({ path, status }).toEqual({ path, status: 200 });
      return body;
    };

    // `limited` decides on a topic in team Alpha. Its current document will
    // end up in team Beta, which `limited` cannot enter.
    const { id: topicId } = await done(
      "/topic",
      json("POST", {
        workspaceId: ws,
        name: "Price",
        projectId: world.alpha.id,
        deciderId: limited.id,
      }),
    );
    await done(
      `${topics}/${topicId}/slots`,
      json("POST", { name: "Price", type: "number" }),
    );
    const state = async (id: string, amount: number) => {
      await done(
        doc(id),
        json("PATCH", {
          content: `<p>The price is ${amount} USD per seat.</p>`,
        }),
      );
      await done(`${topics}/${topicId}/document/${id}`, json("PUT"));
      return (await done(
        `${doc(id)}/statements`,
        json("POST", {
          slot: "price",
          value: String(amount),
          quote: `${amount} USD`,
        }),
      )) as { id: string };
    };
    const receipt = `${doc(docs.teamAlpha)}/receipt`;
    const approve = (user: Member) =>
      call(
        user,
        `${topics}/${topicId}/document/${docs.teamAlpha}/current`,
        json("POST", { reason: "Agreed." }),
      );
    const settle = (user: Member, id: string) =>
      call(
        user,
        `${doc(docs.teamAlpha)}/conflicts/${id}/decide`,
        json("POST", { decision: "keep", reason: "Still 40." }),
      );

    // What the topic answers for its slots, as `user` reads it.
    const answers = async (user: Member) =>
      (
        (await call(user, `${topics}/current?topic=${topicId}`)).body as {
          topics: { answers: Record<string, unknown>[] }[];
        }
      ).topics[0].answers;

    await state(docs.teamAlpha, 45);
    const alone = await call(limited, receipt);
    expect(alone.body).toMatchObject({
      new: [{ slot: "price", value: "45" }],
      conflicts: [],
    });
    const unanswered = await answers(limited);
    expect(unanswered).toMatchObject([
      {
        slot: "price",
        value: null,
        quote: null,
        documentId: null,
        approvedByName: null,
        proposedIn: [{ id: docs.teamAlpha }],
      },
    ]);

    const hidden = await state(docs.teamBeta, 40);
    // Filing moves a document into its topic's place, so no route leaves a
    // document where someone who can open the topic cannot open it. The row
    // is moved by hand: the rule has to hold the day a route does.
    await db
      .update(schema.documentTable)
      .set({ projectId: world.beta.id })
      .where(eq(schema.documentTable.id, docs.teamBeta));
    expect((await world.as(limited)(doc(docs.teamBeta))).status).toBe(404);

    // A hidden document that waits for a decision is not named.
    expect(await answers(limited)).toEqual(unanswered);
    expect(await answers(open)).toMatchObject([
      {
        value: null,
        proposedIn: expect.arrayContaining([
          expect.objectContaining({ id: docs.teamBeta }),
          expect.objectContaining({ id: docs.teamAlpha }),
        ]),
      },
    ]);

    await done(
      `${doc(docs.teamBeta)}/statements/${hidden.id}/confirm`,
      json("POST"),
    );
    await done(
      `${topics}/${topicId}/document/${docs.teamBeta}/current`,
      json("POST", { reason: "Agreed." }),
    );

    // A hidden current document answers nothing: `limited` reads the same as
    // when nothing was approved, `open` reads the value and its quote.
    expect(await answers(limited)).toEqual(unanswered);
    expect(await answers(open)).toMatchObject([
      {
        slot: "price",
        value: "40",
        quote: "40 USD",
        documentId: docs.teamBeta,
        proposedIn: [{ id: docs.teamAlpha }],
      },
    ]);

    // Someone who can open both documents sees the conflict and both quotes.
    const seen = await call(open, receipt);
    expect(seen.body).toMatchObject({
      new: [],
      conflicts: [
        {
          slot: "price",
          value: "45",
          quote: "45 USD",
          status: "open",
          current: { documentId: docs.teamBeta, value: "40", quote: "40 USD" },
        },
      ],
    });
    const conflictId = (seen.body as { conflicts: { id: string }[] })
      .conflicts[0].id;
    expect((await settle(open, conflictId)).status).toBe(403);

    // To `limited` the topic still states no price: the same answer as before
    // the hidden document became current, and no conflict to decide on.
    expect(await call(limited, receipt)).toEqual(alone);
    const unknown = await settle(limited, "no-such-conflict");
    expect(unknown.status).toBe(404);
    expect(await settle(limited, conflictId)).toEqual(unknown);
    expect(await call(open, receipt)).toEqual(seen);

    // An approval is held back only by a conflict the approver can see. A
    // refusal would tell `limited` that a hidden document says otherwise.
    expect((await approve(owner)).status).toBe(409);
    expect((await approve(limited)).status).toBe(200);
  });

  it("hides an issue's file in a team the member cannot open", async () => {
    const world = await buildDocumentWorld();
    const { limited, open, betaTask, beta } = world;
    const [file] = await db
      .insert(schema.assetTable)
      .values({
        workspaceId: world.ws,
        projectId: beta.id,
        taskId: betaTask.id,
        objectKey: randomUUID(),
        filename: "notes.pdf",
        mimeType: "application/pdf",
        size: 3,
        kind: "attachment",
        surface: "attachment",
        createdBy: world.owner.id,
      })
      .returning();
    const topic = await world.as(world.owner)(
      "/topic",
      json("POST", { workspaceId: world.ws, name: "Everyone" }),
    );
    const { id: topicId } = (await topic.json()) as { id: string };
    await world.as(world.owner)(
      `/topic/workspace/${world.ws}/${topicId}/task/${betaTask.id}`,
      json("PUT"),
    );
    const base = `/document/workspace/${world.ws}/issue-files`;
    const call = async (user: Member, id: string, route: string) => {
      const response = await world.as(user)(
        route === "audience"
          ? `${base}/${id}/audience?topicId=${topicId}`
          : `${base}/${id}/propose`,
        route === "audience" ? undefined : json("POST", { topicId }),
      );
      return { status: response.status, body: await response.text() };
    };

    const documents = (await db.select().from(schema.documentTable)).length;
    const listedFor = async (user: Member) =>
      ((await (await world.as(user)(base)).json()) as { id: string }[]).map(
        (row) => row.id,
      );
    expect(await listedFor(limited)).not.toContain(file?.id);
    expect(await listedFor(open)).toContain(file?.id);
    for (const route of ["audience", "propose"]) {
      const invented = await call(limited, "no-such-asset", route);
      expect(invented.status).toBe(404);
      expect(await call(limited, file?.id ?? "", route)).toEqual(invented);
    }
    expect((await db.select().from(schema.documentTable)).length).toBe(
      documents,
    );
  });

  it("shows a flag only to someone who can open the replaced document", async () => {
    const s = await rippleSetup();
    const { world, docId, cost } = s;
    const { owner, limited } = world;
    await s.ok(await s.depend(docId, cost.id, { taskId: world.alphaTask.id }));
    await s.replace();

    const seen = (await s.flags(limited)).items;
    expect(seen).toHaveLength(1);
    await s.hide(docId);

    expect(await s.flags(limited)).toEqual({ items: [] });
    expect((await s.clear(seen[0].id, limited)).status).toBe(404);
    expect((await s.flags(owner)).items).toHaveLength(1);
  });

  it("hides a flag on an issue the member cannot open", async () => {
    const s = await rippleSetup();
    const { world, docId, cost } = s;
    const { owner, limited } = world;
    await s.ok(await s.depend(docId, cost.id, { taskId: world.betaTask.id }));
    await s.replace();

    const [flag] = (await s.flags(owner)).items;
    expect((await s.flags(owner)).items).toHaveLength(1);
    expect(await s.flags(limited)).toEqual({ items: [] });
    expect((await s.clear(flag.id, limited)).status).toBe(404);
    expect((await s.flags(owner)).items).toHaveLength(1);
  });

  it("hides a flag on a document the member cannot open", async () => {
    const s = await rippleSetup();
    const { world, api, docId, cost } = s;
    const { owner, limited } = world;
    const memo = await api.write("Pricing memo", "<p>Memo.</p>");
    await s.hide(memo);
    const opened = await world.as(limited)(
      `/document/workspace/${world.ws}/${memo}`,
    );
    expect(opened.status).toBe(404);
    await s.ok(await s.depend(docId, cost.id, { documentId: memo }));
    await s.replace();

    const [flag] = (await s.flags(owner)).items;
    expect((await s.flags(owner)).items).toHaveLength(1);
    expect(await s.flags(limited)).toEqual({ items: [] });
    expect((await s.clear(flag.id, limited)).status).toBe(404);
    expect((await s.flags(owner)).items).toHaveLength(1);
  });

  it("withholds the cause of a flag that came down a chain when the cause's document is hidden", async () => {
    const s = await rippleSetup();
    const { world, api, docId, cost } = s;
    const { owner, limited } = world;
    const other = await api.topic("Pricing");
    await api.addSlot(other, { name: "Codename", type: "term" });
    const d = await api.filed(
      other,
      "Pricing memo",
      rippleText([rippleCodename]),
    );
    const [t] = await s.confirmAll(d, [rippleCodename]);
    await s.ok(await api.approve(other, d));
    await s.ok(await s.depend(docId, cost.id, { documentId: d }));
    await s.ok(await s.depend(d, t.id, { taskId: world.alphaTask.id }));
    await s.replace();

    const seen = (await s.flags(limited)).items;
    expect(seen).toHaveLength(2);
    await s.hide(docId);

    // The memo's flag relies on a statement of the hidden document: gone.
    // The issue's flag relies on the memo, which the member can open: it
    // stays so they can review their work, and says nothing of the cause.
    const left = await s.flags(limited);
    expect(left.items).toHaveLength(1);
    const [flag] = left.items;
    expect(flag.task?.id).toBe(world.alphaTask.id);
    expect(flag.cause).toBeNull();
    for (const secret of [docId, cost.id, "Launch plan", "40 USD"]) {
      expect(JSON.stringify(left)).not.toContain(secret);
    }
    expect((await s.flags(owner)).items).toHaveLength(2);
    for (const { id } of seen) {
      expect((await s.clear(id, limited)).status).toBe(
        id === flag.id ? 200 : 404,
      );
    }
    expect((await s.flags(limited)).items).toEqual([]);
    expect((await s.flags(owner)).items).toHaveLength(1);
  });

  it("refuses a link to work or a statement the member cannot open", async () => {
    const s = await rippleSetup();
    const { world, docId, cost } = s;
    const { limited } = world;

    expect(
      (await s.depend(docId, cost.id, { taskId: world.betaTask.id }, limited))
        .status,
    ).toBe(404);
    expect(
      (
        await s.depend(
          docId,
          cost.id,
          { documentId: world.docs.teamBeta },
          limited,
        )
      ).status,
    ).toBe(404);
    expect(
      (await s.depend(docId, cost.id, { taskId: world.alphaTask.id }, limited))
        .status,
    ).toBe(200);

    const made = (await (
      await s.depend(docId, cost.id, { taskId: world.betaTask.id })
    ).json()) as { id: string };
    const hidden = await s.remove(docId, cost.id, made.id, limited);
    const unknown = await s.remove(docId, cost.id, "no-such-id", limited);
    expect(unknown.status).toBe(404);
    expect(hidden.status).toBe(404);
    expect(await hidden.text()).toBe(await unknown.text());

    await s.hide(docId);
    expect(
      (await s.depend(docId, cost.id, { taskId: world.alphaTask.id }, limited))
        .status,
    ).toBe(404);
  });

  it("hides a flag when the document it relies on or that document's topic is hidden, and only its cause when the cause's topic is", async () => {
    const s = await rippleSetup();
    const { world, api, topicId, docId, cost } = s;
    const { limited } = world;
    const other = await api.topic("Pricing");
    await api.addSlot(other, { name: "Codename", type: "term" });
    const d = await api.filed(
      other,
      "Pricing memo",
      rippleText([rippleCodename]),
    );
    const [t] = await s.confirmAll(d, [rippleCodename]);
    await s.ok(await api.approve(other, d));
    await s.ok(await s.depend(docId, cost.id, { documentId: d }));
    await s.ok(await s.depend(d, t.id, { taskId: world.alphaTask.id }));
    await s.replace();
    // Two flags: the memo relies on the old price, the issue relies on the
    // memo. A filed document always lives where its topic does, so each end
    // is hidden by hand, one at a time, and put back.
    const place = (
      table: typeof schema.documentTable | typeof topicTable,
      id: string,
    ) => ({
      to: (project: { id: string }) =>
        db.update(table).set({ projectId: project.id }).where(eq(table.id, id)),
    });
    const works = async () =>
      (await s.flags(limited)).items.map((flag) =>
        flag.task ? "issue" : "memo",
      );
    expect((await works()).sort()).toEqual(["issue", "memo"]);

    // The memo: it is the flagged work of one flag and the document the
    // other relies on.
    await place(schema.documentTable, d).to(world.beta);
    expect(await works()).toEqual([]);
    await place(schema.documentTable, d).to(world.alpha);
    expect(await works()).toHaveLength(2);

    // The memo's topic: only the issue relies on a statement of it.
    await place(topicTable, other).to(world.beta);
    expect(await works()).toEqual(["memo"]);
    await place(topicTable, other).to(world.alpha);
    expect(await works()).toHaveLength(2);

    // The topic of the cause: the memo relies on a statement of it, so its
    // flag goes. The issue relies on the memo, so its flag stays, unnamed.
    await place(topicTable, topicId).to(world.beta);
    const left = await s.flags(limited);
    expect(left.items.map((flag) => [flag.task?.id, flag.cause])).toEqual([
      [world.alphaTask.id, null],
    ]);
    for (const secret of [docId, cost.id, topicId, "40 USD"]) {
      expect(JSON.stringify(left)).not.toContain(secret);
    }
  });

  it("answers a hidden team, project or issue like an unknown one when placing a document", async () => {
    const world = await buildDocumentWorld();
    const { limited } = world;
    const create = (parent: Record<string, string>) =>
      world.as(limited)(
        "/document",
        json("POST", { workspaceId: world.ws, title: "Placed", ...parent }),
      );
    const move = (parent: Record<string, string>) =>
      world.as(limited)(
        `/document/workspace/${world.ws}/${world.docs.teamAlpha}/location`,
        json("PUT", parent),
      );
    for (const [hidden, unknown] of [
      [
        { scope: "team", projectId: world.beta.id },
        { scope: "team", projectId: "no-such-team" },
      ],
      [
        { scope: "issue", taskId: world.betaTask.id },
        { scope: "issue", taskId: "no-such-issue" },
      ],
      [
        { scope: "project", workProjectId: world.betaProject.id },
        { scope: "project", workProjectId: "no-such-project" },
      ],
    ] as const) {
      for (const send of [create, move]) {
        const missing = await send(unknown);
        const refused = await send(hidden);
        expect({ hidden, status: refused.status }).toEqual({
          hidden,
          status: missing.status,
        });
        expect(await refused.json()).toEqual(await missing.json());
      }
    }
  });
});
