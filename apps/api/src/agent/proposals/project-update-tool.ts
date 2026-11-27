import type { ToolClient } from "@kaneo/mcp/tools";
import { z } from "zod";
import { WORK_PROJECT_HEALTHS } from "../../work-project/schema";

/** Drafts a project update; it is posted only when a person accepts it. */
export const PROJECT_UPDATE_TOOL = "create_project_update";

export const projectUpdateSchema = z.object({
  workProjectId: z
    .string()
    .trim()
    .min(1)
    .describe("The project's id, as list_work_projects shows it"),
  health: z.enum(WORK_PROJECT_HEALTHS),
  body: z.string().trim().min(1).max(20_000).describe("The update, Markdown"),
});
export type ProjectUpdateArgs = z.output<typeof projectUpdateSchema>;

export const PROJECT_UPDATE_DESCRIPTION =
  "Draft a project update (health and text) for a project. It is not posted: it becomes a draft on Pulse that a person accepts.";

export const listWorkProjectsSchema = z.object({
  workspaceId: z.string().trim().min(1),
});

export const LIST_WORK_PROJECTS_DESCRIPTION =
  "List the workspace's projects (not teams) with their id, name, health and progress.";

/** Posts the update through `client`, as the person who accepted it. */
export const postProjectUpdate = (
  client: ToolClient,
  args: ProjectUpdateArgs,
) =>
  client.json(
    `/api/work-project/${encodeURIComponent(args.workProjectId)}/update`,
    {
      method: "POST",
      body: JSON.stringify({ health: args.health, body: args.body }),
    },
  );

export const listWorkProjects = (
  client: ToolClient,
  args: z.output<typeof listWorkProjectsSchema>,
) =>
  client.json(
    `/api/work-project/workspace/${encodeURIComponent(args.workspaceId)}`,
  );
