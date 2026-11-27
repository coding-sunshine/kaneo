import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  type DocumentScope,
  projectTable,
  taskTable,
  workProjectTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { workProjectDocumentAccess } from "../visibility";

type ParentInput = {
  scope?: DocumentScope;
  projectId?: string | null;
  workProjectId?: string | null;
  taskId?: string | null;
};

const parentNotFound = () =>
  new HTTPException(400, { message: "Document parent not found" });

// Normalizes where a document lives and checks the parent is in the workspace
// and visible to the user placing the document there. A place the user cannot
// enter answers like one that does not exist, by the same query, so a refusal
// never confirms that a hidden team, project or issue is there.
export async function resolveParent(
  workspaceId: string,
  userId: string,
  input: ParentInput,
) {
  const scope: DocumentScope =
    input.scope ??
    (input.taskId
      ? "issue"
      : input.workProjectId
        ? "project"
        : input.projectId
          ? "team"
          : "private");
  const none = { scope, projectId: null, workProjectId: null, taskId: null };

  if (scope === "team") {
    if (!input.projectId) throw parentNotFound();
    const [team] = await db
      .select({ id: projectTable.id })
      .from(projectTable)
      .where(
        and(
          eq(projectTable.id, input.projectId),
          eq(projectTable.workspaceId, workspaceId),
          projectAccessCondition(userId, projectTable.id),
        ),
      );
    if (!team) throw parentNotFound();
    return { ...none, projectId: team.id };
  }

  if (scope === "project") {
    if (!input.workProjectId) throw parentNotFound();
    const [project] = await db
      .select({
        id: workProjectTable.id,
        open: workProjectDocumentAccess(userId, workProjectTable.id),
      })
      .from(workProjectTable)
      .where(
        and(
          eq(workProjectTable.id, input.workProjectId),
          eq(workProjectTable.workspaceId, workspaceId),
        ),
      );
    if (!project?.open) throw parentNotFound();
    return { ...none, workProjectId: project.id };
  }

  if (scope === "issue") {
    if (!input.taskId) throw parentNotFound();
    const [task] = await db
      .select({ id: taskTable.id })
      .from(taskTable)
      .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
      .where(
        and(
          eq(taskTable.id, input.taskId),
          eq(projectTable.workspaceId, workspaceId),
          projectAccessCondition(userId, projectTable.id),
        ),
      );
    if (!task) throw parentNotFound();
    return { ...none, taskId: task.id };
  }

  return none;
}
