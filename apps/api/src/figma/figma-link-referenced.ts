import { and, eq, isNull, like } from "drizzle-orm";
import db from "../database";
import {
  activityTable,
  documentTable,
  projectTable,
  taskTable,
} from "../database/schema";
import { documentVisibility } from "../document/visibility";
import { projectAccessCondition } from "../project-access/project-access-condition";

/**
 * Whether the file key shows up in a task description, comment or document
 * of the workspace that the person can read. The token can open far more
 * files than the workspace links to; only linked ones get a card.
 */
export async function figmaLinkReferenced({
  workspaceId,
  userId,
  fileKey,
}: {
  workspaceId: string;
  userId: string;
  fileKey: string;
}) {
  // File keys are letters and digits only, so they need no LIKE escaping.
  const pattern = `%${fileKey}%`;
  const inWorkspaceTeam = and(
    eq(projectTable.workspaceId, workspaceId),
    projectAccessCondition(userId, projectTable.id),
  );

  const [task] = await db
    .select({ id: taskTable.id })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(and(inWorkspaceTeam, like(taskTable.description, pattern)))
    .limit(1);
  if (task) return true;

  const [comment] = await db
    .select({ id: activityTable.id })
    .from(activityTable)
    .innerJoin(taskTable, eq(taskTable.id, activityTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        inWorkspaceTeam,
        eq(activityTable.type, "comment"),
        like(activityTable.content, pattern),
      ),
    )
    .limit(1);
  if (comment) return true;

  const [document] = await db
    .select({ id: documentTable.id })
    .from(documentTable)
    .where(
      and(
        eq(documentTable.workspaceId, workspaceId),
        isNull(documentTable.deletedAt),
        like(documentTable.content, pattern),
        documentVisibility(userId, {
          id: documentTable.id,
          workspaceId: documentTable.workspaceId,
          creatorId: documentTable.creatorId,
          scope: documentTable.scope,
          projectId: documentTable.projectId,
          workProjectId: documentTable.workProjectId,
          taskId: documentTable.taskId,
        }),
      ),
    )
    .limit(1);
  return Boolean(document);
}
