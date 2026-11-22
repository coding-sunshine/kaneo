import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  createdWebhookSchema,
  createWebhookBody,
  deletedWebhookSchema,
  updateWebhookBody,
  webhookIdParam,
  webhookListSchema,
  webhookSchema,
  workspaceIdParam,
} from "./schema";
import {
  createWebhook,
  deleteWebhook,
  listWebhooks,
  updateWebhook,
} from "./service";
import "./dispatch";

const body = <T extends import("zod").ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const noAccess = errorResponse("Missing permission for this workspace");
const tags = ["Webhooks"];
// Linear: creating and managing webhooks needs admin permissions.
const admin = requireWorkspacePermission({ workspace: ["manage_settings"] });

const listRoute = createRoute({
  method: "get",
  operationId: "listWorkspaceWebhooks",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "List webhooks",
  description: "List a workspace's webhooks. Admins and owners only.",
  middleware: [workspaceAccess.fromParam(), admin] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Webhooks", webhookListSchema),
    403: noAccess,
    404: errorResponse("Workspace not found"),
  },
});

const createRoute_ = createRoute({
  method: "post",
  operationId: "createWorkspaceWebhook",
  path: "/",
  tags,
  summary: "Create webhook",
  description:
    "Create a workspace webhook. The signing secret is returned once, here only.",
  middleware: [workspaceAccess.fromBody(), admin] as const,
  request: { body: body(createWebhookBody) },
  responses: {
    200: jsonResponse("Webhook created", createdWebhookSchema),
    400: errorResponse("Invalid URL or team"),
    403: noAccess,
    404: errorResponse("Workspace not found"),
  },
});

const updateRoute = createRoute({
  method: "put",
  operationId: "updateWorkspaceWebhook",
  path: "/{id}",
  tags,
  summary: "Update webhook",
  description: "Edit, enable or disable a webhook.",
  middleware: [workspaceAccess.fromWorkspaceWebhook(), admin] as const,
  request: { params: webhookIdParam, body: body(updateWebhookBody) },
  responses: {
    200: jsonResponse("Webhook updated", webhookSchema),
    400: errorResponse("Invalid URL or team"),
    403: noAccess,
    404: errorResponse("Webhook not found"),
  },
});

const deleteRoute = createRoute({
  method: "delete",
  operationId: "deleteWorkspaceWebhook",
  path: "/{id}",
  tags,
  summary: "Delete webhook",
  description: "Delete a webhook and its queued deliveries.",
  middleware: [workspaceAccess.fromWorkspaceWebhook(), admin] as const,
  request: { params: webhookIdParam },
  responses: {
    200: jsonResponse("Webhook deleted", deletedWebhookSchema),
    403: noAccess,
    404: errorResponse("Webhook not found"),
  },
});

const workspaceWebhook = apiRouter()
  .openapi(listRoute, async (c) =>
    c.json(await listWebhooks(c.req.valid("param").workspaceId), 200),
  )
  .openapi(createRoute_, async (c) =>
    c.json(await createWebhook(c.req.valid("json"), c.get("userId")), 200),
  )
  .openapi(updateRoute, async (c) =>
    c.json(
      await updateWebhook(c.req.valid("param").id, c.req.valid("json")),
      200,
    ),
  )
  .openapi(deleteRoute, async (c) =>
    c.json(await deleteWebhook(c.req.valid("param").id), 200),
  );

export default workspaceWebhook;
