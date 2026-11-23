import { responseTimestamp, z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });
export const draftParam = z.object({
  workspaceId: z.string(),
  id: z.string(),
});

const fields = {
  projectId: z.string().nullable().optional(),
  title: z.string().max(500).default(""),
  description: z.string().max(100_000).default(""),
  properties: z.record(z.string(), z.unknown()).default({}).openapi({
    description:
      "Priority, assignee, labels, dates and cycle; the web create form owns the shape.",
  }),
};

export const draftBody = z.object(fields);

export const draftSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  properties: z.record(z.string(), z.unknown()),
  createdAt: responseTimestamp,
  updatedAt: responseTimestamp,
});

export const draftListSchema = z.array(draftSchema);
export const deletedDraftSchema = z.object({ id: z.string() });
