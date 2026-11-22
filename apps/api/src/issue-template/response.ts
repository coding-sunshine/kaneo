import { responseTimestamp, z } from "../openapi";

export const issueTemplateSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    title: z.string(),
    description: z.string(),
    columnId: z.string().nullable(),
    priority: z.string(),
    assigneeId: z.string().nullable(),
    labels: z.array(z.object({ name: z.string(), color: z.string() })),
    position: z.number(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("IssueTemplate");

export const issueTemplateListSchema = z.array(issueTemplateSchema);
