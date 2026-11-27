import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { readableChannel } from "../chat/readable-channel";
import db from "../database";
import {
  chatChannelTable,
  chatMessageTable,
  documentTable,
  projectTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../database/schema";
import { documentVisibility } from "../document/visibility";
import { projectAccessCondition } from "../project-access/project-access-condition";

// Who is exporting. Every query returns only what they can open in the app.
export type ExportReader = {
  workspaceId: string;
  userId: string;
  guest: boolean;
};

const assignee = alias(userTable, "export_assignee");
const author = alias(userTable, "export_author");
const after = (column: Parameters<typeof gt>[0], id: string | null) =>
  id === null ? undefined : gt(column, id);

// Columns are listed one by one so nothing private rides along.
export async function ticketPage(
  reader: ExportReader,
  afterId: string | null,
  size: number,
) {
  const rows = await db
    .select({
      id: taskTable.id,
      slug: projectTable.slug,
      number: taskTable.number,
      title: taskTable.title,
      description: taskTable.description,
      status: taskTable.status,
      priority: taskTable.priority,
      team: projectTable.name,
      assignee: assignee.name,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      completedAt: taskTable.completedAt,
      archivedAt: taskTable.archivedAt,
      createdAt: taskTable.createdAt,
      updatedAt: taskTable.updatedAt,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(assignee, eq(assignee.id, taskTable.userId))
    .where(
      and(
        eq(projectTable.workspaceId, reader.workspaceId),
        projectAccessCondition(reader.userId, projectTable.id),
        after(taskTable.id, afterId),
      ),
    )
    .orderBy(asc(taskTable.id))
    .limit(size);
  return rows.map(({ slug, ...ticket }) => ({
    key: `${slug.toUpperCase()}-${ticket.number}`,
    ...ticket,
  }));
}

export type ExportTicket = Awaited<ReturnType<typeof ticketPage>>[number];

export function documentPage(
  reader: ExportReader,
  afterId: string | null,
  size: number,
) {
  return db
    .select({
      id: documentTable.id,
      title: documentTable.title,
      content: documentTable.content,
      scope: documentTable.scope,
      kind: documentTable.kind,
      status: documentTable.status,
      author: author.name,
      createdAt: documentTable.createdAt,
      updatedAt: documentTable.updatedAt,
    })
    .from(documentTable)
    .leftJoin(author, eq(author.id, documentTable.creatorId))
    .where(
      and(
        eq(documentTable.workspaceId, reader.workspaceId),
        isNull(documentTable.deletedAt),
        documentVisibility(reader.userId, documentTable),
        after(documentTable.id, afterId),
      ),
    )
    .orderBy(asc(documentTable.id))
    .limit(size);
}

export function channelPage(
  reader: ExportReader,
  afterId: string | null,
  size: number,
) {
  return db
    .select({
      id: chatChannelTable.id,
      name: chatChannelTable.name,
      direct: sql<boolean>`${chatChannelTable.directKey} IS NOT NULL`,
    })
    .from(chatChannelTable)
    .where(
      and(
        eq(chatChannelTable.workspaceId, reader.workspaceId),
        readableChannel(reader.userId, reader.workspaceId, reader.guest),
        after(chatChannelTable.id, afterId),
      ),
    )
    .orderBy(asc(chatChannelTable.id))
    .limit(size);
}

export type ExportChannel = Awaited<ReturnType<typeof channelPage>>[number];

// The cursor keeps the timestamp as Postgres text: a JavaScript Date drops
// the microseconds and would skip or repeat rows.
export type MessageCursor = { at: string; id: string };

export function messagePage(
  channelId: string,
  afterRow: MessageCursor | null,
  size: number,
) {
  return db
    .select({
      id: chatMessageTable.id,
      author: author.name,
      body: chatMessageTable.body,
      editedAt: chatMessageTable.editedAt,
      createdAt: chatMessageTable.createdAt,
      cursor: sql<string>`${chatMessageTable.createdAt}::text`,
    })
    .from(chatMessageTable)
    .leftJoin(author, eq(author.id, chatMessageTable.userId))
    .where(
      and(
        eq(chatMessageTable.channelId, channelId),
        afterRow
          ? sql`(${chatMessageTable.createdAt}, ${chatMessageTable.id}) > (${afterRow.at}::timestamp, ${afterRow.id})`
          : undefined,
      ),
    )
    .orderBy(asc(chatMessageTable.createdAt), asc(chatMessageTable.id))
    .limit(size);
}

export type ExportMessage = Awaited<ReturnType<typeof messagePage>>[number];

export function memberPage(
  reader: ExportReader,
  afterId: string | null,
  size: number,
) {
  return db
    .select({
      memberId: workspaceUserTable.id,
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: workspaceUserTable.role,
      joinedAt: workspaceUserTable.joinedAt,
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .where(
      and(
        eq(workspaceUserTable.workspaceId, reader.workspaceId),
        after(workspaceUserTable.id, afterId),
      ),
    )
    .orderBy(asc(workspaceUserTable.id))
    .limit(size);
}

export type ExportMember = Awaited<ReturnType<typeof memberPage>>[number];
