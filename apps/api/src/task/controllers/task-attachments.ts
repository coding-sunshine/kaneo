import { and, asc, eq, not, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { assetTable } from "../../database/schema";
import { queueStorageCleanup } from "../../storage/cleanup-queue";

/** Files shown in a task's attachments area: every non-image file, plus anything uploaded there directly. */
const isAttachment = or(
  eq(assetTable.kind, "attachment"),
  eq(assetTable.surface, "attachment"),
);
const notDraft = not(sql`${assetTable.surface} like 'draft%'`);

export async function listTaskAttachments(taskId: string) {
  return db
    .select({
      id: assetTable.id,
      filename: assetTable.filename,
      mimeType: assetTable.mimeType,
      size: assetTable.size,
      kind: assetTable.kind,
      surface: assetTable.surface,
      createdBy: assetTable.createdBy,
      createdAt: assetTable.createdAt,
    })
    .from(assetTable)
    .where(and(eq(assetTable.taskId, taskId), isAttachment, notDraft))
    .orderBy(asc(assetTable.createdAt));
}

export async function deleteTaskAttachment(taskId: string, assetId: string) {
  return db.transaction(async (tx) => {
    const [asset] = await tx
      .delete(assetTable)
      .where(
        and(
          eq(assetTable.id, assetId),
          eq(assetTable.taskId, taskId),
          isAttachment,
          notDraft,
        ),
      )
      .returning({ id: assetTable.id, objectKey: assetTable.objectKey });
    if (!asset)
      throw new HTTPException(404, { message: "Attachment not found" });
    await queueStorageCleanup(tx, [asset.objectKey]);
    return { id: asset.id };
  });
}
