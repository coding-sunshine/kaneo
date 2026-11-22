import { z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });
export const projectLabelParam = z.object({ id: z.string() });
export const assignmentParam = z.object({
  id: z.string(),
  workProjectId: z.string(),
});

export const createProjectLabelBody = z.object({
  workspaceId: z.string(),
  name: z.string().trim().min(1).max(255),
  color: z.string().max(64),
});

export const updateProjectLabelBody = z.object({
  name: z.string().trim().min(1).max(255),
  color: z.string().max(64),
});

export const assignProjectLabelBody = z.object({ workProjectId: z.string() });

export const projectLabelSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    color: z.string(),
  })
  .openapi("ProjectLabel");

export const projectLabelListSchema = z.array(projectLabelSchema);
export const projectLabelIdSchema = z.object({ id: z.string() });
export const assignmentSchema = z.object({
  labelId: z.string(),
  workProjectId: z.string(),
});
