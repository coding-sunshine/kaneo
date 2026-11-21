import { and, eq, inArray, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import db from "../../database";
import {
  projectTable,
  workProjectMemberTable,
  workProjectTable,
  workProjectTeamTable,
} from "../../database/schema";
import { filterAssignableUsers } from "../../utils/assert-assignable-user";
import { validateAndParseDate } from "../../utils/validate-dates";
import type { createWorkProjectBody, updateWorkProjectBody } from "../schema";
import { loadWorkProjectDetail } from "./load-work-projects";

type Body = Partial<z.infer<typeof createWorkProjectBody>> &
  z.infer<typeof updateWorkProjectBody>;

const date = (value: string | null | undefined, field: string) =>
  value == null ? value : validateAndParseDate(value, field);

async function assertRefs(workspaceId: string, body: Body) {
  const userIds = [
    ...new Set([...(body.memberIds ?? []), body.leadId ?? ""]),
  ].filter(Boolean);
  const assignable = await filterAssignableUsers(userIds, workspaceId);
  if (userIds.some((id) => !assignable.has(id)))
    throw new HTTPException(400, {
      message: "Lead and members must belong to the workspace",
    });
  const teamIds = [...new Set(body.teamIds ?? [])];
  if (teamIds.length) {
    const teams = await db
      .select({ id: projectTable.id })
      .from(projectTable)
      .where(
        and(
          inArray(projectTable.id, teamIds),
          eq(projectTable.workspaceId, workspaceId),
        ),
      );
    if (teams.length !== teamIds.length)
      throw new HTTPException(400, {
        message: "Teams must belong to the workspace",
      });
  }
}

export async function saveWorkProject(body: Body, existingId?: string) {
  const existing = existingId
    ? (
        await db
          .select({
            id: workProjectTable.id,
            workspaceId: workProjectTable.workspaceId,
          })
          .from(workProjectTable)
          .where(eq(workProjectTable.id, existingId))
      )[0]
    : undefined;
  if (existingId && !existing)
    throw new HTTPException(404, { message: "Project not found" });
  const workspaceId = existing?.workspaceId ?? body.workspaceId;
  if (!workspaceId)
    throw new HTTPException(400, { message: "Workspace ID is required" });
  await assertRefs(workspaceId, body);

  const values = {
    name: body.name,
    icon: body.icon,
    color: body.color,
    status: body.status,
    health: body.health,
    priority: body.priority,
    leadId: body.leadId,
    summary: body.summary,
    description: body.description,
    startDate: date(body.startDate, "startDate"),
    targetDate: date(body.targetDate, "targetDate"),
  };

  const id = await db.transaction(async (tx) => {
    let projectId = existing?.id;
    if (projectId) {
      if (body.name !== undefined) {
        const [clash] = await tx
          .select({ id: workProjectTable.id })
          .from(workProjectTable)
          .where(
            and(
              eq(workProjectTable.workspaceId, workspaceId),
              eq(workProjectTable.name, body.name),
              ne(workProjectTable.id, projectId),
            ),
          );
        if (clash)
          throw new HTTPException(409, {
            message: "A project with this name already exists",
          });
      }
      await tx
        .update(workProjectTable)
        .set(values)
        .where(eq(workProjectTable.id, projectId));
    } else {
      const [created] = await tx
        .insert(workProjectTable)
        .values({ ...values, name: body.name as string, workspaceId })
        .onConflictDoNothing()
        .returning({ id: workProjectTable.id });
      if (!created)
        throw new HTTPException(409, {
          message: "A project with this name already exists",
        });
      projectId = created.id;
    }
    if (body.teamIds) {
      await tx
        .delete(workProjectTeamTable)
        .where(eq(workProjectTeamTable.workProjectId, projectId));
      const teamIds = [...new Set(body.teamIds)];
      if (teamIds.length)
        await tx.insert(workProjectTeamTable).values(
          teamIds.map((teamId) => ({
            workProjectId: projectId,
            projectId: teamId,
          })),
        );
    }
    if (body.memberIds) {
      await tx
        .delete(workProjectMemberTable)
        .where(eq(workProjectMemberTable.workProjectId, projectId));
      const memberIds = [...new Set(body.memberIds)];
      if (memberIds.length)
        await tx
          .insert(workProjectMemberTable)
          .values(
            memberIds.map((userId) => ({ workProjectId: projectId, userId })),
          );
    }
    return projectId;
  });
  return loadWorkProjectDetail(id);
}
