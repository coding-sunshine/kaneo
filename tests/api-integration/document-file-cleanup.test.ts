import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import deleteProject from "../../apps/api/src/project/controllers/delete-project";
import { purgeTrashedDocuments } from "../../apps/api/src/scheduler/document-trash-cleanup";
import { cleanupDraftUploads } from "../../apps/api/src/scheduler/draft-upload-cleanup";
import { retryStorageCleanup } from "../../apps/api/src/storage/cleanup-queue";
import deleteTask from "../../apps/api/src/task/controllers/delete-task";
import updateTaskDescription from "../../apps/api/src/task/controllers/update-task-description";
import { deleteWorkProject } from "../../apps/api/src/work-project/controllers/work-project-crud";
import { deleteWorkspaceData } from "../../apps/api/src/workspace/lifecycle/delete-workspace-data";
import { listWorkspaceObjectKeys } from "../../apps/api/src/workspace/lifecycle/list-workspace-object-keys";
import { mockAnonymousSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

const m = vi.hoisted(() => ({ deleteS3Object: vi.fn() }));
vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deleteS3Object: m.deleteS3Object,
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

  it("queues a document's file when it is unlinked from the document text", async () => {
    const removed = await fileOf(world.docs.teamAlpha);
    const kept = await fileOf(world.docs.teamAlpha);
    const commented = await fileOf(world.docs.teamAlpha);
    const foreign = await fileOf(world.docs.private);
    const path = `/document/workspace/${world.ws}/${world.docs.teamAlpha}`;

    const initial = await world.as(world.owner)(
      path,
      json("PATCH", {
        content: `<p>/api/asset/${removed.id} /api/asset/${kept.id} /api/asset/${commented.id} /api/asset/${foreign.id}</p>`,
      }),
    );
    expect(initial.status).toBe(200);

    await db.insert(schema.documentCommentTable).values({
      documentId: world.docs.teamAlpha,
      userId: world.owner.id,
      content: `<p>still using /api/asset/${commented.id}</p>`,
    });

    const unlinked = await world.as(world.owner)(
      path,
      json("PATCH", {
        content: `<p>only /api/asset/${kept.id}</p>`,
      }),
    );
    expect(unlinked.status).toBe(200);

    expect(await assetRow(removed.id)).toBeUndefined();
    expect(await assetRow(kept.id)).toBeDefined();
    expect(await assetRow(commented.id)).toBeDefined();
    expect(await assetRow(foreign.id)).toBeDefined();
    expect(await queuedKeys()).toEqual([removed.objectKey]);
  });

  it("queues the file when a trashed document is deleted for good", async () => {
    const file = await fileOf(world.docs.teamAlpha);
    const path = `/document/workspace/${world.ws}/${world.docs.teamAlpha}`;

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

  it("purges old trashed documents and queues their files, while keeping recent trash", async () => {
    const oldFile = await fileOf(world.docs.teamAlpha);
    const recentFile = await fileOf(world.docs.private);

    await db
      .update(schema.documentTable)
      .set({ deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) })
      .where(eq(schema.documentTable.id, world.docs.teamAlpha));
    await db
      .update(schema.documentTable)
      .set({ deletedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) })
      .where(eq(schema.documentTable.id, world.docs.private));

    await purgeTrashedDocuments();

    expect(await assetRow(oldFile.id)).toBeUndefined();
    expect(await assetRow(recentFile.id)).toBeDefined();
    expect(await queuedKeys()).toEqual([oldFile.objectKey]);
  });
});
