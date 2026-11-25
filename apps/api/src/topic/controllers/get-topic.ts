import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  topicTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import { documentVisibility, topicAccess } from "../../document/visibility";
import { isOwnerRole } from "../../project-access/is-owner-role";

const decider = alias(userTable, "topic_decider");
const backup = alias(userTable, "topic_backup");

export async function isWorkspaceOwner(workspaceId: string, userId: string) {
  const [member] = await db
    .select({ role: workspaceUserTable.role })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    );
  return isOwnerRole(member?.role);
}

// The topics the user can open, each with whether they decide on it. The
// current document lives in the topic's place, so everyone who can open the
// topic can open it too. Its title is still checked: a title is content, and a
// document moved past the topic must not be named to someone it is closed to.
export async function listTopics(
  workspaceId: string,
  userId: string,
  id?: string,
) {
  const [topics, owner] = await Promise.all([
    db
      .select({
        id: topicTable.id,
        workspaceId: topicTable.workspaceId,
        name: topicTable.name,
        scope: topicTable.scope,
        projectId: topicTable.projectId,
        workProjectId: topicTable.workProjectId,
        parentName: sql<string | null>`CASE ${topicTable.scope}
          WHEN 'team' THEN (
            SELECT name FROM project WHERE id = ${topicTable.projectId}
          )
          WHEN 'project' THEN (
            SELECT name FROM work_project WHERE id = ${topicTable.workProjectId}
          )
        END`,
        deciderId: topicTable.deciderId,
        deciderName: decider.name,
        deciderImage: decider.image,
        backupDeciderId: topicTable.backupDeciderId,
        backupDeciderName: backup.name,
        backupDeciderImage: backup.image,
        currentDocumentId: sql<string | null>`(
          SELECT current_document.id FROM document AS current_document
          WHERE current_document.topic_id = ${topicTable.id}
            AND current_document.status = 'current'
            AND current_document.deleted_at IS NULL
        )`,
        currentDocumentTitle: sql<string | null>`(
          SELECT current_document.title FROM document AS current_document
          WHERE current_document.topic_id = ${topicTable.id}
            AND current_document.status = 'current'
            AND current_document.deleted_at IS NULL
            AND ${documentVisibility(userId, {
              id: sql`current_document.id`,
              creatorId: sql`current_document.creator_id`,
              scope: sql`current_document.scope`,
              projectId: sql`current_document.project_id`,
              workProjectId: sql`current_document.work_project_id`,
              taskId: sql`current_document.task_id`,
            })}
        )`,
        following: sql<boolean>`EXISTS (
          SELECT 1 FROM topic_subscriber AS following
          WHERE following.topic_id = ${topicTable.id}
            AND following.user_id = ${userId}
        )`,
        createdAt: topicTable.createdAt,
        updatedAt: topicTable.updatedAt,
      })
      .from(topicTable)
      .leftJoin(decider, eq(decider.id, topicTable.deciderId))
      .leftJoin(backup, eq(backup.id, topicTable.backupDeciderId))
      .where(
        and(
          eq(topicTable.workspaceId, workspaceId),
          topicAccess(userId, topicTable.id),
          id === undefined ? undefined : eq(topicTable.id, id),
        ),
      )
      .orderBy(topicTable.name, topicTable.id),
    isWorkspaceOwner(workspaceId, userId),
  ]);
  return topics.map((topic) => ({
    ...topic,
    canDecide:
      owner || topic.deciderId === userId || topic.backupDeciderId === userId,
  }));
}

// Loads a topic the user can open, or 404s so hidden ids look missing.
export async function getTopic(
  workspaceId: string,
  id: string,
  userId: string,
) {
  const [topic] = await listTopics(workspaceId, userId, id);
  if (!topic) {
    throw new HTTPException(404, { message: "Topic not found" });
  }
  return topic;
}
