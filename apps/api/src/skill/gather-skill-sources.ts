import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import db from "../database";
import { activityTable, taskTable } from "../database/schema";
import { taskIsUnfinished } from "../task/task-is-unfinished";

const MAX_TASKS = 50;
const MAX_COMMENTS = 80;
const MAX_CHARS = 600;

/**
 * The open tickets of `projectIds` and their newest comments, as tagged data
 * for the model, with the ids it may cite. The caller has already cut
 * `projectIds` to what the reader can open.
 */
export async function gatherSkillSources(projectIds: string[]) {
  if (projectIds.length === 0)
    return { text: "", ids: new Set<string>(), commentIds: new Set<string>() };
  const tasks = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      status: taskTable.status,
      priority: taskTable.priority,
      description: taskTable.description,
    })
    .from(taskTable)
    .where(
      and(
        inArray(taskTable.projectId, projectIds),
        isNull(taskTable.archivedAt),
        ne(taskTable.status, "archived"),
        taskIsUnfinished,
      ),
    )
    .orderBy(desc(taskTable.createdAt))
    .limit(MAX_TASKS);
  const comments = tasks.length
    ? await db
        .select({
          id: activityTable.id,
          taskId: activityTable.taskId,
          content: activityTable.content,
        })
        .from(activityTable)
        .where(
          and(
            eq(activityTable.type, "comment"),
            inArray(
              activityTable.taskId,
              tasks.map((task) => task.id),
            ),
          ),
        )
        .orderBy(desc(activityTable.createdAt))
        .limit(MAX_COMMENTS)
    : [];
  const text = [
    ...tasks.map(
      (task) =>
        `<ticket id="${task.id}" title=${JSON.stringify(task.title)} status=${JSON.stringify(task.status)} priority="${task.priority}">${(task.description ?? "").slice(0, MAX_CHARS)}</ticket>`,
    ),
    ...comments.map(
      (comment) =>
        `<comment id="${comment.id}" ticket="${comment.taskId}">${(comment.content ?? "").slice(0, MAX_CHARS)}</comment>`,
    ),
  ].join("\n");
  return {
    text,
    ids: new Set([...tasks.map((t) => t.id), ...comments.map((c) => c.id)]),
    commentIds: new Set(comments.map((c) => c.id)),
  };
}
