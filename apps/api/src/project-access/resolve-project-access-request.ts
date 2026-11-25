import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "../database";
import type { DbOrTx } from "./db-or-tx";
import { isProjectAccessRestricted } from "./is-project-access-restricted";
import { isOwnerRole } from "./is-owner-role";
import { projectAccessCondition } from "./project-access-condition";
import {
  isProjectAccessMode,
  type ProjectAccessMode,
} from "./project-access-mode";

export type ResolvedProjectAccess = {
  projectAccess: ProjectAccessMode;
  projectIds: string[];
};

type Resolution =
  | { ok: true; access: ResolvedProjectAccess }
  | { ok: false; status: 400 | 403; message: string };

const GRANT_DENIED =
  "You can only give access to projects you can access yourself";

export async function resolveProjectAccessRequest(request: {
  workspaceId: string;
  actorId: string;
  targetRole: string | null | undefined;
  projectAccess: unknown;
  projectIds: unknown;
  database?: DbOrTx;
}): Promise<Resolution> {
  const database = request.database ?? db;
  const projectAccess = request.projectAccess ?? "all";
  if (!isProjectAccessMode(projectAccess)) {
    return {
      ok: false,
      status: 400,
      message: 'Project access must be "all" or "selected"',
    };
  }

  const rawIds = request.projectIds ?? [];
  if (!Array.isArray(rawIds) || rawIds.some((id) => typeof id !== "string")) {
    return {
      ok: false,
      status: 400,
      message: "Project IDs must be a list of strings",
    };
  }

  if (projectAccess === "selected" && isOwnerRole(request.targetRole)) {
    return {
      ok: false,
      status: 400,
      message: "Owners always have access to every project",
    };
  }

  if (projectAccess === "all") {
    if (
      await isProjectAccessRestricted(
        request.workspaceId,
        request.actorId,
        database,
      )
    ) {
      return { ok: false, status: 403, message: GRANT_DENIED };
    }
    return { ok: true, access: { projectAccess, projectIds: [] } };
  }

  const projectIds = [...new Set(rawIds as string[])];
  const teams = projectIds.length
    ? await database
        .select({
          id: schema.projectTable.id,
          isPrivate: schema.projectTable.isPrivate,
          open: projectAccessCondition(request.actorId, schema.projectTable.id),
        })
        .from(schema.projectTable)
        .where(
          and(
            eq(schema.projectTable.workspaceId, request.workspaceId),
            inArray(schema.projectTable.id, projectIds),
          ),
        )
    : [];
  // A private team the caller cannot open answers like an id from another
  // workspace, so this endpoint cannot be used to find one.
  const known = teams.filter((team) => team.open || !team.isPrivate);
  if (known.length !== projectIds.length) {
    return {
      ok: false,
      status: 400,
      message: "Some selected projects don't belong to this workspace",
    };
  }
  if (known.some((team) => !team.open)) {
    return { ok: false, status: 403, message: GRANT_DENIED };
  }

  // Who is in a private team is set on the team, never here, so a private id
  // is neither granted nor sent back.
  return {
    ok: true,
    access: {
      projectAccess,
      projectIds: known
        .filter((team) => !team.isPrivate)
        .map((team) => team.id),
    },
  };
}
