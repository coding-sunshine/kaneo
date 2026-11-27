import { z } from "../openapi";

export const taskIdParam = z.object({ taskId: z.string() });

export const projectIdParam = z.object({ projectId: z.string() });

export const documentParam = z.object({
  workspaceId: z.string(),
  documentId: z.string(),
});
