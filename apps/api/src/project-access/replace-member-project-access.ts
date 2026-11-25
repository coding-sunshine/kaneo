import { and, eq, inArray } from "drizzle-orm";
import { schema } from "../database";
import type { DbOrTx } from "./db-or-tx";
import type { ProjectAccessMode } from "./project-access-mode";

const grants = schema.workspaceMemberProjectTable;
const rules = schema.workspaceMemberAccessTable;
const projects = schema.projectTable;

// Sets a member's mode and their chosen teams. Who is in a private team is
// set on the team, so this never adds or removes a row on a private team:
// changing a member's mode or list cannot put them into one or take them out.
export async function replaceMemberProjectAccess(
  database: DbOrTx,
  access: {
    workspaceId: string;
    userId: string;
    projectAccess: ProjectAccessMode;
    projectIds: readonly string[];
  },
): Promise<void> {
  const { workspaceId, userId, projectAccess } = access;

  if (projectAccess === "all") {
    await database
      .delete(rules)
      .where(and(eq(rules.workspaceId, workspaceId), eq(rules.userId, userId)));
  } else {
    await database
      .insert(rules)
      .values({ workspaceId, userId, projectAccess })
      .onConflictDoUpdate({
        target: [rules.workspaceId, rules.userId],
        set: { projectAccess, updatedAt: new Date() },
      });
  }

  await database.delete(grants).where(
    and(
      eq(grants.workspaceId, workspaceId),
      eq(grants.userId, userId),
      inArray(
        grants.projectId,
        database
          .select({ id: projects.id })
          .from(projects)
          .where(
            and(
              eq(projects.workspaceId, workspaceId),
              eq(projects.isPrivate, false),
            ),
          ),
      ),
    ),
  );

  if (projectAccess === "all" || access.projectIds.length === 0) return;

  // The row lock waits for a change of a team's privacy that is under way and
  // reads the flag after it, so no row lands on a team that just went private.
  const open = await database
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        inArray(projects.id, [...access.projectIds]),
        eq(projects.isPrivate, false),
      ),
    )
    .for("key share");
  if (open.length === 0) return;

  await database
    .insert(grants)
    .values(open.map(({ id }) => ({ workspaceId, userId, projectId: id })))
    .onConflictDoNothing();
}
