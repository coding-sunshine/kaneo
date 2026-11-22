import { z } from "../openapi";
import { WORKSPACE_WEBHOOK_RESOURCE_TYPES } from "./types";

export const workspaceIdParam = z.object({ workspaceId: z.string() });
export const webhookIdParam = z.object({ id: z.string() });

const fields = {
  label: z.string().trim().min(1).max(100),
  url: z.string().url().max(2048),
  enabled: z.boolean().default(true),
  resourceTypes: z
    .array(z.enum(WORKSPACE_WEBHOOK_RESOURCE_TYPES))
    .min(1)
    .max(WORKSPACE_WEBHOOK_RESOURCE_TYPES.length),
  // Team (project) ids; empty means every team.
  projectIds: z.array(z.string()).max(500).default([]),
};

export const createWebhookBody = z.object({
  workspaceId: z.string(),
  ...fields,
});
export const updateWebhookBody = z.object({
  label: fields.label.optional(),
  url: fields.url.optional(),
  enabled: z.boolean().optional(),
  resourceTypes: fields.resourceTypes.optional(),
  projectIds: z.array(z.string()).max(500).optional(),
});

export const webhookSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    label: z.string(),
    url: z.string(),
    enabled: z.boolean(),
    resourceTypes: z.array(z.string()),
    projectIds: z.array(z.string()),
    createdBy: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi("WorkspaceWebhook");
export const webhookListSchema = z.array(webhookSchema);
export const createdWebhookSchema = z
  .object({ webhook: webhookSchema, secret: z.string() })
  .openapi("WorkspaceWebhookCreated");
export const deletedWebhookSchema = z.object({ id: z.string() });
