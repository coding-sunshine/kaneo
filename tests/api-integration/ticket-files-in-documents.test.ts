import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { mockAnonymousSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { createTaskFixture } from "./helpers/project-access/create-task-fixture";

const m = vi.hoisted(() => ({
  copyToDocumentFile: vi.fn(),
  getPrivateObject: vi.fn(),
}));
vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  copyToDocumentFile: m.copyToDocumentFile,
  getPrivateObject: m.getPrivateObject,
}));

type Member = DocumentWorld["owner"];
type Request = ReturnType<DocumentWorld["as"]>;
type Doc = {
  id: string;
  title: string;
  status: string;
  scope: string;
  projectId: string | null;
  workProjectId: string | null;
  taskId: string | null;
  topicId: string | null;
  creatorId: string | null;
  content: string;
};
type IssueFile = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  url: string;
  task: {
    id: string;
    title: string;
    number: number;
    projectId: string;
    projectSlug: string;
  };
  topics: { id: string; name: string; proposedDocumentId: string | null }[];
};
type Audience = {
  current: { userId: string; name: string; image: string | null }[];
  proposed: { userId: string; name: string; image: string | null }[];
};

const REASON = "The first version is the one to use.";

describe("API integration: issue files in documents", () => {
  let world: DocumentWorld;
  let copies: number;
  let tick: number;

  const base = () => `/document/workspace/${world.ws}/issue-files`;
  const topicBase = () => `/topic/workspace/${world.ws}`;

  const answer = async (response: Response) => ({
    status: response.status,
    body: await response.text(),
  });

  // An issue's own file, as an upload on the issue leaves it.
  const issueFile = async (
    task: { id: string },
    team: { id: string },
    over: Partial<typeof schema.assetTable.$inferInsert> = {},
  ) => {
    const [row] = await db
      .insert(schema.assetTable)
      .values({
        workspaceId: world.ws,
        projectId: team.id,
        taskId: task.id,
        objectKey: `issue/${randomUUID()}`,
        filename: "notes.pdf",
        mimeType: "application/pdf",
        size: 3,
        kind: "attachment",
        surface: "attachment",
        createdBy: world.owner.id,
        // Newer than the file before it, so the order never depends on timing.
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, ++tick)),
        ...over,
      })
      .returning();
    if (!row) throw new Error("The file was not stored");
    return row;
  };
  const alphaFile = (
    over: Partial<typeof schema.assetTable.$inferInsert> = {},
  ) => issueFile(world.alphaTask, world.alpha, over);
  const betaFile = (
    over: Partial<typeof schema.assetTable.$inferInsert> = {},
  ) => issueFile(world.betaTask, world.beta, over);

  const makeTopic = async (body: Record<string, unknown> = {}) => {
    const response = await world.as(world.owner)(
      "/topic",
      json("POST", { workspaceId: world.ws, name: "Launch plan", ...body }),
    );
    expect(response.status).toBe(200);
    return ((await response.json()) as { id: string }).id;
  };
  const alphaTopic = (body: Record<string, unknown> = {}) =>
    makeTopic({ projectId: world.alpha.id, ...body });
  const betaTopic = (body: Record<string, unknown> = {}) =>
    makeTopic({ name: "Beta plan", projectId: world.beta.id, ...body });
  const link = async (topicId: string, taskId: string) => {
    const response = await world.as(world.owner)(
      `${topicBase()}/${topicId}/task/${taskId}`,
      json("PUT"),
    );
    expect(response.status).toBe(200);
  };

  const list = (user: Member, query = "") =>
    world.as(user)(`${base()}${query}`);
  const listed = async (user: Member, query = "") => {
    const response = await list(user, query);
    expect(response.status).toBe(200);
    return (await response.json()) as IssueFile[];
  };
  const audience = (
    user: Member,
    assetId: string,
    topicId: string | undefined,
  ) =>
    world.as(user)(
      `${base()}/${assetId}/audience${topicId === undefined ? "" : `?topicId=${topicId}`}`,
    );
  const propose = (
    user: Member,
    assetId: string,
    topicId: string,
    request: Request = world.as(user),
  ) => request(`${base()}/${assetId}/propose`, json("POST", { topicId }));
  const proposed = async (user: Member, assetId: string, topicId: string) => {
    const response = await propose(user, assetId, topicId);
    expect(response.status).toBe(200);
    return (await response.json()) as Doc;
  };

  const counts = async () => ({
    documents: (await db.select().from(schema.documentTable)).length,
    assets: (await db.select().from(schema.assetTable)).length,
    files: (await db.select().from(schema.documentFileTable)).length,
  });
  // Nothing created and nothing copied by the call `run` makes.
  const untouched = async (run: () => Promise<unknown>) => {
    const before = await counts();
    await run();
    expect(await counts()).toEqual(before);
    expect(m.copyToDocumentFile).not.toHaveBeenCalled();
  };

  const withKey = async (
    permissions: Record<string, string[]>,
    run: (request: Request) => Promise<Response>,
  ) => {
    const { key } = await auth.api.createApiKey({
      body: { userId: world.owner.id, name: "Issue files", permissions },
    });
    const request = ((path: string, init?: RequestInit) => {
      const asOwner = world.as(world.owner);
      mockAnonymousSession();
      return asOwner(path, {
        ...init,
        headers: { ...init?.headers, "x-api-key": key },
      } as never);
    }) as Request;
    return run(request);
  };

  beforeEach(async () => {
    await resetTestDatabase();
    world = await buildDocumentWorld();
    copies = 0;
    tick = 0;
    m.copyToDocumentFile.mockReset();
    m.copyToDocumentFile.mockImplementation(
      async () => `workspace/${world.ws}/copied-${++copies}-${randomUUID()}`,
    );
    m.getPrivateObject.mockReset();
    m.getPrivateObject.mockResolvedValue({
      body: new Uint8Array([1, 2, 3]),
      contentType: "application/pdf",
      contentLength: 3,
    });
  });

  describe("the list", () => {
    it("lists issue files newest first, with their issue and topics", async () => {
      const first = await alphaFile({ filename: "first.pdf" });
      const second = await betaFile({ filename: "second.pdf", size: 7 });
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);

      const rows = await listed(world.owner);

      expect(rows.map((row) => row.id)).toEqual([second.id, first.id]);
      expect(rows[0]).toMatchObject({
        id: second.id,
        filename: "second.pdf",
        mimeType: "application/pdf",
        size: 7,
        task: {
          id: world.betaTask.id,
          title: "Beta issue",
          number: world.betaTask.number,
          projectId: world.beta.id,
          projectSlug: "beta",
        },
        topics: [],
      });
      expect(rows[0]?.url.endsWith(`/asset/${second.id}`)).toBe(true);
      expect(Number.isNaN(Date.parse(rows[0]?.createdAt ?? ""))).toBe(false);
      expect(rows[1]?.topics).toEqual([
        { id: topic, name: "Launch plan", proposedDocumentId: null },
      ]);
    });

    it("leaves out what is not an issue file", async () => {
      const wanted = await alphaFile();
      await alphaFile({ kind: "image", surface: "description" });
      await alphaFile({ surface: "draft" });
      await alphaFile({ surface: "draft-pending" });
      const [own] = await db
        .insert(schema.assetTable)
        .values({
          workspaceId: world.ws,
          documentId: world.docs.teamAlpha,
          objectKey: `document/${randomUUID()}`,
          filename: "notes.pdf",
          mimeType: "application/pdf",
          size: 3,
          kind: "attachment",
          surface: "document",
          createdBy: world.owner.id,
        })
        .returning();
      expect(own).toBeDefined();

      expect((await listed(world.owner)).map((row) => row.id)).toEqual([
        wanted.id,
      ]);
    });

    it("leaves out the files of issues the asker cannot open, and of other workspaces", async () => {
      const inAlpha = await alphaFile();
      const inBeta = await betaFile();
      const other = await createWorkspaceMember();
      const otherTeam = await createProjectFixture({
        workspaceId: other.workspace.id,
      });
      const otherTask = await createTaskFixture(
        otherTeam,
        "Other issue",
        other.user.id,
      );
      await db.insert(schema.assetTable).values({
        workspaceId: other.workspace.id,
        projectId: otherTeam.project.id,
        taskId: otherTask.id,
        objectKey: `issue/${randomUUID()}`,
        filename: "notes.pdf",
        mimeType: "application/pdf",
        size: 3,
        kind: "attachment",
        surface: "attachment",
      });

      expect((await listed(world.limited)).map((row) => row.id)).toEqual([
        inAlpha.id,
      ]);
      expect((await listed(world.open)).map((row) => row.id).sort()).toEqual(
        [inAlpha.id, inBeta.id].sort(),
      );
    });

    it("names the topics of the issue that the asker can open, and no others", async () => {
      const file = await alphaFile();
      const shown = await alphaTopic();
      const hidden = await betaTopic();
      await link(shown, world.alphaTask.id);
      await link(hidden, world.alphaTask.id);

      const names = async (user: Member) =>
        (await listed(user))[0]?.topics.map((topic) => topic.id).sort();

      expect(await names(world.open)).toEqual([shown, hidden].sort());
      expect(await names(world.limited)).toEqual([shown]);
      expect((await listed(world.limited))[0]?.id).toBe(file.id);
    });

    it("gives the document made from the file on that topic, and null once it is gone", async () => {
      const file = await alphaFile();
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);
      const doc = await proposed(world.owner, file.id, topic);

      const topicsOf = async (user: Member) => (await listed(user))[0]?.topics;
      expect(await topicsOf(world.limited)).toEqual([
        { id: topic, name: "Launch plan", proposedDocumentId: doc.id },
      ]);

      // A document the asker cannot open is not named.
      await db
        .update(schema.documentTable)
        .set({ scope: "private", projectId: null })
        .where(eq(schema.documentTable.id, doc.id));
      expect((await topicsOf(world.limited))?.[0]?.proposedDocumentId).toBe(
        null,
      );
      await db
        .update(schema.documentTable)
        .set({ scope: "team", projectId: world.alpha.id })
        .where(eq(schema.documentTable.id, doc.id));
      expect((await topicsOf(world.limited))?.[0]?.proposedDocumentId).toBe(
        doc.id,
      );

      const trashed = await world.as(world.owner)(
        `/document/workspace/${world.ws}/${doc.id}`,
        json("DELETE"),
      );
      expect(trashed.status).toBe(200);
      expect((await topicsOf(world.owner))?.[0]?.proposedDocumentId).toBe(null);
    });

    it("narrows the list to the issues linked to a topic", async () => {
      const linked = await alphaFile();
      await betaFile();
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);

      expect(
        (await listed(world.owner, `?topicId=${topic}`)).map((row) => row.id),
      ).toEqual([linked.id]);
      const unlinked = await alphaTopic();
      expect(await listed(world.owner, `?topicId=${unlinked}`)).toEqual([]);
    });

    it("answers a topic the asker cannot open like an invented topic", async () => {
      await alphaFile();
      const hidden = await betaTopic();
      await link(hidden, world.alphaTask.id);

      const invented = await answer(
        await list(world.limited, `?topicId=${randomUUID()}`),
      );
      const refused = await answer(
        await list(world.limited, `?topicId=${hidden}`),
      );

      expect(invented.status).toBe(404);
      expect(refused).toEqual(invented);
      expect((await list(world.open, `?topicId=${hidden}`)).status).toBe(200);
    });

    it("needs a login and the right to read issues", async () => {
      await alphaFile();
      const request = world.as(world.owner);
      mockAnonymousSession();

      expect((await request(base())).status).toBe(401);
      expect(
        (await withKey({ project: ["read"] }, (key) => key(base()))).status,
      ).toBe(403);
      expect(
        (await withKey({ task: ["read"] }, (key) => key(base()))).status,
      ).toBe(200);
    });
  });

  describe("the audience", () => {
    const ids = (people: { userId: string }[]) =>
      people.map((person) => person.userId).sort();
    const everyone = () =>
      [world.owner.id, world.limited.id, world.open.id].sort();

    it("tells who can open the issue now and who can open the topic", async () => {
      const file = await betaFile();
      const topic = await makeTopic({ name: "Everyone" });
      await link(topic, world.betaTask.id);

      const response = await audience(world.open, file.id, topic);

      expect(response.status).toBe(200);
      const { current, proposed: after } = (await response.json()) as Audience;
      expect(ids(current)).toEqual([world.owner.id, world.open.id].sort());
      expect(ids(after)).toEqual(everyone());
      expect(current[0]).toHaveProperty("name");
      expect(current[0]).toHaveProperty("image");
    });

    it("counts only the members who can open a team topic", async () => {
      const file = await alphaFile();
      const topic = await betaTopic();
      await link(topic, world.alphaTask.id);

      const { current, proposed: after } = (await (
        await audience(world.owner, file.id, topic)
      ).json()) as Audience;

      expect(ids(current)).toEqual(everyone());
      expect(ids(after)).toEqual([world.owner.id, world.open.id].sort());
    });

    it("answers what is not an issue file the asker can open like an invented asset", async () => {
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);
      await link(topic, world.betaTask.id);
      const other = await createWorkspaceMember();
      const otherTeam = await createProjectFixture({
        workspaceId: other.workspace.id,
      });
      const otherTask = await createTaskFixture(
        otherTeam,
        "Other issue",
        other.user.id,
      );
      const [foreign] = await db
        .insert(schema.assetTable)
        .values({
          workspaceId: other.workspace.id,
          projectId: otherTeam.project.id,
          taskId: otherTask.id,
          objectKey: `issue/${randomUUID()}`,
          filename: "notes.pdf",
          mimeType: "application/pdf",
          size: 3,
          kind: "attachment",
          surface: "attachment",
        })
        .returning();
      const [own] = await db
        .insert(schema.assetTable)
        .values({
          workspaceId: world.ws,
          documentId: world.docs.teamAlpha,
          objectKey: `document/${randomUUID()}`,
          filename: "notes.pdf",
          mimeType: "application/pdf",
          size: 3,
          kind: "attachment",
          surface: "document",
        })
        .returning();
      const hidden = [
        (await betaFile()).id,
        (await alphaFile({ kind: "image", surface: "description" })).id,
        (await alphaFile({ surface: "draft" })).id,
        own?.id ?? "",
        foreign?.id ?? "",
      ];

      const invented = await answer(
        await audience(world.limited, randomUUID(), topic),
      );
      expect(invented.status).toBe(404);
      for (const id of hidden) {
        expect(await answer(await audience(world.limited, id, topic))).toEqual(
          invented,
        );
      }
    });

    it("answers a hidden topic and an unlinked topic like an invented topic", async () => {
      const file = await alphaFile();
      const hidden = await betaTopic();
      await link(hidden, world.alphaTask.id);
      const unlinked = await alphaTopic();

      const invented = await answer(
        await audience(world.limited, file.id, randomUUID()),
      );
      expect(invented.status).toBe(404);
      expect(
        await answer(await audience(world.limited, file.id, hidden)),
      ).toEqual(invented);
      expect(
        await answer(await audience(world.limited, file.id, unlinked)),
      ).toEqual(invented);
    });

    it("needs a login", async () => {
      const file = await alphaFile();
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);
      const request = world.as(world.owner);
      mockAnonymousSession();

      const response = await request(
        `${base()}/${file.id}/audience?topicId=${topic}`,
      );

      expect(response.status).toBe(401);
    });
  });

  describe("proposing a file", () => {
    it("makes an in-review document in the topic's place, titled with the file's name", async () => {
      const file = await alphaFile();
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);

      const doc = await proposed(world.open, file.id, topic);

      expect(doc).toMatchObject({
        title: "notes.pdf",
        status: "in_review",
        topicId: topic,
        scope: "team",
        projectId: world.alpha.id,
        workProjectId: null,
        taskId: null,
        creatorId: world.open.id,
      });
    });

    it("takes the place of a topic in a project and of a workspace topic", async () => {
      const file = await betaFile();
      const wide = await makeTopic({ name: "Everyone" });
      const inProject = await makeTopic({
        name: "In a project",
        workProjectId: world.betaProject.id,
      });
      await link(wide, world.betaTask.id);
      await link(inProject, world.betaTask.id);

      expect(await proposed(world.owner, file.id, wide)).toMatchObject({
        scope: "workspace",
        projectId: null,
        workProjectId: null,
      });
      expect(await proposed(world.owner, file.id, inProject)).toMatchObject({
        scope: "project",
        projectId: null,
        workProjectId: world.betaProject.id,
      });
    });

    it("writes one attachment line for a file that is not an image", async () => {
      const file = await alphaFile({ filename: "Plan v2.pdf", size: 1234 });
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);

      const doc = await proposed(world.owner, file.id, topic);

      const [copy] = await db
        .select()
        .from(schema.assetTable)
        .where(eq(schema.assetTable.documentId, doc.id));
      expect(copy?.id).not.toBe(file.id);
      expect(doc.content).toMatch(
        new RegExp(
          `^<kaneo-attachment url="[^"]*/asset/${copy?.id}" filename="Plan v2.pdf" mime-type="application/pdf" size="1234" />$`,
        ),
      );
    });

    it("writes an image line for an image file", async () => {
      const file = await alphaFile({
        filename: "shot.png",
        mimeType: "image/png",
        kind: "image",
        surface: "attachment",
      });
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);

      const doc = await proposed(world.owner, file.id, topic);

      const [copy] = await db
        .select()
        .from(schema.assetTable)
        .where(eq(schema.assetTable.documentId, doc.id));
      expect(copy).toMatchObject({ kind: "image", mimeType: "image/png" });
      expect(doc.content).toMatch(
        new RegExp(`^!\\[shot\\.png\\]\\([^)]*/asset/${copy?.id}\\)$`),
      );
      expect(doc.content).not.toContain("<kaneo-attachment");
    });

    it("stores the copy as the document's own file and keeps the issue's file", async () => {
      const file = await alphaFile({ size: 42 });
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);
      m.copyToDocumentFile.mockResolvedValueOnce("copied/key-1");

      const doc = await proposed(world.open, file.id, topic);

      const [copy] = await db
        .select()
        .from(schema.assetTable)
        .where(eq(schema.assetTable.documentId, doc.id));
      expect(copy).toMatchObject({
        workspaceId: world.ws,
        documentId: doc.id,
        taskId: null,
        projectId: null,
        surface: "document",
        kind: "attachment",
        mimeType: "application/pdf",
        size: 42,
        createdBy: world.open.id,
        objectKey: "copied/key-1",
      });
      expect(copy?.id).not.toBe(file.id);
      expect(
        await db
          .select()
          .from(schema.documentFileTable)
          .where(eq(schema.documentFileTable.documentId, doc.id)),
      ).toMatchObject([
        {
          assetId: copy?.id,
          originalName: "notes.pdf",
          sourceClient: "web",
          sourceUserId: world.open.id,
          sourceUrl: `/api/asset/${file.id}`,
        },
      ]);
      const [kept] = await db
        .select()
        .from(schema.assetTable)
        .where(eq(schema.assetTable.id, file.id));
      expect(kept).toEqual(file);
    });

    it("copies the object once, from the issue's key", async () => {
      const file = await alphaFile();
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);

      const doc = await proposed(world.owner, file.id, topic);

      expect(m.copyToDocumentFile).toHaveBeenCalledTimes(1);
      expect(m.copyToDocumentFile).toHaveBeenCalledWith({
        sourceKey: file.objectKey,
        workspaceId: world.ws,
        documentId: doc.id,
        filename: "notes.pdf",
        contentType: "application/pdf",
      });
    });

    it("takes the type from the document allow-list, by the file's name", async () => {
      const file = await alphaFile({
        filename: "sheet.xlsx",
        mimeType: "application/octet-stream",
      });
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);

      const doc = await proposed(world.owner, file.id, topic);

      const [copy] = await db
        .select()
        .from(schema.assetTable)
        .where(eq(schema.assetTable.documentId, doc.id));
      expect(copy?.mimeType).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    });

    // The Inbox holds documents in a shared place that have no topic yet. An
    // issue's file is never one of them: before it is proposed it is not a
    // document, and after it the document is on its topic.
    it("tells the topic's followers, lists the proposal under the topic and never in the Inbox", async () => {
      const file = await alphaFile({ filename: "plan.pdf" });
      const topic = await alphaTopic({ deciderId: world.open.id });
      await link(topic, world.alphaTask.id);
      const rows = async (query: string) => {
        const response = await world.as(world.open)(
          `/document/workspace/${world.ws}?${query}`,
        );
        expect(response.status).toBe(200);
        return (await response.json()) as { id: string; title: string }[];
      };
      const titles = async (query: string) =>
        (await rows(query)).map((row) => row.title);
      expect(await titles("filter=inbox")).not.toContain("plan.pdf");
      expect(await titles(`topicId=${topic}`)).not.toContain("plan.pdf");

      const doc = await proposed(world.limited, file.id, topic);

      expect((await rows(`topicId=${topic}`)).map((row) => row.id)).toContain(
        doc.id,
      );
      expect(await titles("filter=inbox")).not.toContain("plan.pdf");
      const told = await db
        .select()
        .from(schema.notificationTable)
        .where(
          and(
            eq(schema.notificationTable.userId, world.owner.id),
            eq(schema.notificationTable.type, "document_proposed"),
          ),
        );
      expect(told).toHaveLength(1);
      expect(told[0]).toMatchObject({
        resourceType: "document",
        resourceId: doc.id,
      });
    });

    it("lets a member who cannot open the issue's team read the copy and not the original", async () => {
      const file = await betaFile();
      const topic = await makeTopic({ name: "Everyone" });
      await link(topic, world.betaTask.id);
      const doc = await proposed(world.owner, file.id, topic);
      const [copy] = await db
        .select()
        .from(schema.assetTable)
        .where(eq(schema.assetTable.documentId, doc.id));

      const read = await world.as(world.limited)(
        `/document/workspace/${world.ws}/${doc.id}`,
      );
      const served = await world.as(world.limited)(`/asset/${copy?.id}`);
      m.getPrivateObject.mockClear();
      const original = await answer(
        await world.as(world.limited)(`/asset/${file.id}`),
      );

      expect(read.status).toBe(200);
      expect(served.status).toBe(200);
      // The asset route's own answer for an issue's file in a closed team.
      expect(original.status).toBe(403);
      expect(m.getPrivateObject).not.toHaveBeenCalled();
    });

    it("answers what is not an issue file the asker can open like an invented asset, and makes nothing", async () => {
      const topic = await makeTopic({ name: "Everyone" });
      await link(topic, world.alphaTask.id);
      await link(topic, world.betaTask.id);
      const other = await createWorkspaceMember();
      const otherTeam = await createProjectFixture({
        workspaceId: other.workspace.id,
      });
      const otherTask = await createTaskFixture(
        otherTeam,
        "Other issue",
        other.user.id,
      );
      const [foreign] = await db
        .insert(schema.assetTable)
        .values({
          workspaceId: other.workspace.id,
          projectId: otherTeam.project.id,
          taskId: otherTask.id,
          objectKey: `issue/${randomUUID()}`,
          filename: "notes.pdf",
          mimeType: "application/pdf",
          size: 3,
          kind: "attachment",
          surface: "attachment",
        })
        .returning();
      const [own] = await db
        .insert(schema.assetTable)
        .values({
          workspaceId: world.ws,
          documentId: world.docs.teamAlpha,
          objectKey: `document/${randomUUID()}`,
          filename: "notes.pdf",
          mimeType: "application/pdf",
          size: 3,
          kind: "attachment",
          surface: "document",
        })
        .returning();
      const cases = {
        "a team the asker cannot open": (await betaFile()).id,
        "a pasted description image": (
          await alphaFile({ kind: "image", surface: "description" })
        ).id,
        "a draft upload": (await alphaFile({ surface: "draft" })).id,
        "a pending draft upload": (
          await alphaFile({ surface: "draft-pending" })
        ).id,
        "a document's own file": own?.id ?? "",
        "a file of another workspace": foreign?.id ?? "",
      };

      const invented = await answer(
        await propose(world.limited, randomUUID(), topic),
      );
      expect(invented.status).toBe(404);
      for (const [name, id] of Object.entries(cases)) {
        await untouched(async () => {
          expect({
            name,
            ...(await answer(await propose(world.limited, id, topic))),
          }).toEqual({ name, ...invented });
        });
      }
      // The same file is fine for someone who can open it.
      expect(
        (
          await propose(
            world.open,
            cases["a team the asker cannot open"],
            topic,
          )
        ).status,
      ).toBe(200);
    });

    it("answers a topic the asker cannot open like an invented topic, and makes nothing", async () => {
      const file = await alphaFile();
      const hidden = await betaTopic();
      await link(hidden, world.alphaTask.id);
      const unlinked = await alphaTopic();

      const invented = await answer(
        await propose(world.limited, file.id, randomUUID()),
      );
      expect(invented.status).toBe(404);
      for (const topic of [hidden, unlinked]) {
        await untouched(async () => {
          expect(
            await answer(await propose(world.limited, file.id, topic)),
          ).toEqual(invented);
        });
      }
    });

    it("refuses a topic the issue is not linked to, for a member who can open it", async () => {
      const file = await alphaFile();
      const unlinked = await alphaTopic();
      const invented = await answer(
        await propose(world.owner, file.id, randomUUID()),
      );

      await untouched(async () => {
        expect(
          await answer(await propose(world.owner, file.id, unlinked)),
        ).toEqual(invented);
      });
      expect(invented.status).toBe(404);
    });

    it("refuses a file name outside the document allow-list", async () => {
      const file = await alphaFile({
        filename: "build.zip",
        mimeType: "application/zip",
      });
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);

      await untouched(async () => {
        expect((await propose(world.owner, file.id, topic)).status).toBe(415);
      });
    });

    it("refuses a file already proposed on the topic, until that document is trashed", async () => {
      const file = await alphaFile();
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);
      const first = await proposed(world.owner, file.id, topic);
      m.copyToDocumentFile.mockClear();

      await untouched(async () => {
        expect((await propose(world.owner, file.id, topic)).status).toBe(409);
      });

      const trashed = await world.as(world.owner)(
        `/document/workspace/${world.ws}/${first.id}`,
        json("DELETE"),
      );
      expect(trashed.status).toBe(200);
      const again = await propose(world.owner, file.id, topic);
      expect(again.status).toBe(200);
      expect(((await again.json()) as Doc).id).not.toBe(first.id);
      expect(m.copyToDocumentFile).toHaveBeenCalledTimes(1);
    });

    it("allows the same file on a different topic", async () => {
      const file = await alphaFile();
      const one = await alphaTopic();
      const two = await alphaTopic({ name: "Second plan" });
      await link(one, world.alphaTask.id);
      await link(two, world.alphaTask.id);

      await proposed(world.owner, file.id, one);

      expect((await propose(world.owner, file.id, two)).status).toBe(200);
    });

    it("answers 503 when the copy fails, and leaves no document", async () => {
      const file = await alphaFile();
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);
      m.copyToDocumentFile.mockRejectedValueOnce(new Error("storage is down"));
      const before = await counts();

      const response = await propose(world.owner, file.id, topic);

      expect(response.status).toBe(503);
      expect(await counts()).toEqual(before);
      // The next try works.
      expect((await propose(world.owner, file.id, topic)).status).toBe(200);
    });

    it("needs a login", async () => {
      const file = await alphaFile();
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);
      const request = world.as(world.owner);
      mockAnonymousSession();

      await untouched(async () => {
        const response = await propose(world.owner, file.id, topic, request);
        expect(response.status).toBe(401);
      });
    });

    it("needs the right to create and to update issues", async () => {
      const file = await alphaFile();
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);

      for (const permissions of [
        { task: ["read"] },
        { task: ["create"] },
        { task: ["update"] },
      ]) {
        await untouched(async () => {
          const response = await withKey(permissions, (request) =>
            propose(world.owner, file.id, topic, request),
          );
          expect(response.status).toBe(403);
        });
      }
      const allowed = await withKey({ task: ["create", "update"] }, (request) =>
        propose(world.owner, file.id, topic, request),
      );
      expect(allowed.status).toBe(200);
    });
  });

  describe("a decision on a file document", () => {
    it("keeps the attachment line and puts the decision line before it", async () => {
      const file = await alphaFile();
      const topic = await alphaTopic();
      await link(topic, world.alphaTask.id);
      const doc = await proposed(world.owner, file.id, topic);
      const current = await world.as(world.owner)(
        `${topicBase()}/${topic}/document/${doc.id}/current`,
        json("POST", { reason: REASON }),
      );
      expect(current.status).toBe(200);

      const decided = await world.as(world.owner)(
        `${topicBase()}/${topic}/decision`,
        json("POST", { text: "Ship the plan as written", reason: REASON }),
      );
      expect(decided.status).toBe(200);

      const [stored] = await db
        .select()
        .from(schema.documentTable)
        .where(eq(schema.documentTable.id, doc.id));
      const content = stored?.content ?? "";
      const attachment = content.indexOf("<kaneo-attachment");
      const decision = content.indexOf("Ship the plan as written");
      expect(attachment).toBeGreaterThanOrEqual(0);
      expect(decision).toBeGreaterThanOrEqual(0);
      expect(decision).toBeLessThan(attachment);
      expect(content).toMatch(/<kaneo-attachment [^\n]*\/>/);
    });
  });
});
