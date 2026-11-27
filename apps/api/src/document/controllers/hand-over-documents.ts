import { and, desc, eq, isNull, notExists, type SQL, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { recordAdminAction } from "../../admin/audit/record-admin-action";
import db from "../../database";
import {
  documentSubscriberTable,
  documentTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import { isOwnerRole } from "../../project-access/is-owner-role";

async function member(workspaceId: string, userId: string) {
  const [row] = await db
    .select({ role: workspaceUserTable.role })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    );
  return row;
}

async function assertOwner(workspaceId: string, userId: string) {
  if (!isOwnerRole((await member(workspaceId, userId))?.role)) {
    throw new HTTPException(403, {
      message: "Only a workspace owner can hand over private documents",
    });
  }
}

// A private document whose author deleted their account or left the
// workspace. Every move goes through this clause, so the private documents of
// somebody who is still a member can never change hands.
const ownerless = (workspaceId: string) =>
  and(
    eq(documentTable.workspaceId, workspaceId),
    eq(documentTable.scope, "private"),
    notExists(
      db
        .select({ one: sql`1` })
        .from(workspaceUserTable)
        .where(
          and(
            eq(workspaceUserTable.workspaceId, documentTable.workspaceId),
            eq(workspaceUserTable.userId, documentTable.creatorId),
          ),
        ),
    ),
  );

// Makes `toUserId` the author of the ownerless documents the filter picks,
// out of the trash, and records each one. The entry carries no title: the log
// is read by instance administrators, and the documents are private.
async function move(
  workspaceId: string,
  actorUserId: string,
  toUserId: string,
  filter: SQL | undefined,
  action: string,
  fromUserId?: string,
) {
  return db.transaction(async (tx) => {
    const moved = await tx
      .update(documentTable)
      // There is no trash to look in: a document that stayed there would be
      // lost to its new author.
      .set({ creatorId: toUserId, deletedAt: null })
      .where(and(ownerless(workspaceId), filter))
      .returning({ id: documentTable.id });
    if (moved.length === 0) return moved;
    // Like any author, the new one follows their documents.
    await tx
      .insert(documentSubscriberTable)
      .values(moved.map(({ id }) => ({ documentId: id, userId: toUserId })))
      .onConflictDoNothing();
    for (const { id } of moved) {
      await recordAdminAction(
        {
          actorUserId,
          action,
          targetType: "document",
          targetId: id,
          metadata: { workspaceId, fromUserId, toUserId },
        },
        tx,
      );
    }
    return moved;
  });
}

// Gives the private documents of somebody who left to a member. A person who
// is still a member keeps theirs: remove them first. What they threw away
// stays in the owner's list, for the owner to take over if it matters.
export async function handOverDocuments(
  workspaceId: string,
  userId: string,
  { fromUserId, toUserId }: { fromUserId: string; toUserId: string },
) {
  await assertOwner(workspaceId, userId);
  // Somebody who left answers like somebody who never existed.
  if (!(await member(workspaceId, toUserId))) {
    throw new HTTPException(404, { message: "Member not found" });
  }
  const moved = await move(
    workspaceId,
    userId,
    toUserId,
    and(
      eq(documentTable.creatorId, fromUserId),
      isNull(documentTable.deletedAt),
    ),
    "document.handed_over",
    fromUserId,
  );
  return { moved: moved.length };
}

// Title, date, the author who left and whether they threw it away: the owner
// decides whether to take a draft over, or give one person's drafts to a
// colleague, without reading it.
export async function listOwnerlessDocuments(
  workspaceId: string,
  userId: string,
) {
  await assertOwner(workspaceId, userId);
  return db
    .select({
      id: documentTable.id,
      title: documentTable.title,
      updatedAt: documentTable.updatedAt,
      creatorId: documentTable.creatorId,
      creatorName: userTable.name,
      deletedAt: documentTable.deletedAt,
    })
    .from(documentTable)
    .leftJoin(userTable, eq(userTable.id, documentTable.creatorId))
    .where(ownerless(workspaceId))
    .orderBy(desc(documentTable.updatedAt));
}

export async function takeOverDocument(
  workspaceId: string,
  userId: string,
  id: string,
) {
  await assertOwner(workspaceId, userId);
  const [doc] = await move(
    workspaceId,
    userId,
    userId,
    eq(documentTable.id, id),
    "document.taken_over",
  );
  // A document that still has its author answers like an unknown one.
  if (!doc) throw new HTTPException(404, { message: "Document not found" });
  return doc;
}
