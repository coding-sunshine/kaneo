import { and, asc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { HTTPException } from "hono/http-exception";
import { readableChannel } from "../chat/readable-channel";
import db from "../database";
import {
  chatChannelTable,
  chatMessageTable,
  documentTable,
  projectTable,
  taskTable,
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../database/schema";
import { documentVisibility } from "../document/visibility";
import { projectAccessCondition } from "../project-access/project-access-condition";

const assignee = alias(userTable, "export_assignee");
const author = alias(userTable, "export_author");

// Everything in the workspace that the exporting person can open in the app:
// tickets of the teams open to them, the documents they can read, the
// messages of the channels they can read, and the members. Columns are
// listed one by one so nothing private rides along.
export async function collectWorkspaceExport(
  workspaceId: string,
  userId: string,
) {
  const [workspace] = await db
    .select({ id: workspaceTable.id, name: workspaceTable.name })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId));
  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }

  const tickets = await db
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
        eq(projectTable.workspaceId, workspaceId),
        projectAccessCondition(userId, projectTable.id),
      ),
    )
    .orderBy(asc(projectTable.slug), asc(taskTable.number));

  const documents = await db
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
        eq(documentTable.workspaceId, workspaceId),
        isNull(documentTable.deletedAt),
        documentVisibility(userId, documentTable),
      ),
    )
    .orderBy(asc(documentTable.createdAt), asc(documentTable.id));

  const channelMessages = await db
    .select({
      id: chatMessageTable.id,
      channelId: chatChannelTable.id,
      channel: chatChannelTable.name,
      direct: chatChannelTable.directKey,
      author: author.name,
      body: chatMessageTable.body,
      editedAt: chatMessageTable.editedAt,
      createdAt: chatMessageTable.createdAt,
    })
    .from(chatMessageTable)
    .innerJoin(
      chatChannelTable,
      eq(chatChannelTable.id, chatMessageTable.channelId),
    )
    .leftJoin(author, eq(author.id, chatMessageTable.userId))
    .where(
      and(
        eq(chatChannelTable.workspaceId, workspaceId),
        readableChannel(userId, workspaceId, false),
      ),
    )
    .orderBy(
      asc(chatChannelTable.name),
      asc(chatChannelTable.id),
      asc(chatMessageTable.createdAt),
      asc(chatMessageTable.id),
    );

  const users = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: workspaceUserTable.role,
      joinedAt: workspaceUserTable.joinedAt,
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .where(eq(workspaceUserTable.workspaceId, workspaceId))
    .orderBy(asc(userTable.name), asc(userTable.id));

  return {
    workspace,
    tickets: tickets.map(({ slug, ...ticket }) => ({
      key: `${slug.toUpperCase()}-${ticket.number}`,
      ...ticket,
    })),
    documents,
    channelMessages: channelMessages.map(({ direct, ...message }) => ({
      ...message,
      direct: direct !== null,
    })),
    users,
  };
}

export type WorkspaceExport = Awaited<
  ReturnType<typeof collectWorkspaceExport>
>;
