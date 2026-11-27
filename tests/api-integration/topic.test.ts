import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

type Member = DocumentWorld["owner"];
type Topic = {
  id: string;
  name: string;
  scope: string;
  projectId: string | null;
  workProjectId: string | null;
  parentName: string | null;
  deciderId: string | null;
  deciderName: string | null;
  backupDeciderId: string | null;
  currentDocumentId: string | null;
  canDecide: boolean;
};
type Doc = {
  id: string;
  content: string;
  contentHash: string;
  status: string;
  scope: string;
  projectId: string | null;
  topicId: string | null;
  topicName: string | null;
  supersedesDocumentId: string | null;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  approvedHash: string | null;
  approvedVersionId: string | null;
  statusReason: string | null;
  filedAt: string | null;
  confirmedAt: string | null;
};

const REASON = "The launch date moved, and this one says so.";

function topics(world: DocumentWorld) {
  const { ws } = world;
  const base = `/topic/workspace/${ws}`;
  const doc = (id: string) => `/document/workspace/${ws}/${id}`;
  return {
    create: (user: Member, body: Record<string, unknown>) =>
      world.as(user)("/topic", json("POST", { workspaceId: ws, ...body })),
    list: (user: Member) => world.as(user)(base),
    get: (user: Member, id: string) => world.as(user)(`${base}/${id}`),
    update: (user: Member, id: string, body: Record<string, unknown>) =>
      world.as(user)(`${base}/${id}`, json("PATCH", body)),
    file: (user: Member, id: string, documentId: string) =>
      world.as(user)(`${base}/${id}/document/${documentId}`, json("PUT")),
    current: (
      user: Member,
      id: string,
      documentId: string,
      body: unknown = { reason: REASON },
    ) =>
      world.as(user)(
        `${base}/${id}/document/${documentId}/current`,
        json("POST", body),
      ),
    confirm: (user: Member, id: string, documentId: string) =>
      world.as(user)(
        `${base}/${id}/document/${documentId}/confirm`,
        json("POST"),
      ),
    setAside: (user: Member, id: string, documentId: string) =>
      world.as(user)(
        `${base}/${id}/document/${documentId}/set-aside`,
        json("POST"),
      ),
    document: async (user: Member, id: string) =>
      (await (await world.as(user)(doc(id))).json()) as Doc,
    edit: (user: Member, id: string, body: Record<string, unknown>) =>
      world.as(user)(doc(id), json("PATCH", body)),
    move: (user: Member, id: string, body: Record<string, unknown>) =>
      world.as(user)(`${doc(id)}/location`, json("PUT", body)),
    remove: (user: Member, id: string) =>
      world.as(user)(doc(id), json("DELETE")),
    // A topic in team Alpha, which every member of the world can open.
    alpha: async (body: Record<string, unknown> = {}) => {
      const response = await world.as(world.owner)(
        "/topic",
        json("POST", {
          workspaceId: ws,
          name: "Launch plan",
          projectId: world.alpha.id,
          ...body,
        }),
      );
      expect(response.status).toBe(200);
      return (await response.json()) as Topic;
    },
  };
}

const names = async (response: Response) =>
  ((await response.json()) as Topic[]).map((topic) => topic.name).sort();
const statusOf = async (response: Response | Promise<Response>) =>
  (await response).status;

