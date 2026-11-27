import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../../database";
import {
  documentShareTable,
  documentTable,
  taskDocumentTable,
} from "../../database/schema";
import type { moveDocumentBody } from "../schema";
import { getDocument } from "./get-document";
import { loadDocument } from "./load-document";
import { resolveParent } from "./resolve-parent";

const OFF_TOPIC = {
  topicId: null,
  filedAt: null,
  filedById: null,
  status: "draft",
  supersedesDocumentId: null,
} as const;

export async function moveDocument(
  workspaceId: string,
  id: string,
  userId: string,
  body: z.infer<typeof moveDocumentBody>,
) {
  const doc = await loadDocument(workspaceId, id, userId, { need: "edit" });
  if (body.scope === "private" && doc.role !== "owner") {
    throw new HTTPException(403, {
      message: "Only the creator can make a document private",
    });
  }
  // A filed document lives where its topic lives. The current one and the
  // ones it replaced stay there; a proposal that moves away leaves the topic.
  if (doc.status === "current" || doc.status === "superseded") {
    throw new HTTPException(409, {
      message: `A ${doc.status} document stays in its topic's place`,
    });
  }
  const parent = await resolveParent(workspaceId, userId, body);
  // A move between two shared places keeps the wait it had in the Inbox.
  const entersInbox =
    parent.scope !== "private" && (doc.scope === "private" || !!doc.topicId);

  await db.transaction(async (tx) => {
    await tx
      .update(documentTable)
      .set({
        ...parent,
        ...OFF_TOPIC,
        ...(entersInbox && { inboxSince: new Date() }),
      })
      .where(eq(documentTable.id, id));
    // Back in My documents means private again: drop everyone invited.
    if (parent.scope === "private") {
      await tx
        .delete(documentShareTable)
        .where(eq(documentShareTable.documentId, id));
      await tx
        .delete(taskDocumentTable)
        .where(
          and(
            eq(taskDocumentTable.documentId, id),
            eq(taskDocumentTable.source, "share"),
          ),
        );
    }
  });
  if (body.scope === "private" || doc.role === "owner") {
    return getDocument(workspaceId, id, userId);
  }
  // A non-creator may lose sight of the document by moving it.
  return getDocument(workspaceId, id, userId).catch((error) => {
    if (error instanceof HTTPException && error.status === 404) {
      return null;
    }
    throw error;
  });
}
