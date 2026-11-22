import type { getWorkspaceWebhooks } from "./get-workspace-webhooks";

export type WorkspaceWebhook = Awaited<
  ReturnType<typeof getWorkspaceWebhooks>
>[number];
export type WorkspaceWebhookValues = Pick<
  WorkspaceWebhook,
  "label" | "url" | "enabled" | "resourceTypes" | "projectIds"
>;
export const WEBHOOK_RESOURCE_TYPES = [
  "task",
  "comment",
  "project",
  "label",
  "cycle",
] as const;