describe("API integration: topics and the current document", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("keeps a topic in a place, and shows it to those who can open the place", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;
    const api = topics(world);

    const created = await api.create(owner, { name: "Pricing" });
    expect(created.status).toBe(200);
    const pricing = (await created.json()) as Topic;
    expect(pricing).toMatchObject({
      name: "Pricing",
      scope: "workspace",
      projectId: null,
      workProjectId: null,
      parentName: null,
      // Whoever creates a topic decides on it until someone else is named.
      deciderId: owner.id,
      deciderName: owner.name,
      backupDeciderId: null,
      currentDocumentId: null,
      canDecide: true,
    });
    const alpha = await api.alpha();
    expect(alpha).toMatchObject({
      scope: "team",
      projectId: world.alpha.id,
      parentName: "Alpha",
    });
    for (const [name, place] of [
      ["Hiring plan", { projectId: world.beta.id }],
      ["Beta launch", { workProjectId: world.betaProject.id }],
      ["Launch", { workProjectId: world.workProject.id }],
    ] as const) {
      expect(await statusOf(api.create(owner, { name, ...place }))).toBe(200);
    }

    const everything = [
      "Beta launch",
      "Hiring plan",
      "Launch",
      "Launch plan",
      "Pricing",
    ];
    expect(await names(await api.list(owner))).toEqual(everything);
    expect(await names(await api.list(open))).toEqual(everything);
    expect(await names(await api.list(limited))).toEqual([
      "Launch",
      "Launch plan",
      "Pricing",
    ]);
    const seen = (await (await api.get(limited, pricing.id)).json()) as Topic;
    expect(seen).toMatchObject({ name: "Pricing", canDecide: false });

    // A place the member cannot enter (answered like an unknown one), an
    // unknown place, a nameless topic and a place only a document can live in.
    expect(
      await statusOf(
        api.create(limited, { name: "Hidden", projectId: world.beta.id }),
      ),
    ).toBe(400);
    expect(
      await statusOf(
        api.create(owner, { name: "Nowhere", projectId: "no-such-team" }),
      ),
    ).toBe(400);
    expect(await statusOf(api.create(owner, { name: "  " }))).toBe(400);
    expect(
      await statusOf(api.create(owner, { name: "Mine", scope: "private" })),
    ).toBe(400);
  });

  it("names only a decider who can open the topic", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;
    const api = topics(world);
    const beta = { name: "Hiring plan", projectId: world.beta.id };

    // `limited` cannot enter team Beta.
    expect(
      await statusOf(api.create(owner, { ...beta, deciderId: limited.id })),
    ).toBe(400);
    expect(
      await statusOf(
        api.create(owner, { ...beta, backupDeciderId: limited.id }),
      ),
    ).toBe(400);
    expect(
      await statusOf(api.create(owner, { ...beta, deciderId: "no-such-user" })),
    ).toBe(400);
    const made = await api.create(owner, { ...beta, deciderId: open.id });
    expect(made.status).toBe(200);
    const topic = (await made.json()) as Topic;
    expect(topic).toMatchObject({ deciderId: open.id, canDecide: true });

    expect(
      await statusOf(api.update(owner, topic.id, { deciderId: limited.id })),
    ).toBe(400);
    expect(
      await statusOf(
        api.update(owner, topic.id, { backupDeciderId: limited.id }),
      ),
    ).toBe(400);
    // The backup is a second person.
    expect(
      await statusOf(api.update(owner, topic.id, { backupDeciderId: open.id })),
    ).toBe(400);

    const third = await addWorkspaceMember(world.ws);
    const named = await api.update(open, topic.id, {
      name: "Hiring",
      backupDeciderId: third.id,
    });
    expect(named.status).toBe(200);
    expect((await named.json()) as Topic).toMatchObject({
      name: "Hiring",
      deciderId: open.id,
      backupDeciderId: third.id,
    });
    // The backup approves; it does not rename the topic or replace the decider.
    expect(
      await statusOf(api.update(third, topic.id, { deciderId: third.id })),
    ).toBe(403);
    expect(await statusOf(api.update(third, topic.id, { name: "Mine" }))).toBe(
      403,
    );
    // Who may change the topic, and whom they may name.
    const manages = async (user: Member) =>
      ((await (await api.get(user, topic.id)).json()) as { canManage: boolean })
        .canManage;
    expect(await manages(open)).toBe(true);
    expect(await manages(owner)).toBe(true);
    expect(await manages(third)).toBe(false);
    const people = await world.as(open)(
      `/topic/workspace/${world.ws}/${topic.id}/deciders`,
    );
    expect(people.status).toBe(200);
    const ids = ((await people.json()) as { userId: string }[]).map(
      (person) => person.userId,
    );
    expect(ids).toEqual(expect.arrayContaining([owner.id, open.id, third.id]));
    // `limited` cannot enter team Beta, so cannot be named.
    expect(ids).not.toContain(limited.id);
    expect(
      (
        await world.as(limited)(
          `/topic/workspace/${world.ws}/${topic.id}/deciders`,
        )
      ).status,
    ).toBe(404);

    const cleared = await api.update(owner, topic.id, {
      backupDeciderId: null,
    });
    expect((await cleared.json()) as Topic).toMatchObject({
      name: "Hiring",
      backupDeciderId: null,
    });
  });

  it("files a document on a topic and moves it to the topic's place", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open, docs } = world;
    const api = topics(world);
    const alpha = await api.alpha();

    const filed = await api.file(owner, alpha.id, docs.private);
    expect(filed.status).toBe(200);
    const proposal = (await filed.json()) as Doc;
    expect(proposal).toMatchObject({
      id: docs.private,
      scope: "team",
      projectId: world.alpha.id,
      status: "in_review",
      topicId: alpha.id,
      topicName: "Launch plan",
      approvedAt: null,
    });
    expect(proposal.filedAt).not.toBeNull();
    // It now has the topic's audience.
    expect((await api.document(limited, docs.private)).status).toBe(
      "in_review",
    );

    // An editor who is not the author may file it; a viewer may not.
    expect(await statusOf(api.file(open, alpha.id, docs.teamBeta))).toBe(200);
    expect(await statusOf(api.file(limited, alpha.id, docs.sharedByName))).toBe(
      403,
    );
    expect((await api.document(owner, docs.sharedByName)).topicId).toBeNull();

    const list = await world.as(limited)(
      `/document/workspace/${world.ws}?topicId=${alpha.id}`,
    );
    const rows = (await list.json()) as Doc[];
    expect(rows.map((row) => row.id).sort()).toEqual(
      [docs.private, docs.teamBeta].sort(),
    );
    expect(rows.every((row) => row.topicId === alpha.id)).toBe(true);

    // Filing again on another topic moves the proposal there.
    const pricing = (await (
      await api.create(owner, { name: "Pricing" })
    ).json()) as Topic;
    const moved = (await (
      await api.file(owner, pricing.id, docs.private)
    ).json()) as Doc;
    expect(moved).toMatchObject({
      scope: "workspace",
      projectId: null,
      status: "in_review",
      topicId: pricing.id,
    });
  });

  it("makes one document current and supersedes the last one in the same step", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open, docs } = world;
    const api = topics(world);
    const backup = await addWorkspaceMember(world.ws);
    const topic = await api.alpha({
      deciderId: open.id,
      backupDeciderId: backup.id,
    });
    const [first, second, third] = [
      docs.teamAlpha,
      docs.teamBeta,
      docs.project,
    ];
    for (const id of [first, second, third]) {
      expect(await statusOf(api.file(owner, topic.id, id))).toBe(200);
    }

    // Not the decider, no reason, and a document that is not on the topic.
    expect(await statusOf(api.current(limited, topic.id, first))).toBe(403);
    expect(await statusOf(api.current(open, topic.id, first, {}))).toBe(400);
    expect(
      await statusOf(api.current(open, topic.id, first, { reason: "   " })),
    ).toBe(400);
    expect(await statusOf(api.current(open, topic.id, docs.workspace))).toBe(
      404,
    );
    expect((await api.document(owner, first)).status).toBe("in_review");

    const approved = await api.current(open, topic.id, first);
    expect(approved.status).toBe(200);
    const current = (await approved.json()) as Doc;
    expect(current).toMatchObject({
      status: "current",
      approvedById: open.id,
      approvedByName: open.name,
      approvedHash: current.contentHash,
      statusReason: REASON,
      supersedesDocumentId: null,
      confirmedAt: null,
    });
    expect(current.approvedAt).not.toBeNull();
    const [pinned] = await db
      .select()
      .from(schema.documentVersionTable)
      .where(
        eq(schema.documentVersionTable.id, current.approvedVersionId ?? ""),
      );
    expect(pinned).toMatchObject({
      documentId: first,
      authorId: open.id,
      content: current.content,
    });
    expect(
      (await (await api.get(owner, topic.id)).json()) as Topic,
    ).toMatchObject({ currentDocumentId: first, hasReplaced: false });

    // The backup decider replaces it.
    const replaced = (await (
      await api.current(backup, topic.id, second)
    ).json()) as Doc;
    expect(replaced).toMatchObject({
      status: "current",
      approvedById: backup.id,
      supersedesDocumentId: first,
    });
    expect(await api.document(owner, first)).toMatchObject({
      status: "superseded",
      statusReason: REASON,
    });
    // So does the workspace owner, who decides on no topic by name.
    expect(await statusOf(api.current(owner, topic.id, third))).toBe(200);
    expect(
      await Promise.all(
        [first, second, third].map(
          async (id) => (await api.document(owner, id)).status,
        ),
      ),
    ).toEqual(["superseded", "superseded", "current"]);
    expect(
      (await (await api.get(limited, topic.id)).json()) as Topic,
    ).toMatchObject({
      currentDocumentId: third,
      canDecide: false,
      hasReplaced: true,
    });
    // A replaced document does not come back.
    expect(await statusOf(api.current(open, topic.id, first))).toBe(409);

    // The database holds the promise whatever the code does.
    let refusedBy: string | undefined;
    try {
      await db.execute(
        sql`UPDATE document SET status = 'current' WHERE id = ${second}`,
      );
    } catch (error) {
      const { cause, constraint } = error as {
        cause?: { constraint?: string };
        constraint?: string;
      };
      refusedBy = cause?.constraint ?? constraint;
    }
    expect(refusedBy).toBe("one_current");
  });

  it("keeps the approved text when the approver goes on editing", async () => {
    const world = await buildDocumentWorld();
    const { owner, docs } = world;
    const api = topics(world);
    const topic = await api.alpha();
    await api.file(owner, topic.id, docs.teamAlpha);
    const approved = (await (
      await api.current(owner, topic.id, docs.teamAlpha)
    ).json()) as Doc;
    expect(approved.approvedHash).toBe(approved.contentHash);

    // The same author, inside the window that folds edits into one version.
    const edited = (await (
      await api.edit(owner, docs.teamAlpha, { content: "<p>Changed</p>" })
    ).json()) as Doc;
    expect(edited.status).toBe("current");
    expect(edited.approvedVersionId).toBe(approved.approvedVersionId);
    expect(edited.approvedHash).toBe(approved.approvedHash);
    expect(edited.contentHash).not.toBe(edited.approvedHash);
    const version = async (id: string | null) =>
      (
        await db
          .select({ content: schema.documentVersionTable.content })
          .from(schema.documentVersionTable)
          .where(eq(schema.documentVersionTable.id, id ?? ""))
      )[0]?.content;
    expect(await version(approved.approvedVersionId)).toBe(approved.content);

    // Approving again pins the new text and replaces nothing.
    const again = (await (
      await api.current(owner, topic.id, docs.teamAlpha, {
        reason: "Wording only.",
      })
    ).json()) as Doc;
    expect(again).toMatchObject({
      status: "current",
      approvedHash: edited.contentHash,
      statusReason: "Wording only.",
      supersedesDocumentId: null,
    });
    expect(again.approvedVersionId).not.toBe(approved.approvedVersionId);
    expect(await version(again.approvedVersionId)).toBe("<p>Changed</p>");
    expect(await version(approved.approvedVersionId)).toBe(approved.content);
  });

  // An edit can land between opening the approval and pressing the button.
  it("refuses an approval of text the approver did not read", async () => {
    const world = await buildDocumentWorld();
    const { owner, docs } = world;
    const api = topics(world);
    const topic = await api.alpha();
    await api.file(owner, topic.id, docs.teamAlpha);
    const read = await api.document(owner, docs.teamAlpha);
    await api.edit(owner, docs.teamAlpha, { content: "<p>Changed</p>" });

    expect(
      await statusOf(
        api.current(owner, topic.id, docs.teamAlpha, {
          reason: REASON,
          contentHash: read.contentHash,
        }),
      ),
    ).toBe(409);
    const untouched = await api.document(owner, docs.teamAlpha);
    expect(untouched).toMatchObject({
      status: "in_review",
      approvedHash: null,
    });
    expect(untouched.contentHash).not.toBe(read.contentHash);

    const approved = await api.current(owner, topic.id, docs.teamAlpha, {
      reason: REASON,
      contentHash: untouched.contentHash,
    });
    expect(approved.status).toBe(200);
    expect(((await approved.json()) as Doc).approvedHash).toBe(
      untouched.contentHash,
    );
  });

  it("confirms the current document, and sets it aside", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open, docs } = world;
    const api = topics(world);
    const topic = await api.alpha({ deciderId: open.id });
    await api.file(owner, topic.id, docs.teamAlpha);

    expect(await statusOf(api.confirm(open, topic.id, docs.teamAlpha))).toBe(
      409,
    );
    expect(await statusOf(api.setAside(open, topic.id, docs.teamAlpha))).toBe(
      409,
    );
    await api.current(open, topic.id, docs.teamAlpha);
    expect(await statusOf(api.confirm(limited, topic.id, docs.teamAlpha))).toBe(
      403,
    );
    expect(
      await statusOf(api.setAside(limited, topic.id, docs.teamAlpha)),
    ).toBe(403);

    const confirmed = await api.confirm(open, topic.id, docs.teamAlpha);
    expect(confirmed.status).toBe(200);
    const still = (await confirmed.json()) as Doc;
    expect(still.status).toBe("current");
    expect(still.confirmedAt).not.toBeNull();

    const aside = await api.setAside(open, topic.id, docs.teamAlpha);
    expect(aside.status).toBe(200);
    expect((await aside.json()) as Doc).toMatchObject({
      status: "in_review",
      topicId: topic.id,
      approvedById: null,
      approvedAt: null,
      approvedHash: null,
      approvedVersionId: null,
      statusReason: null,
      confirmedAt: null,
    });
    expect(
      (await (await api.get(owner, topic.id)).json()) as Topic,
    ).toMatchObject({ currentDocumentId: null });
  });

  it("guards current and superseded documents", async () => {
    const world = await buildDocumentWorld();
    const { owner, docs } = world;
    const api = topics(world);
    const topic = await api.alpha();
    const [old, live, proposal] = [docs.teamAlpha, docs.teamBeta, docs.project];
    for (const id of [old, live, proposal]) {
      await api.file(owner, topic.id, id);
    }
    await api.current(owner, topic.id, old);

    // The current document stays where its topic is, and stays.
    for (const target of [
      { scope: "private" },
      { scope: "workspace" },
      { scope: "team", projectId: world.beta.id },
    ]) {
      expect({
        target,
        status: await statusOf(api.move(owner, old, target)),
      }).toEqual({ target, status: 409 });
    }
    expect(await statusOf(api.remove(owner, old))).toBe(409);
    expect(await statusOf(api.file(owner, topic.id, old))).toBe(409);
    expect(await api.document(owner, old)).toMatchObject({
      status: "current",
      scope: "team",
      projectId: world.alpha.id,
    });

    await api.current(owner, topic.id, live);
    // A superseded document is a record: no edit, no restore, no move.
    expect(
      await statusOf(api.edit(owner, old, { content: "<p>Rewritten</p>" })),
    ).toBe(409);
    expect(await statusOf(api.edit(owner, old, { kind: "decision" }))).toBe(
      409,
    );
    const [version] = await db
      .insert(schema.documentVersionTable)
      .values({ documentId: old, title: "Earlier", content: "<p>Earlier</p>" })
      .returning({ id: schema.documentVersionTable.id });
    expect(
      await statusOf(
        world.as(owner)(
          `/document/workspace/${world.ws}/${old}/versions/${version?.id}/restore`,
          json("POST"),
        ),
      ),
    ).toBe(409);
    expect(await statusOf(api.move(owner, old, { scope: "workspace" }))).toBe(
      409,
    );
    expect(await statusOf(api.file(owner, topic.id, old))).toBe(409);
    expect((await api.document(owner, old)).content).toBe("<p>teamAlpha</p>");
    // Once another document is current, the old one may go.
    expect(await statusOf(api.remove(owner, old))).toBe(200);

    // A proposal that moves away leaves its topic.
    const moved = await api.move(owner, proposal, { scope: "workspace" });
    expect(moved.status).toBe(200);
    expect((await moved.json()) as Doc).toMatchObject({
      scope: "workspace",
      status: "draft",
      topicId: null,
      filedAt: null,
    });
  });

  it("lets the decider edit the topic's current document", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open, docs } = world;
    const api = topics(world);
    const topic = await api.alpha({ deciderId: open.id });
    const id = docs.teamAlpha;
    await api.edit(owner, id, { generalAccess: "view" });
    await api.file(owner, topic.id, id);
    const write = (user: Member) =>
      statusOf(api.edit(user, id, { content: `<p>${user.id}</p>` }));

    expect(await write(open)).toBe(403);
    await api.current(open, topic.id, id);
    expect(await write(limited)).toBe(403);
    expect(await write(open)).toBe(200);
    expect((await api.document(owner, id)).content).toBe(`<p>${open.id}</p>`);
  });
});
