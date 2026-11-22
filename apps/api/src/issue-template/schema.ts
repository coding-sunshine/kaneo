import { z } from "../openapi";
import { VALID_PRIORITIES } from "../task/validate-task-fields";

export const projectIdParam = z.object({ projectId: z.string() });

export const templateIdParam = z.object({ id: z.string() });

const templateFields = {
  name: z.string().trim().min(1).max(200),
  title: z.string().max(500).optional().openapi({
    description: "Default issue title.",
  }),
  description: z.string().optional().openapi({
    description: "Default issue description (Markdown).",
  }),
  columnId: z.string().nullable().optional().openapi({
    description: "Default status: a column of the same team.",
  }),
  priority: z.enum(VALID_PRIORITIES).optional(),
  assigneeId: z.string().nullable().optional(),
  labels: z
    .array(z.object({ name: z.string().min(1), color: z.string().min(1) }))
    .max(50)
    .optional(),
};

export const createIssueTemplateBody = z.object({
  projectId: z.string(),
  ...templateFields,
});

export const updateIssueTemplateBody = z.object(templateFields).partial();
