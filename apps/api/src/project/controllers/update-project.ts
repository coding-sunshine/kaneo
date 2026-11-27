import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { publishEvent } from "../../events";
import { projectTable } from "../../database/schema";
import { findInaccessibleProjectIds } from "../../project-access/find-inaccessible-project-ids";
import { lockAccessChange } from "../../project-access/lock-access-change";
import { changeProjectPrivacy } from "./change-project-privacy";
import {
  findProjectKeyConflict,
  isSameProjectKey,
  projectKeyTakenMessage,
} from "../project-key";

type PrivacyChange = Awaited<ReturnType<typeof changeProjectPrivacy>>;

async function announce(
  workspaceId: string,
  projectId: string,
  actorId: string,
  change: PrivacyChange,
) {
  await publishEvent("project_members.updated", {
    workspaceId,
    projectIds: [projectId],
  });
  if (change.unassigned) {
    await publishEvent("task.bulk_unassigned", { projectId, userId: actorId });
  }
  // ponytail: one event per member whose access changed. Send one event with
  // the whole list when a workspace holds thousands of members.
  for (const userId of change.changedUserIds) {
    await publishEvent("project_access.updated", {
      workspaceId,
      userId,
      projectIds: [],
    });
  }
}

async function updateProject(
  id: string,
  name: string,
  icon: string,
  slug: string,
  description: string,
  isPublic: boolean,
  workspaceId: string,
  canShare: boolean,
  includeSubtasks?: boolean,
  autoArchiveMonths?: number,
  estimation: Partial<
    Pick<
      typeof projectTable.$inferInsert,
      | "estimateType"
      | "estimateExtended"
      | "estimateAllowZero"
      | "estimateCountUnestimated"
    >
  > = {},
  // Given only when the request names `isPrivate`. A body without the field
  // leaves the team as it is, so an older client cannot flip it.
  // Going private unassigns outsiders and deletes calendar links, and opening
  // the team again restores neither, so that change waits for `confirmed`.
  privacy?: { isPrivate: boolean; actorId: string; confirmed?: boolean },
) {
  const { updated, privacyChange } = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(1524, hashtext(${workspaceId}))`,
    );
    // Same order as every change to who can open a team: the caller's member
    // row first, then the team row.
    const lock = privacy
      ? await lockAccessChange(tx, {
          workspaceId,
          actorId: privacy.actorId,
          userId: privacy.actorId,
        })
      : null;

    const [existingProject] = await tx
      .select()
      .from(projectTable)
      .where(
        and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
      )
      .for("update");

    if (!existingProject) {
      throw new HTTPException(404, {
        message:
          "Project doesn't exist or doesn't belong to the specified workspace",
      });
    }

    if (isPublic !== existingProject.isPublic && !canShare) {
      throw new HTTPException(403, {
        message:
          "Changing project visibility requires the project:share permission",
      });
    }

    let privacyChange: PrivacyChange | null = null;
    const isPrivate = privacy?.isPrivate ?? existingProject.isPrivate;
    if (isPrivate && isPublic) {
      throw new HTTPException(400, {
        message: "A private team can't be shared publicly",
      });
    }
    if (privacy && isPrivate !== existingProject.isPrivate) {
      // It changes who has access, so it needs what editing a member's access
      // needs, and a caller who lost the team since the route check is refused.
      if (
        !lock?.actorAllowed ||
        (await findInaccessibleProjectIds(privacy.actorId, [id], tx)).length
      ) {
        throw new HTTPException(403, {
          message: "Changing who can open a team requires member:update",
        });
      }
      privacyChange = await changeProjectPrivacy(tx, {
        workspaceId,
        projectId: id,
        actorId: privacy.actorId,
        isPrivate,
      });
      if (
        (privacyChange.unassigned || privacyChange.removedLinks) &&
        !privacy.confirmed
      ) {
        throw new HTTPException(409, {
          message:
            "Making this team private unassigns issues or deletes calendar links, and opening it again does not bring them back. Send confirmPrivate: true to go ahead.",
        });
      }
    }

    if (!isSameProjectKey(slug, existingProject.slug)) {
      const keyConflict = await findProjectKeyConflict(tx, workspaceId, slug, {
        excludeProjectId: id,
      });
      if (keyConflict) {
        throw new HTTPException(409, {
          message: projectKeyTakenMessage(slug, keyConflict.name),
        });
      }
    }

    const [updatedProject] = await tx
      .update(projectTable)
      .set({
        name,
        icon,
        slug,
        description,
        isPublic,
        ...(includeSubtasks === undefined ? {} : { includeSubtasks }),
        ...(autoArchiveMonths === undefined ? {} : { autoArchiveMonths }),
        ...estimation,
      })
      .where(eq(projectTable.id, id))
      .returning();

    return { updated: updatedProject, privacyChange };
  });
  if (updated) await publishEvent("project.updated", { projectId: id });
  if (privacy && privacyChange) {
    await announce(workspaceId, id, privacy.actorId, privacyChange);
  }
  return updated;
}

export default updateProject;
