import { type SQLWrapper, sql } from "drizzle-orm";

// A team is closed to a person when it is private, or when the person is
// limited to chosen teams, and they are neither the workspace owner nor hold a
// row for it. Instance administrators pass always. Every access check in the
// API goes through this one condition.
export function projectAccessCondition(
  userId: string | SQLWrapper,
  projectId: string | SQLWrapper,
) {
  // Wrapped, so a column keeps its table name. In the select list of a query
  // on one table Drizzle writes a bare column name, which the subqueries
  // below would read as a column of their own table.
  const user = sql`${userId}`;
  const project = sql`${projectId}`;
  return sql<boolean>`(
    EXISTS (
      SELECT 1 FROM "user" AS access_user
      WHERE access_user.id = ${user}
        AND 'admin' = ANY(string_to_array(access_user.role, ','))
    )
    OR NOT EXISTS (
      SELECT 1 FROM project AS access_project
      WHERE access_project.id = ${project}
        AND (
          access_project.is_private
          OR EXISTS (
            SELECT 1 FROM workspace_member_access AS access_rule
            WHERE access_rule.workspace_id = access_project.workspace_id
              AND access_rule.user_id = ${user}
              AND access_rule.project_access <> 'all'
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM workspace_member AS access_member
          WHERE access_member.workspace_id = access_project.workspace_id
            AND access_member.user_id = ${user}
            AND 'owner' = ANY(string_to_array(access_member.role, ','))
        )
        AND NOT EXISTS (
          SELECT 1 FROM workspace_member_project AS access_grant
          WHERE access_grant.workspace_id = access_project.workspace_id
            AND access_grant.user_id = ${user}
            AND access_grant.project_id = access_project.id
        )
    )
  )`;
}
