import { and, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import db from "../../database";
import {
  userTable,
  workspaceRoleTable,
  workspaceUserTable,
} from "../../database/schema";
import { hasInstanceAdminRole } from "../../utils/instance-admin-role";
import { rolesAllow } from "../../utils/role-permissions";
import { splitRoles } from "../../utils/split-roles";
import { notBannedCondition } from "../../utils/user-ban";
import type { audienceQuery } from "../schema";
import { documentVisibility } from "../visibility";
import { loadDocument } from "./load-document";
import { resolveParent } from "./resolve-parent";

type Place = {
  id: string | null;
  creatorId: string | null;
  scope: string;
  projectId: string | null;
  workProjectId: string | null;
  taskId: string | null;
};

// The workspace members who could open a document that lives in `place`: the
// rule `loadDocument` applies to one person, asked of every member at once.
// An instance administrator who has not joined the workspace is left out.
async function audienceOf(workspaceId: string, place: Place) {
  const [people, stored] = await Promise.all([
    db
      .select({
        userId: userTable.id,
        name: userTable.name,
        image: userTable.image,
        instanceRole: userTable.role,
        memberRole: workspaceUserTable.role,
      })
      .from(workspaceUserTable)
      .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
      .where(
        and(
          eq(workspaceUserTable.workspaceId, workspaceId),
          notBannedCondition(),
          documentVisibility(userTable.id, {
            id: sql`${place.id}::text`,
            creatorId: sql`${place.creatorId}::text`,
            scope: sql`${place.scope}::text`,
            projectId: sql`${place.projectId}::text`,
            workProjectId: sql`${place.workProjectId}::text`,
            taskId: sql`${place.taskId}::text`,
          }),
        ),
      )
      .orderBy(userTable.name, userTable.id),
    db
      .select({
        role: workspaceRoleTable.role,
        permission: workspaceRoleTable.permission,
      })
      .from(workspaceRoleTable)
      .where(eq(workspaceRoleTable.workspaceId, workspaceId)),
  ]);
  // The document routes ask for this permission before anything else.
  return people
    .filter(
      (person) =>
        hasInstanceAdminRole(person.instanceRole) ||
        rolesAllow(splitRoles(person.memberRole), stored, { task: ["read"] }),
    )
    .map(({ userId, name, image }) => ({ userId, name, image }));
}

export async function documentAudience(
  workspaceId: string,
  id: string,
  userId: string,
  target: z.infer<typeof audienceQuery>,
) {
  const doc = await loadDocument(workspaceId, id, userId);
  const asked = Object.values(target).some(Boolean);
  // Refuses a place the asker cannot enter: its audience is not theirs to read.
  const parent = asked
    ? await resolveParent(workspaceId, userId, target)
    : null;
  const [current, proposed] = await Promise.all([
    audienceOf(workspaceId, doc),
    parent &&
      audienceOf(workspaceId, {
        ...parent,
        creatorId: doc.creatorId,
        // Going private drops every share, so no share row may match.
        id: parent.scope === "private" ? null : doc.id,
      }),
  ]);
  return { current, proposed };
}
