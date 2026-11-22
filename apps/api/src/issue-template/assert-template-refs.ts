import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { columnTable } from "../database/schema";
import { assertAssignableUser } from "../utils/assert-assignable-user";

// A template may only point at a status of its own team and an assignee who
// can work in it.
export async function assertTemplateRefs(
  workspaceId: string,
  projectId: string,
  {
    columnId,
    assigneeId,
  }: { columnId?: string | null; assigneeId?: string | null },
) {
  if (columnId) {
    const [column] = await db
      .select({ id: columnTable.id })
      .from(columnTable)
      .where(
        and(eq(columnTable.id, columnId), eq(columnTable.projectId, projectId)),
      )
      .limit(1);
    if (!column) {
      throw new HTTPException(400, {
        message: "Status not found in this team",
      });
    }
  }
  if (assigneeId) {
    await assertAssignableUser(assigneeId, workspaceId, projectId);
  }
}
