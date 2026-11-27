import { type SQLWrapper, sql } from "drizzle-orm";
import { projectAccessCondition } from "../project-access/project-access-condition";

// The person in `memberId` can enter a project of the workspace that the
// viewer can enter too: the people a guest works with.
export function sharesProjectCondition(
  viewerId: string | SQLWrapper,
  memberId: SQLWrapper,
  workspaceId: string,
) {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM project AS shared_project
    WHERE shared_project.workspace_id = ${workspaceId}
      AND ${projectAccessCondition(viewerId, sql`shared_project.id`)}
      AND ${projectAccessCondition(memberId, sql`shared_project.id`)}
  )`;
}
