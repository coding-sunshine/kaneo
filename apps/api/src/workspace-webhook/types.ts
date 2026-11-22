export const WORKSPACE_WEBHOOK_RESOURCE_TYPES = [
  "task",
  "comment",
  "project",
  "label",
  "cycle",
] as const;
export type WorkspaceWebhookResourceType =
  (typeof WORKSPACE_WEBHOOK_RESOURCE_TYPES)[number];
export type WorkspaceWebhookAction = "create" | "update" | "remove";
