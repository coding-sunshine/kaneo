import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
} from "./helpers/document-access/build-document-world";

// The name of the constraint that refused a write, or null when it went in.
const refusedBy = async (write: PromiseLike<unknown>) => {
  try {
    await write;
    return null;
  } catch (error) {
    const { cause, constraint } = error as {
      cause?: { constraint?: string };
      constraint?: string;
    };
    return cause?.constraint ?? constraint ?? String(error);
  }
};

const queuedKeys = async () =>
  (await db.select().from(schema.storageCleanupTable))
    .map((row) => row.objectKey)
    .sort();

describe("API integration: a document owns a file", () => {
  let world: DocumentWorld;
  let key: number;
  const file = (
    owner: Partial<typeof schema.assetTable.$inferInsert>,
  ): typeof schema.assetTable.$inferInsert => ({
    workspaceId: world.ws,
    objectKey: `workspace/${world.ws}/file-${++key}.pdf`,
    filename: "notes.pdf",
    mimeType: "application/pdf",
    size: 3,
    kind: "attachment",
    surface: "document",
    createdBy: world.owner.id,
    ...owner,
  });
  const add = async (owner: Parameters<typeof file>[0]) => {
    const [row] = await db
      .insert(schema.assetTable)
      .values(file(owner))
      .returning();
    if (!row) throw new Error("The file was not stored");
    return row;
  };

  beforeEach(async () => {
    await resetTestDatabase();
    world = await buildDocumentWorld();
    key = 0;
  });

  it("stores a document's file with no team on the row", async () => {
    const row = await add({ documentId: world.docs.private });

    expect(row).toMatchObject({
      documentId: world.docs.private,
      projectId: null,
      taskId: null,
    });
  });

  it("refuses a file with no owner, with two, or with a document and an issue", async () => {
    const insert = (owner: Parameters<typeof file>[0]) =>
      refusedBy(db.insert(schema.assetTable).values(file(owner)));

    expect(await insert({})).toBe("asset_one_owner");
    expect(
      await insert({
        documentId: world.docs.teamAlpha,
        projectId: world.alpha.id,
      }),
    ).toBe("asset_one_owner");
    expect(
      await insert({
        documentId: world.docs.issueAlpha,
        taskId: world.alphaTask.id,
      }),
    ).toBe("asset_document_file_unattached");
    // An issue's file goes in as before.
    expect(
      await insert({
        projectId: world.alpha.id,
        taskId: world.alphaTask.id,
      }),
    ).toBeNull();
  });

  it("queues the stored object when the document's row goes", async () => {
    const row = await add({ documentId: world.docs.private });

    await db
      .delete(schema.documentTable)
      .where(eq(schema.documentTable.id, world.docs.private));

    expect(
      await db
        .select()
        .from(schema.assetTable)
        .where(eq(schema.assetTable.id, row.id)),
    ).toEqual([]);
    expect(await queuedKeys()).toEqual([row.objectKey]);
  });

  it("deletes the row when its object is already queued", async () => {
    // Deleting a workspace queues every key first, then the rows cascade.
    const row = await add({ documentId: world.docs.private });
    await db
      .insert(schema.storageCleanupTable)
      .values({ objectKey: row.objectKey });

    await db
      .delete(schema.documentTable)
      .where(eq(schema.documentTable.id, world.docs.private));

    expect(await queuedKeys()).toEqual([row.objectKey]);
  });

  it("queues a document's file when its team goes", async () => {
    const row = await add({ documentId: world.docs.teamAlpha });

    await db
      .delete(schema.projectTable)
      .where(eq(schema.projectTable.id, world.alpha.id));

    expect(await db.select().from(schema.assetTable)).toEqual([]);
    expect(await queuedKeys()).toEqual([row.objectKey]);
  });

  it("drops the record of a file with its document", async () => {
    const row = await add({ documentId: world.docs.private });
    await db.insert(schema.documentFileTable).values({
      documentId: world.docs.private,
      assetId: row.id,
      originalName: "Notes (final).pdf",
      sourceClient: "web",
      sourceUserId: world.owner.id,
    });

    await db
      .delete(schema.documentTable)
      .where(eq(schema.documentTable.id, world.docs.private));

    expect(await db.select().from(schema.documentFileTable)).toEqual([]);
  });
});
