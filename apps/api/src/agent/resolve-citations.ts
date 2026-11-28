import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { activityTable, projectTable, taskTable } from "../database/schema";
import { loadDocument } from "../document/controllers/load-document";
import { readableMessages } from "./readable-messages";
import { projectAccessCondition } from "../project-access/project-access-condition";
import type { Cited, SourceKind } from "./sources";

export type Citation =
  | {
      kind: SourceKind;
      restricted: false;
      id: string;
      title: string;
      /** The issue a task or a comment is on. */
      taskId?: string;
      projectId?: string;
      ticket?: string;
      /** The channel a chat message is in. */
      channelId?: string;
    }
  | { kind: SourceKind; restricted: true };

type Issue = {
  id: string;
  title: string;
  projectId: string;
  ticket: string;
};

const issueColumns = {
  id: taskTable.id,
  title: taskTable.title,
  projectId: projectTable.id,
  slug: projectTable.slug,
  number: taskTable.number,
};
// The issues the reader can open now, in the chat's workspace.
const openTo = (userId: string, workspaceId: string) =>
  and(
    eq(projectTable.workspaceId, workspaceId),
    projectAccessCondition(userId, projectTable.id),
  );
const issueOf = (row: {
  id: string;
  title: string;
  projectId: string;
  slug: string;
  number: number | null;
}): Issue => ({
  id: row.id,
  title: row.title,
  projectId: row.projectId,
  ticket: `${row.slug.toUpperCase()}-${row.number}`,
});

async function openTasks(userId: string, workspaceId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, Issue>();
  const rows = await db
    .select(issueColumns)
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(and(inArray(taskTable.id, ids), openTo(userId, workspaceId)));
  return new Map(rows.map((row) => [row.id, issueOf(row)]));
}

/** The issue of each comment the reader can open, by the comment's id. */
async function openComments(
  userId: string,
  workspaceId: string,
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, Issue>();
  const rows = await db
    .select({ ...issueColumns, commentId: activityTable.id })
    .from(activityTable)
    .innerJoin(taskTable, eq(taskTable.id, activityTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        inArray(activityTable.id, ids),
        eq(activityTable.type, "comment"),
        openTo(userId, workspaceId),
      ),
    );
  return new Map(rows.map((row) => [row.commentId, issueOf(row)]));
}

async function openDocument(userId: string, workspaceId: string, id: string) {
  try {
    return await loadDocument(workspaceId, id, userId);
  } catch (error) {
    if (error instanceof HTTPException && error.status === 404) return null;
    throw error;
  }
}

/**
 * What each source is, for the person reading the chat now. A source they
 * cannot open, or that is gone or in another workspace, is only `restricted`:
 * nothing tells those apart, and no title or id is given.
 */
export async function resolveCitations(
  reader: { userId: string; workspaceId: string; mayReadTasks: boolean },
  cited: Cited[],
): Promise<Citation[]> {
  const { userId, workspaceId, mayReadTasks } = reader;
  // Without the task permission no issue, comment or document opens.
  const ids = (kind: SourceKind) =>
    mayReadTasks
      ? cited.filter((source) => source.kind === kind).map(({ id }) => id)
      : [];
  const [tasks, comments, messages] = await Promise.all([
    openTasks(userId, workspaceId, ids("task")),
    openComments(userId, workspaceId, ids("comment")),
    // Chat is open to anyone who reads the workspace, not only to task readers.
    readableMessages(
      userId,
      workspaceId,
      cited.filter((source) => source.kind === "message").map(({ id }) => id),
    ),
  ]);
  return Promise.all(
    cited.map(async ({ kind, id }): Promise<Citation> => {
      if (kind === "message") {
        const message = messages.get(id);
        return message
          ? { kind, restricted: false, id, ...message }
          : { kind, restricted: true };
      }
      if (!mayReadTasks) return { kind, restricted: true };
      if (kind === "document") {
        const doc = await openDocument(userId, workspaceId, id);
        return doc
          ? { kind, restricted: false, id, title: doc.title }
          : { kind, restricted: true };
      }
      const issue = (kind === "task" ? tasks : comments).get(id);
      if (!issue) return { kind, restricted: true };
      return {
        kind,
        restricted: false,
        id,
        title: issue.title,
        taskId: issue.id,
        projectId: issue.projectId,
        ticket: issue.ticket,
      };
    }),
  );
}
