import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import db from "../../database";
import {
  assetTable,
  chatChannelTable,
  chatMessageTable,
  documentTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { readableChannel } from "../../chat/readable-channel";
import { documentVisibility } from "../../document/visibility";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { escapeLikePattern } from "../../search/like-pattern";
import {
  isAttachment,
  notDraft,
} from "../../task/controllers/task-attachments";

// ponytail: the newest 200 that match, no paging. Add a cursor when a
// workspace holds more files than people scroll through.
const LIMIT = 200;

const fileColumns = {
  id: assetTable.id,
  filename: assetTable.filename,
  mimeType: assetTable.mimeType,
  size: assetTable.size,
  createdAt: assetTable.createdAt,
  addedById: userTable.id,
  addedByName: userTable.name,
};
const newestFirst = [desc(assetTable.createdAt), desc(assetTable.id)];

/**
 * Every file the person can open in a workspace: ticket attachments, document
 * files and files sent in chat. Each source applies the same rule that guards
 * its own pages, in SQL before the search and the limit, so a hidden file is
 * never counted, matched or named.
 */
export async function listFiles(
  workspaceId: string,
  userId: string,
  query: string | undefined,
  apiBaseUrl: string,
) {
  const named = query
    ? ilike(assetTable.filename, `%${escapeLikePattern(query)}%`)
    : undefined;
  const guest = await isWorkspaceGuest(workspaceId, userId);

  const tickets = await db
    .select({
      ...fileColumns,
      sourceId: taskTable.id,
      sourceName: taskTable.title,
      projectId: projectTable.id,
      number: taskTable.number,
    })
    .from(assetTable)
    .innerJoin(taskTable, eq(taskTable.id, assetTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(userTable, eq(userTable.id, assetTable.createdBy))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isAttachment,
        notDraft,
        projectAccessCondition(userId, projectTable.id),
        named,
      ),
    )
    .orderBy(...newestFirst)
    .limit(LIMIT);

  const documents = await db
    .select({
      ...fileColumns,
      sourceId: documentTable.id,
      sourceName: documentTable.title,
    })
    .from(assetTable)
    .innerJoin(documentTable, eq(documentTable.id, assetTable.documentId))
    .leftJoin(userTable, eq(userTable.id, assetTable.createdBy))
    .where(
      and(
        eq(documentTable.workspaceId, workspaceId),
        isNull(documentTable.deletedAt),
        documentVisibility(userId, documentTable),
        named,
      ),
    )
    .orderBy(...newestFirst)
    .limit(LIMIT);

  const chat = await db
    .select({
      ...fileColumns,
      sourceId: chatChannelTable.id,
      sourceName: chatChannelTable.name,
      messageId: chatMessageTable.id,
      isDirect: sql<boolean>`${chatChannelTable.directKey} is not null`,
    })
    .from(assetTable)
    .innerJoin(
      chatMessageTable,
      eq(chatMessageTable.id, assetTable.chatMessageId),
    )
    .innerJoin(
      chatChannelTable,
      eq(chatChannelTable.id, chatMessageTable.channelId),
    )
    .leftJoin(userTable, eq(userTable.id, assetTable.createdBy))
    .where(
      and(
        eq(chatChannelTable.workspaceId, workspaceId),
        readableChannel(userId, workspaceId, guest),
        named,
      ),
    )
    .orderBy(...newestFirst)
    .limit(LIMIT);

  const rows = [
    ...tickets.map((row) => ({
      ...row,
      kind: "ticket" as const,
      messageId: null,
      isDirect: false,
    })),
    ...documents.map((row) => ({
      ...row,
      kind: "document" as const,
      projectId: null,
      number: null,
      messageId: null,
      isDirect: false,
    })),
    ...chat.map((row) => ({
      ...row,
      kind: "chat" as const,
      projectId: null,
      number: null,
      sourceName: row.isDirect ? "" : row.sourceName,
    })),
  ];

  return rows
    .sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id),
    )
    .slice(0, LIMIT)
    .map((row) => ({
      id: row.id,
      filename: row.filename,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.createdAt,
      url: `${apiBaseUrl}/asset/${row.id}`,
      addedBy:
        row.addedById && row.addedByName !== null
          ? { id: row.addedById, name: row.addedByName }
          : null,
      source: {
        kind: row.kind,
        id: row.sourceId,
        name: row.sourceName,
        projectId: row.projectId,
        number: row.number,
        messageId: row.messageId,
        isDirect: row.isDirect,
      },
    }));
}
