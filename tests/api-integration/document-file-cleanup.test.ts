import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import deleteProject from "../../apps/api/src/project/controllers/delete-project";
import { cleanupDraftUploads } from "../../apps/api/src/scheduler/draft-upload-cleanup";
import { retryStorageCleanup } from "../../apps/api/src/storage/cleanup-queue";
import deleteTask from "../../apps/api/src/task/controllers/delete-task";
import updateTaskDescription from "../../apps/api/src/task/controllers/update-task-description";
import { deleteWorkProject } from "../../apps/api/src/work-project/controllers/work-project-crud";
import { deleteWorkspaceData } from "../../apps/api/src/workspace/lifecycle/delete-workspace-data";
import { listWorkspaceObjectKeys } from "../../apps/api/src/workspace/lifecycle/list-workspace-object-keys";
import { mockAnonymousSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

const m = vi.hoisted(() => ({
  deleteS3Object: vi.fn(),
  getPrivateObject: vi.fn(async () => ({
    body: new Uint8Array([1, 2, 3]),
    contentType: "application/pdf",
    contentLength: 3,
  })),
}));
vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deleteS3Object: m.deleteS3Object,
  getPrivateObject: m.getPrivateObject,
}));

describe("API integration: cleaning up a document's files from storage", () => {
  let world: DocumentWorld;

  beforeEach(async () => {
    await resetTestDatabase();
    m.deleteS3Object.mockReset();
    m.deleteS3Object.mockResolvedValue(undefined);
    world = await buildDocumentWorld();
  });

  const insertAsset = async (
    owner: Partial<typeof schema.assetTable.$inferInsert>,
  ) => {
    const [row] = await db
      .insert(schema.assetTable)
      .values({
        workspaceId: world.ws,
        objectKey: randomUUID(),
        filename: "notes.pdf",
        mimeType: "application/pdf",
        size: 3,
        kind: "attachment",
        surface: "document",
        createdBy: world.owner.id,
        ...owner,
      })
      .returning();
    if (!row) throw new Error("The file was not stored");
    return row;
  };
  const fileOf = (documentId: string) => insertAsset({ documentId });

  const queuedKeys = async () =>
    (await db.select().from(schema.storageCleanupTable)).map(
      (row) => row.objectKey,
    );
  const assetRow = async (id: string) =>
    db.query.assetTable.findFirst({ where: eq(schema.assetTable.id, id) });

  it("queues the file of a team document when the team is deleted", async () => {
    const file = await fileOf(world.docs.teamAlpha);
    await deleteProject(world.alpha.id, world.ws);
    expect(await assetRow(file.id)).toBeUndefined();
    expect(await queuedKeys()).toEqual([file.objectKey]);
  });

  it("queues the file of an issue document when the issue is deleted", async () => {
    const file = await fileOf(world.docs.issueAlpha);
    await deleteTask(world.alphaTask.id, world.owner.id);
    expect(await assetRow(file.id)).toBeUndefined();
    expect(await queuedKeys()).toEqual([file.objectKey]);
  });

  it("queues the file of a work project document when the work project is deleted", async () => {
    const [doc] = await db
      .select({ workProjectId: schema.documentTable.workProjectId })
      .from(schema.documentTable)
      .where(eq(schema.documentTable.id, world.docs.project));
    expect(doc?.workProjectId).toBe(world.workProject.id);
    const file = await fileOf(world.docs.project);
    await deleteWorkProject(world.workProject.id);
    expect(await assetRow(file.id)).toBeUndefined();
    expect(await queuedKeys()).toEqual([file.objectKey]);
  });

  it("queues the file once when the whole workspace is deleted", async () => {
    const file = await fileOf(world.docs.workspace);
    expect(await listWorkspaceObjectKeys(world.ws)).toContain(file.objectKey);
    await deleteWorkspaceData(world.ws);
    expect(await assetRow(file.id)).toBeUndefined();
    expect(
      (await queuedKeys()).filter((key) => key === file.objectKey),
    ).toHaveLength(1);
  });

  it("removes the object from storage and empties the queue on retry", async () => {
    const file = await fileOf(world.docs.teamAlpha);
    await deleteProject(world.alpha.id, world.ws);
    expect(await retryStorageCleanup()).toEqual({ degraded: false });
    expect(m.deleteS3Object).toHaveBeenCalledWith(file.objectKey);
    expect(await queuedKeys()).toEqual([]);
  });

  it("keeps a document file when an issue description stops mentioning it", async () => {
    const { alphaTask, alpha, owner } = world;
    const documentFile = await fileOf(world.docs.teamAlpha);
    const issueFile = await insertAsset({
      taskId: alphaTask.id,
      projectId: alpha.id,
      kind: "image",
      surface: "description",
    });
    await db
      .update(schema.taskTable)
      .set({
        description: `<p>/api/asset/${documentFile.id} /api/asset/${issueFile.id}</p>`,
      })
      .where(eq(schema.taskTable.id, alphaTask.id));

    await updateTaskDescription({
      id: alphaTask.id,
      description: "<p>nothing attached</p>",
      currentUserId: owner.id,
    });

    // The sweep is fire-and-forget; the issue's own file going away proves it ran.
    await vi.waitFor(async () =>
      expect(await assetRow(issueFile.id)).toBeUndefined(),
    );
    expect(m.deleteS3Object).toHaveBeenCalledWith(issueFile.objectKey);
    expect(m.deleteS3Object).not.toHaveBeenCalledWith(documentFile.objectKey);
    expect(await assetRow(documentFile.id)).toBeDefined();
    expect(await queuedKeys()).not.toContain(documentFile.objectKey);
  });

  it("expires old drafts but not an old document file", async () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const documentFile = await insertAsset({
      documentId: world.docs.teamAlpha,
      createdAt: old,
    });
    const draft = await insertAsset({
      projectId: world.alpha.id,
      surface: "draft",
      kind: "image",
      createdAt: old,
    });
    await cleanupDraftUploads();
    expect(await assetRow(draft.id)).toBeUndefined();
    expect(await queuedKeys()).toEqual([draft.objectKey]);
    expect(await assetRow(documentFile.id)).toBeDefined();
  });

  it("keeps the file and queues nothing when a document goes to the trash", async () => {
    const file = await fileOf(world.docs.teamAlpha);
    const trashed = await world.as(world.owner)(
      `/document/workspace/${world.ws}/${world.docs.teamAlpha}`,
      json("DELETE"),
    );
    expect(trashed.status).toBe(200);
    expect(await assetRow(file.id)).toBeDefined();
    expect(await queuedKeys()).toEqual([]);
    expect(m.deleteS3Object).not.toHaveBeenCalled();
  });

  const docPath = (id: string) => `/document/workspace/${world.ws}/${id}`;
  const trashAndPurge = async (id: string) => {
    const trashed = await world.as(world.owner)(docPath(id), json("DELETE"));
    expect(trashed.status).toBe(200);
    return world.as(world.owner)(`${docPath(id)}/permanent`, json("DELETE"));
  };
  const ownerOf = async (assetId: string) =>
    (await assetRow(assetId))?.documentId;

  it("keeps a file linked from a saved version when the text unlinks it or a restore replaces it", async () => {
    const versioned = await fileOf(world.docs.teamAlpha);
    const replaced = await fileOf(world.docs.teamAlpha);
    const path = docPath(world.docs.teamAlpha);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [version] = await db
      .insert(schema.documentVersionTable)
      .values({
        documentId: world.docs.teamAlpha,
        authorId: world.owner.id,
        title: "Old",
        content: `<p>/api/asset/${versioned.id}</p>`,
        createdAt: hourAgo,
        updatedAt: hourAgo,
      })
      .returning();
    if (!version) throw new Error("The version was not stored");

    for (const content of [
      `<p>/api/asset/${versioned.id}</p>`,
      `<p>/api/asset/${replaced.id}</p>`,
    ]) {
      const res = await world.as(world.owner)(path, json("PATCH", { content }));
      expect(res.status).toBe(200);
    }
    expect(await assetRow(versioned.id)).toBeDefined();

    const restored = await world.as(world.owner)(
      `${path}/versions/${version.id}/restore`,
      json("POST"),
    );
    expect(restored.status).toBe(200);

    expect(await assetRow(versioned.id)).toBeDefined();
    expect(await assetRow(replaced.id)).toBeDefined();
    expect(await queuedKeys()).toEqual([]);
    expect(m.deleteS3Object).not.toHaveBeenCalled();
  });

  it("moves a shared file to the oldest live document linking it when the first is purged", async () => {
    const file = await fileOf(world.docs.teamBeta);
    const link = `<p>/api/asset/${file.id}</p>`;
    // private is the oldest but goes to the trash, so sharedByName inherits.
    for (const id of [
      world.docs.workspace,
      world.docs.sharedByName,
      world.docs.private,
    ]) {
      const res = await world.as(world.owner)(
        docPath(id),
        json("PATCH", { content: link }),
      );
      expect(res.status).toBe(200);
    }
    const trashedLinker = await world.as(world.owner)(
      docPath(world.docs.private),
      json("DELETE"),
    );
    expect(trashedLinker.status).toBe(200);

    // `limited` cannot enter team Beta, so the file is hidden from them.
    const before = await world.as(world.limited)(`/asset/${file.id}`);
    expect(before.status).toBe(404);

    const purged = await trashAndPurge(world.docs.teamBeta);
    expect(purged.status).toBe(200);

    expect(await ownerOf(file.id)).toBe(world.docs.sharedByName);
    expect(await queuedKeys()).toEqual([]);
    // sharedByName is shared with `limited`, so the file now opens for them.
    const read = await world.as(world.limited)(`/asset/${file.id}`);
    expect(read.status).toBe(200);
  });

  it("refuses the purge and deletes nothing when only an issue links the file", async () => {
    const file = await fileOf(world.docs.teamAlpha);
    await db
      .update(schema.taskTable)
      .set({ description: `<p>/api/asset/${file.id}</p>` })
      .where(eq(schema.taskTable.id, world.betaTask.id));

    const purged = await trashAndPurge(world.docs.teamAlpha);
    expect(purged.status).toBe(409);

    const doc = await db.query.documentTable.findFirst({
      where: eq(schema.documentTable.id, world.docs.teamAlpha),
    });
    expect(doc).toBeDefined();
    expect(await ownerOf(file.id)).toBe(world.docs.teamAlpha);
    expect(await queuedKeys()).toEqual([]);
  });

  it("refuses the purge and deletes nothing when only another workspace links the file", async () => {
    const file = await fileOf(world.docs.teamAlpha);
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    await db.insert(schema.documentTable).values({
      workspaceId: workspace.id,
      title: "Elsewhere",
      content: `<p>/api/asset/${file.id}</p>`,
      creatorId: user.id,
    });

    const purged = await trashAndPurge(world.docs.teamAlpha);
    expect(purged.status).toBe(409);
    expect(await ownerOf(file.id)).toBe(world.docs.teamAlpha);
    expect(await queuedKeys()).toEqual([]);
  });

  it("queues the file when a trashed document is deleted for good", async () => {
    const file = await fileOf(world.docs.teamAlpha);
    const path = docPath(world.docs.teamAlpha);
    // The document's own saved version and comment do not keep the file.
    await db.insert(schema.documentVersionTable).values({
      documentId: world.docs.teamAlpha,
      authorId: world.owner.id,
      title: "Old",
      content: `<p>/api/asset/${file.id}</p>`,
    });
    await db.insert(schema.documentCommentTable).values({
      documentId: world.docs.teamAlpha,
      userId: world.owner.id,
      content: `<p>/api/asset/${file.id}</p>`,
    });

    // Must be in the trash first.
    const beforeTrash = await world.as(world.owner)(
      `${path}/permanent`,
      json("DELETE"),
    );
    expect(beforeTrash.status).toBe(404);
    expect(await assetRow(file.id)).toBeDefined();

    const trashed = await world.as(world.owner)(path, json("DELETE"));
    expect(trashed.status).toBe(200);

    const purged = await world.as(world.owner)(
      `${path}/permanent`,
      json("DELETE"),
    );
    expect(purged.status).toBe(200);
    expect(await assetRow(file.id)).toBeUndefined();
    expect(await queuedKeys()).toEqual([file.objectKey]);
  });

  it("enforces access rules on permanent document deletion", async () => {
    const trash = async (docId: string) => {
      const res = await world.as(world.owner)(
        `/document/workspace/${world.ws}/${docId}`,
        json("DELETE"),
      );
      expect(res.status).toBe(200);
    };
    const permanentPath = (docId: string) =>
      `/document/workspace/${world.ws}/${docId}/permanent`;

    await trash(world.docs.sharedInBeta);
    await trash(world.docs.private);

    // Viewer gets 403.
    const viewerRes = await world.as(world.limited)(
      permanentPath(world.docs.sharedInBeta),
      json("DELETE"),
    );
    expect(viewerRes.status).toBe(403);

    // Member who cannot open the document gets 404 matching unknown id.
    const hidden = await world.as(world.open)(
      permanentPath(world.docs.private),
      json("DELETE"),
    );
    const unknown = await world.as(world.open)(
      permanentPath("no-such-doc"),
      json("DELETE"),
    );
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toEqual(await unknown.json());

    // Anonymous gets 401.
    const asOwner = world.as(world.owner);
    mockAnonymousSession();
    const anon = await asOwner(
      permanentPath(world.docs.private),
      json("DELETE"),
    );
    expect(anon.status).toBe(401);

    // Read-only API key gets 403.
    const { key } = await auth.api.createApiKey({
      body: {
        userId: world.owner.id,
        name: "Read only doc purge",
        permissions: { task: ["read"] },
      },
    });
    const reqWithKey = world.as(world.owner);
    mockAnonymousSession();
    const keyRes = await reqWithKey(permanentPath(world.docs.private), {
      ...json("DELETE"),
      headers: { "content-type": "application/json", "x-api-key": key },
    } as never);
    expect(keyRes.status).toBe(403);
  });
});
