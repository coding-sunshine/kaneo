import { and, eq, isNotNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable } from "../../database/schema";
import { releaseChildPages } from "../release-child-pages";
import { getDocument } from "./get-document";
import { loadDocument } from "./load-document";
import { keepFilesLinkedElsewhere } from "./purge-document-files";

export async function deleteDocument(
  workspaceId: string,
  id: string,
  userId: string,
) {
  const doc = await loadDocument(workspaceId, id, userId, { need: "edit" });
  if (doc.status === "current") {
    throw new HTTPException(409, {
      message:
        "This is the current document on its topic. Make another one current first.",
    });
  }
  await db
    .update(documentTable)
    .set({ deletedAt: new Date() })
    .where(eq(documentTable.id, id));
  return { id };
}

export async function purgeDocument(
  workspaceId: string,
  id: string,
  userId: string,
) {
  const doc = await loadDocument(workspaceId, id, userId, {
    need: "edit",
    deleted: true,
  });
  if (doc.status === "current") {
    throw new HTTPException(409, {
      message:
        "This is the current document on its topic. Make another one current first.",
    });
  }
  await db.transaction(async (tx) => {
    await keepFilesLinkedElsewhere(tx, doc);
    await releaseChildPages(tx, sql`doomed.id = ${id}`);
    await tx
      .delete(documentTable)
      .where(and(eq(documentTable.id, id), isNotNull(documentTable.deletedAt)));
  });
  return { id };
}

export async function restoreDocument(
  workspaceId: string,
  id: string,
  userId: string,
) {
  await loadDocument(workspaceId, id, userId, { need: "edit", deleted: true });
  await db
    .update(documentTable)
    // Time in the trash is no time waiting in the Inbox.
    .set({ deletedAt: null, inboxSince: new Date() })
    .where(eq(documentTable.id, id));
  return getDocument(workspaceId, id, userId);
}
