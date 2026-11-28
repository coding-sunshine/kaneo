import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import db from "../../database";
import {
  documentTable,
  projectTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import { documentVisibility } from "../../document/visibility";
import { isWorkspaceGuest } from "../../guest/is-workspace-guest";
import { sharesProjectCondition } from "../../guest/shares-project-condition";
import { isSameProjectKey } from "../../project/project-key";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { type MentionRefs, taskRef } from "./find-mentions";
import type { MessageMention } from "./mention-type";

const restricted = (
  kind: MessageMention["kind"],
  ref: string,
): MessageMention => ({
  kind,
  ref,
  id: null,
  title: null,
  status: null,
  projectId: null,
  restricted: true,
});

const open = (
  kind: MessageMention["kind"],
  ref: string,
  title: string,
  extra: Partial<MessageMention> = {},
): MessageMention => ({
  kind,
  ref,
  id: ref,
  title,
  status: null,
  projectId: null,
  restricted: false,
  ...extra,
});

/**
 * Looks every named thing up once, for this reader. Something the reader
 * cannot open comes back restricted, with no id, title or status; something
 * missing from the workspace comes back not at all. Keyed by kind and ref.
 */
export async function resolveMentions(
  workspaceId: string,
  userId: string,
  refs: MentionRefs,
) {
  const [users, tasks, documents, projects] = await Promise.all([
    resolveUsers(workspaceId, userId, refs.userIds),
    resolveTasks(workspaceId, userId, refs.taskKeys),
    resolveDocuments(workspaceId, userId, refs.documentIds),
    resolveProjects(workspaceId, userId, refs.projectIds),
  ]);
  return new Map(
    [...users, ...tasks, ...documents, ...projects].map((mention) => [
      `${mention.kind}:${mention.ref}`,
      mention,
    ]),
  );
}

// A guest knows only the people they share a team with, as in search.
async function resolveUsers(
  workspaceId: string,
  userId: string,
  ids: string[],
) {
  if (!ids.length) return [];
  const guest = await isWorkspaceGuest(workspaceId, userId);
  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      known: guest
        ? sharesProjectCondition(userId, userTable.id, workspaceId)
        : sql<boolean>`true`,
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        inArray(workspaceUserTable.userId, ids),
      ),
    );
  return rows.map((row) =>
    row.known ? open("user", row.id, row.name) : restricted("user", row.id),
  );
}

async function resolveTasks(
  workspaceId: string,
  userId: string,
  keys: MentionRefs["taskKeys"],
) {
  if (!keys.length) return [];
  const projects = await db
    .select({
      id: projectTable.id,
      slug: projectTable.slug,
      canOpen: projectAccessCondition(userId, projectTable.id),
    })
    .from(projectTable)
    .where(eq(projectTable.workspaceId, workspaceId));
  const wanted = keys.flatMap(({ key, number }) => {
    const named = projects.filter((project) =>
      isSameProjectKey(project.slug, key),
    );
    // A key two teams answer to names neither.
    const [project] = named;
    return named.length === 1 && project
      ? [{ project, number, ref: taskRef(key, number) }]
      : [];
  });
  if (!wanted.length) return [];
  const rows = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      number: taskTable.number,
      title: taskTable.title,
      status: taskTable.status,
    })
    .from(taskTable)
    .where(
      or(
        ...wanted.map(({ project, number }) =>
          and(
            eq(taskTable.projectId, project.id),
            eq(taskTable.number, number),
          ),
        ),
      ),
    );
  return wanted.flatMap(({ project, number, ref }) => {
    const task = rows.find(
      (row) => row.projectId === project.id && row.number === number,
    );
    if (!task) return [];
    if (!project.canOpen) return [restricted("task", ref)];
    return [
      {
        ...open("task", ref, task.title, {
          status: task.status,
          projectId: task.projectId,
        }),
        id: task.id,
      },
    ];
  });
}

async function resolveDocuments(
  workspaceId: string,
  userId: string,
  ids: string[],
) {
  if (!ids.length) return [];
  const rows = await db
    .select({
      id: documentTable.id,
      title: documentTable.title,
      canOpen: documentVisibility(userId, documentTable),
    })
    .from(documentTable)
    .where(
      and(
        eq(documentTable.workspaceId, workspaceId),
        inArray(documentTable.id, ids),
        isNull(documentTable.deletedAt),
      ),
    );
  return rows.map((row) =>
    row.canOpen
      ? open("document", row.id, row.title)
      : restricted("document", row.id),
  );
}

async function resolveProjects(
  workspaceId: string,
  userId: string,
  ids: string[],
) {
  if (!ids.length) return [];
  const rows = await db
    .select({
      id: projectTable.id,
      name: projectTable.name,
      canOpen: projectAccessCondition(userId, projectTable.id),
    })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        inArray(projectTable.id, ids),
      ),
    );
  return rows.map((row) =>
    row.canOpen
      ? open("project", row.id, row.name)
      : restricted("project", row.id),
  );
}
