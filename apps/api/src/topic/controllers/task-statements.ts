import { and, eq, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  assetTable,
  projectTable,
  taskStatementTable,
  taskTable,
  taskTopicTable,
  topicSlotTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { getTopic } from "./get-topic";

// The facts read from issues for one topic's slots, on issues the person can
// open. An issue in a team they cannot enter gives no row, so nothing counted
// or shown from this list says anything about it.
const factsOf = (
  workspaceId: string,
  topicId: string,
  userId: string,
  only?: SQL,
) =>
  db
    .select({
      id: taskStatementTable.id,
      slot: topicSlotTable.key,
      slotName: topicSlotTable.name,
      value: taskStatementTable.value,
      quote: taskStatementTable.quote,
      taskId: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      projectSlug: projectTable.slug,
      fileId: assetTable.id,
      filename: assetTable.filename,
      linkedTopic: taskTopicTable.topicId,
      dismissedAt: taskStatementTable.dismissedAt,
    })
    .from(taskStatementTable)
    .innerJoin(
      topicSlotTable,
      and(
        eq(topicSlotTable.id, taskStatementTable.slotId),
        eq(topicSlotTable.topicId, topicId),
      ),
    )
    .innerJoin(taskTable, eq(taskTable.id, taskStatementTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(assetTable, eq(assetTable.id, taskStatementTable.assetId))
    .leftJoin(
      taskTopicTable,
      and(
        eq(taskTopicTable.taskId, taskTable.id),
        eq(taskTopicTable.topicId, topicId),
      ),
    )
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        projectAccessCondition(userId, projectTable.id),
        only,
      ),
    )
    .orderBy(
      projectTable.slug,
      taskTable.number,
      topicSlotTable.key,
      taskStatementTable.id,
    );

/** What issues say about a topic's slots, as proposals a person acts on. */
export async function listTaskStatements(
  workspaceId: string,
  topicId: string,
  userId: string,
) {
  await getTopic(workspaceId, topicId, userId);
  const rows = await factsOf(workspaceId, topicId, userId);
  return {
    statements: rows.map((row) => ({
      id: row.id,
      slot: row.slot,
      slotName: row.slotName,
      value: row.value,
      quote: row.quote,
      task: {
        id: row.taskId,
        title: row.title,
        number: row.number,
        projectSlug: row.projectSlug,
      },
      file:
        row.fileId && row.filename
          ? { id: row.fileId, filename: row.filename }
          : null,
      onTopic: row.linkedTopic !== null,
      dismissed: row.dismissedAt !== null,
    })),
  };
}

// Dismissing hides a proposal and can be undone. It changes nothing the topic
// states, so it is not kept to the decider: anyone who may edit issues and can
// open both the topic and the issue does it. A fact on another topic, or on an
// issue the person cannot open, answers like one that does not exist.
export async function setTaskStatementDismissed(
  workspaceId: string,
  topicId: string,
  factId: string,
  userId: string,
  dismissed: boolean,
) {
  await getTopic(workspaceId, topicId, userId);
  const [fact] = await factsOf(
    workspaceId,
    topicId,
    userId,
    eq(taskStatementTable.id, factId),
  );
  if (!fact) throw new HTTPException(404, { message: "Fact not found" });
  await db
    .update(taskStatementTable)
    .set(
      dismissed
        ? { dismissedBy: userId, dismissedAt: new Date() }
        : { dismissedBy: null, dismissedAt: null },
    )
    .where(eq(taskStatementTable.id, factId));
  return { id: factId, dismissed };
}
