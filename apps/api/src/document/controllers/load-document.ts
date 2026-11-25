import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  type DocumentAccess,
  documentShareTable,
  documentTable,
  topicTable,
} from "../../database/schema";
import { documentParentAccess, documentTaskAccess } from "../visibility";

export type DocumentRole = "owner" | DocumentAccess;
const RANK: Record<DocumentRole, number> = {
  view: 1,
  comment: 2,
  edit: 3,
  owner: 4,
};

type DocumentRow = typeof documentTable.$inferSelect;

function roleFor(
  doc: DocumentRow,
  userId: string,
  shareAccess: DocumentAccess | null,
  parentAccess: boolean,
  taskAccess: boolean,
  decides: boolean,
): DocumentRole | null {
  if (doc.creatorId === userId) return "owner";
  // An issue the document is shared with lets its people view, no more.
  const roles = [
    shareAccess,
    parentAccess ? doc.generalAccess : null,
    taskAccess ? ("view" as const) : null,
  ].filter((role): role is DocumentAccess => role !== null);
  const role = roles.sort((a, b) => RANK[b] - RANK[a])[0] ?? null;
  // A topic's decider may edit its current document, whatever the document
  // grants everyone else. Only while they can still open the topic's place.
  if (
    role &&
    decides &&
    parentAccess &&
    doc.status === "current" &&
    RANK[role] < RANK.edit
  ) {
    return "edit";
  }
  return role;
}

// Loads a document the user can see, or 404s so hidden ids look missing.
export async function loadDocument(
  workspaceId: string,
  id: string,
  userId: string,
  options: { need?: DocumentRole; deleted?: boolean } = {},
) {
  const [row] = await db
    .select({
      doc: documentTable,
      shareAccess: documentShareTable.access,
      parentAccess: documentParentAccess(userId, documentTable),
      taskAccess: documentTaskAccess(userId, documentTable.id),
      deciderId: topicTable.deciderId,
      backupDeciderId: topicTable.backupDeciderId,
    })
    .from(documentTable)
    .leftJoin(topicTable, eq(topicTable.id, documentTable.topicId))
    .leftJoin(
      documentShareTable,
      and(
        eq(documentShareTable.documentId, documentTable.id),
        eq(documentShareTable.userId, userId),
      ),
    )
    .where(
      and(
        eq(documentTable.id, id),
        eq(documentTable.workspaceId, workspaceId),
        options.deleted
          ? isNotNull(documentTable.deletedAt)
          : isNull(documentTable.deletedAt),
      ),
    );
  const role =
    row &&
    roleFor(
      row.doc,
      userId,
      row.shareAccess,
      Boolean(row.parentAccess),
      Boolean(row.taskAccess),
      row.deciderId === userId || row.backupDeciderId === userId,
    );
  if (!row || !role) {
    throw new HTTPException(404, { message: "Document not found" });
  }
  if (options.need && RANK[role] < RANK[options.need]) {
    throw new HTTPException(403, {
      message: "You don't have permission to do that on this document",
    });
  }
  return { ...row.doc, role };
}
