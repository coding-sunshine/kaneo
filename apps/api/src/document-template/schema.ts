import { responseTimestamp, z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const templateParam = z.object({
  workspaceId: z.string(),
  id: z.string(),
});

export const saveTemplateBody = z.object({
  documentId: z.string().openapi({
    description:
      "The page to copy. It must be open to the whole workspace (scope workspace).",
  }),
  name: z.string().trim().min(1).max(200).optional().openapi({
    description: "Shown in the template list. Defaults to the page title.",
  }),
});

export const documentTemplateSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    title: z.string(),
    content: z.string(),
    creatorId: z.string().nullable(),
    createdAt: responseTimestamp,
  })
  .openapi("DocumentTemplate");

export const documentTemplateListSchema = z.array(documentTemplateSchema);
