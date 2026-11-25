import { and, eq, inArray, isNull } from "drizzle-orm";
import db from "../database";
import {
  externalLinkTable,
  projectTable,
  taskTable,
  workProjectTable,
  workspaceUserTable,
} from "../database/schema";
import { projectAccessCondition } from "../project-access/project-access-condition";

export type LinkedIssue = {
  taskId: string;
  workspaceId: string;
  /** The external_link row, so a manual link can be removed. */
  linkId: string;
  /** False for links an integration manages; those cannot be removed here. */
  manual: boolean;
  title: string;
  priority: string;
  team: { id: string; name: string };
  project: { id: string; name: string } | null;
  slaDueAt: string | null;
  completedAt: string | null;
};

/** Kaneo tasks linked to the given pull request urls, limited to the teams the user can open. */
export async function findLinkedIssues(userId: string, urls: string[]) {
  const issues = new Map<string, LinkedIssue>();
  if (urls.length === 0) return issues;
  const rows = await db
    .select({
      url: externalLinkTable.url,
      taskId: taskTable.id,
      workspaceId: projectTable.workspaceId,
      linkId: externalLinkTable.id,
      integrationId: externalLinkTable.integrationId,
      title: taskTable.title,
      priority: taskTable.priority,
      teamId: projectTable.id,
      teamName: projectTable.name,
      projectId: workProjectTable.id,
      projectName: workProjectTable.name,
      slaDueAt: taskTable.slaDueAt,
      completedAt: taskTable.completedAt,
    })
    .from(externalLinkTable)
    .innerJoin(taskTable, eq(taskTable.id, externalLinkTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, projectTable.workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .leftJoin(
      workProjectTable,
      eq(workProjectTable.id, taskTable.workProjectId),
    )
    .where(
      and(
        inArray(externalLinkTable.url, urls),
        eq(externalLinkTable.resourceType, "pull_request"),
        isNull(taskTable.archivedAt),
        projectAccessCondition(userId, projectTable.id),
      ),
    );
  for (const row of rows) {
    if (issues.has(row.url)) continue;
    issues.set(row.url, {
      taskId: row.taskId,
      workspaceId: row.workspaceId,
      linkId: row.linkId,
      manual: row.integrationId === null,
      title: row.title,
      priority: row.priority,
      team: { id: row.teamId, name: row.teamName },
      project: row.projectId
        ? { id: row.projectId, name: row.projectName ?? "" }
        : null,
      slaDueAt: row.slaDueAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
    });
  }
  return issues;
}
