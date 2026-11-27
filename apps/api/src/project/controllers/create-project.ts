import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { publishEvent } from "../../events";
import { hideClosedTeams } from "../../project-access/hide-closed-teams";
import { copyProjectSettings } from "./copy-project-settings";
import { insertProject } from "./insert-project";

async function createProject(
  workspaceId: string,
  name: string,
  icon: string,
  slug: string,
  userId: string,
  copySettingsFromProjectId?: string,
) {
  if (copySettingsFromProjectId) {
    await hideClosedTeams(
      userId,
      copySettingsFromProjectId,
      () => new HTTPException(404, { message: "Source project not found" }),
    );
  }
  const project = await db.transaction(async (tx) => {
    const created = await insertProject(tx, {
      workspaceId,
      name,
      icon,
      slug,
      userId,
    });
    if (created && copySettingsFromProjectId) {
      return copyProjectSettings(tx, {
        sourceId: copySettingsFromProjectId,
        targetId: created.id,
        workspaceId,
      });
    }
    return created;
  });
  if (project?.id)
    await publishEvent("project.created", { projectId: project.id });
  return project;
}

export default createProject;
