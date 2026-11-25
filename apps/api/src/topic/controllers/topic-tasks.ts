import { and, eq, inArray, sql } from "drizzle-orm";
import db from "../../database";
import { projectTable, taskTable, taskTopicTable } from "../../database/schema";
import { loadTask } from "../../document/controllers/share-with-task";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { getTopic, listTopics } from "./get-topic";

// The issues on some topics that the user can open. An issue in a team they
// cannot enter is left out, so whatever is counted from this list says nothing
// about an issue they cannot see.
export const tasksOfTopics = async (
  workspaceId: string,
  userId: string,
  topicIds: string[],
) =>
  topicIds.length === 0
    ? []
    : await db
        .select({
          topicId: taskTopicTable.topicId,
          id: taskTable.id,
          title: taskTable.title,
          number: taskTable.number,
          projectId: taskTable.projectId,
          projectSlug: projectTable.slug,
          status: taskTable.status,
          closed: sql<boolean>`(
            ${taskTable.completedAt} IS NOT NULL
            OR ${taskTable.canceledAt} IS NOT NULL
            OR ${taskTable.archivedAt} IS NOT NULL
          )`,
        })
        .from(taskTopicTable)
        .innerJoin(taskTable, eq(taskTable.id, taskTopicTable.taskId))
        .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
        .where(
          and(
            inArray(taskTopicTable.topicId, topicIds),
            eq(projectTable.workspaceId, workspaceId),
            projectAccessCondition(userId, projectTable.id),
          ),
        )
        .orderBy(projectTable.slug, taskTable.number, taskTable.id);

export async function listTopicTasks(
  workspaceId: string,
  id: string,
  userId: string,
) {
  await getTopic(workspaceId, id, userId);
  return { tasks: await tasksOfTopics(workspaceId, userId, [id]) };
}

// Both sides must be open to the person: a topic or an issue they cannot open
// answers like one that does not exist. Nobody is told about the link.
export async function linkTaskTopic(
  workspaceId: string,
  id: string,
  taskId: string,
  userId: string,
) {
  await getTopic(workspaceId, id, userId);
  await loadTask(workspaceId, taskId, userId);
  await db
    .insert(taskTopicTable)
    .values({ taskId, topicId: id })
    .onConflictDoNothing();
  return { tasks: await tasksOfTopics(workspaceId, userId, [id]) };
}

export async function unlinkTaskTopic(
  workspaceId: string,
  id: string,
  taskId: string,
  userId: string,
) {
  await getTopic(workspaceId, id, userId);
  await loadTask(workspaceId, taskId, userId);
  await db
    .delete(taskTopicTable)
    .where(
      and(eq(taskTopicTable.taskId, taskId), eq(taskTopicTable.topicId, id)),
    );
  return { tasks: await tasksOfTopics(workspaceId, userId, [id]) };
}

/** The topics an issue is on that the user can open. */
export async function listTaskTopics(
  workspaceId: string,
  taskId: string,
  userId: string,
) {
  await loadTask(workspaceId, taskId, userId);
  const on = new Set(
    (
      await db
        .select({ topicId: taskTopicTable.topicId })
        .from(taskTopicTable)
        .where(eq(taskTopicTable.taskId, taskId))
    ).map((row) => row.topicId),
  );
  return (await listTopics(workspaceId, userId)).filter((topic) =>
    on.has(topic.id),
  );
}
