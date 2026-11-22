import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable, projectTable } from "../../database/schema";

// A team (project) label must belong to a project of the workspace; a group
// parent must be a top-level template label of the same workspace whose scope
// (workspace-wide or the same team) fits the child.
export async function assertLabelScope(opts: {
  workspaceId: string;
  projectId?: string | null;
  parentLabelId?: string | null;
  labelId?: string;
}) {
  const { workspaceId, projectId, parentLabelId, labelId } = opts;
  if (projectId) {
    const project = await db.query.projectTable.findFirst({
      where: eq(projectTable.id, projectId),
      columns: { workspaceId: true },
    });
    if (!project || project.workspaceId !== workspaceId)
      throw new HTTPException(404, { message: "Project not found" });
  }
  if (!parentLabelId) return;
  const parent = await db.query.labelTable.findFirst({
    where: eq(labelTable.id, parentLabelId),
  });
  if (!parent || parent.workspaceId !== workspaceId || parent.taskId)
    throw new HTTPException(404, { message: "Parent label not found" });
  if (parent.parentLabelId || parentLabelId === labelId)
    throw new HTTPException(400, { message: "Label groups cannot be nested" });
  if (parent.projectId && parent.projectId !== projectId)
    throw new HTTPException(400, {
      message: "A team label group cannot contain labels of another scope",
    });
  if (labelId) {
    const child = await db.query.labelTable.findFirst({
      where: eq(labelTable.parentLabelId, labelId),
      columns: { id: true },
    });
    if (child)
      throw new HTTPException(400, {
        message: "A label group cannot be placed in another group",
      });
  }
}
