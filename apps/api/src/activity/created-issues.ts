import { and, asc, eq, inArray, sql } from "drizzle-orm";
import db from "../database";
import {
  columnTable,
  projectTable,
  taskRelationTable,
  taskTable,
  userTable,
} from "../database/schema";
import { projectAccessCondition } from "../project-access/project-access-condition";
import { taskIsCompleted } from "../task/task-is-completed";

/** The tasks created from each comment, oldest first, that the viewer can see. */
export async function createdIssuesByComment(
  commentIds: string[],
  viewerId: string,
) {
  const rows = commentIds.length
    ? await db
        .select({
          commentId: taskTable.sourceCommentId,
          id: taskTable.id,
          projectId: taskTable.projectId,
          projectSlug: projectTable.slug,
          number: taskTable.number,
          title: taskTable.title,
          status: taskTable.status,
          statusIcon: sql<string | null>`(
            select ${columnTable.icon} from ${columnTable}
            where ${columnTable.projectId} = ${taskTable.projectId}
              and ${columnTable.slug} = ${taskTable.status}
            limit 1
          )`,
          isCompleted: taskIsCompleted,
          isSubIssue: sql<boolean>`exists (
            select 1 from ${taskRelationTable}
            where ${taskRelationTable.targetTaskId} = ${taskTable.id}
              and ${taskRelationTable.relationType} = 'subtask'
          )`,
          creatorId: taskTable.creatorId,
          creatorName: userTable.name,
        })
        .from(taskTable)
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .leftJoin(userTable, eq(taskTable.creatorId, userTable.id))
        .where(
          and(
            inArray(taskTable.sourceCommentId, commentIds),
            projectAccessCondition(viewerId, projectTable.id),
          ),
        )
        .orderBy(asc(taskTable.createdAt), asc(taskTable.id))
    : [];

  const byComment = new Map<
    string,
    Omit<(typeof rows)[number], "commentId">[]
  >();
  for (const { commentId, ...issue } of rows) {
    if (commentId)
      byComment.set(commentId, [...(byComment.get(commentId) ?? []), issue]);
  }
  return (commentId: string) => byComment.get(commentId) ?? [];
}
