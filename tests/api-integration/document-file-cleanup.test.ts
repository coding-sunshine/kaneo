import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import deleteProject from "../../apps/api/src/project/controllers/delete-project";
import { cleanupDraftUploads } from "../../apps/api/src/scheduler/draft-upload-cleanup";
import { retryStorageCleanup } from "../../apps/api/src/storage/cleanup-queue";
import deleteTask from "../../apps/api/src/task/controllers/delete-task";
import updateTaskDescription from "../../apps/api/src/task/controllers/update-task-description";
import { deleteWorkProject } from "../../apps/api/src/work-project/controllers/work-project-crud";
import { deleteWorkspaceData } from "../../apps/api/src/workspace/lifecycle/delete-workspace-data";
import { listWorkspaceObjectKeys } from "../../apps/api/src/workspace/lifecycle/list-workspace-object-keys";
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
});
