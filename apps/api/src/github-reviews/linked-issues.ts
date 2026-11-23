import { and, eq, inArray, isNull } from "drizzle-orm";
import db from "../database";
import {
  externalLinkTable,
  projectTable,
  taskTable,
  workProjectTable,
  workspaceUserTable,
} from "../database/schema";

export type LinkedIssue = {
  taskId: string;
  title: string;
  priority: string;
  team: { id: string; name: string };
  project: { id: string; name: string } | null;
};

/** Kaneo tasks linked to the given pull request urls, limited to workspaces the user belongs to. */
export async function findLinkedIssues(userId: string, urls: string[]) {
  const issues = new Map<string, LinkedIssue>();
  if (urls.length === 0) return issues;
  const rows = await db
    .select({
      url: externalLinkTable.url,
      taskId: taskTable.id,
      title: taskTable.title,
      priority: taskTable.priority,
      teamId: projectTable.id,
      teamName: projectTable.name,
      projectId: workProjectTable.id,
      projectName: workProjectTable.name,
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
      ),
    );
  for (const row of rows) {
    if (issues.has(row.url)) continue;
    issues.set(row.url, {
      taskId: row.taskId,
      title: row.title,
      priority: row.priority,
      team: { id: row.teamId, name: row.teamName },
      project: row.projectId
        ? { id: row.projectId, name: row.projectName ?? "" }
        : null,
    });
  }
  return issues;
}
