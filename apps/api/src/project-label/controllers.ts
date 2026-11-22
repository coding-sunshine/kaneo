import { and, asc, eq, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import {
  projectLabelTable,
  workProjectLabelTable,
  workProjectTable,
} from "../database/schema";

const columns = {
  id: projectLabelTable.id,
  workspaceId: projectLabelTable.workspaceId,
  name: projectLabelTable.name,
  color: projectLabelTable.color,
};
const duplicate = () =>
  new HTTPException(409, {
    message: "A project label with this name already exists",
  });

export const listProjectLabels = (workspaceId: string) =>
  db
    .select(columns)
    .from(projectLabelTable)
    .where(eq(projectLabelTable.workspaceId, workspaceId))
    .orderBy(asc(projectLabelTable.name));

export async function createProjectLabel(body: {
  workspaceId: string;
  name: string;
  color: string;
}) {
  const [created] = await db
    .insert(projectLabelTable)
    .values(body)
    .onConflictDoNothing()
    .returning(columns);
  if (!created) throw duplicate();
  return created;
}

async function workspaceOf(id: string) {
  const [label] = await db
    .select({ workspaceId: projectLabelTable.workspaceId })
    .from(projectLabelTable)
    .where(eq(projectLabelTable.id, id));
  if (!label)
    throw new HTTPException(404, { message: "Project label not found" });
  return label.workspaceId;
}

export async function updateProjectLabel(
  id: string,
  body: { name: string; color: string },
) {
  const workspaceId = await workspaceOf(id);
  const [clash] = await db
    .select({ id: projectLabelTable.id })
    .from(projectLabelTable)
    .where(
      and(
        eq(projectLabelTable.workspaceId, workspaceId),
        eq(projectLabelTable.name, body.name),
        ne(projectLabelTable.id, id),
      ),
    );
  if (clash) throw duplicate();
  const [updated] = await db
    .update(projectLabelTable)
    .set(body)
    .where(eq(projectLabelTable.id, id))
    .returning(columns);
  return updated;
}

export async function deleteProjectLabel(id: string) {
  await db.delete(projectLabelTable).where(eq(projectLabelTable.id, id));
  return { id };
}

export async function assignProjectLabel(
  labelId: string,
  workProjectId: string,
) {
  const workspaceId = await workspaceOf(labelId);
  const [project] = await db
    .select({ workspaceId: workProjectTable.workspaceId })
    .from(workProjectTable)
    .where(eq(workProjectTable.id, workProjectId));
  if (!project || project.workspaceId !== workspaceId)
    throw new HTTPException(400, {
      message: "Project is not in this label's workspace",
    });
  await db
    .insert(workProjectLabelTable)
    .values({ labelId, workProjectId })
    .onConflictDoNothing();
  return { labelId, workProjectId };
}

export async function unassignProjectLabel(
  labelId: string,
  workProjectId: string,
) {
  await db
    .delete(workProjectLabelTable)
    .where(
      and(
        eq(workProjectLabelTable.labelId, labelId),
        eq(workProjectLabelTable.workProjectId, workProjectId),
      ),
    );
  return { labelId, workProjectId };
}
