import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { setBudget } from "./budget";
import { workspaceParam } from "./schema";
import { usageReport } from "./usage-report";
import { aiBudgetSchema, aiUsageSchema } from "./usage-schema";

const tags = ["Agent"];
const noAccess = errorResponse("Missing permission for this workspace");
const notFound = errorResponse("Agent is disabled or workspace not found");
// Budgets cap what everyone may spend, so only admins see and set them.
const admin = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
] as const;

const usageRoute = createRoute({
  method: "get",
  operationId: "getAiUsage",
  path: "/workspace/{workspaceId}/usage",
  tags,
  summary: "Get AI usage",
  description:
    "Tokens the assistant and loops used in this workspace over the last 30 UTC days, by feature and by day, with the workspace's budgets. Admins and owners only.",
  middleware: [...admin] as const,
  request: { params: workspaceParam },
  responses: {
    200: jsonResponse("AI usage", aiUsageSchema),
    403: noAccess,
    404: notFound,
  },
});

const budgetRoute = createRoute({
  method: "put",
  operationId: "setAiBudget",
  path: "/workspace/{workspaceId}/budget",
  tags,
  summary: "Set AI budgets",
  description:
    "Set the per-person daily and the workspace monthly token budgets. A call is refused, before the model is asked, once either is used up. Admins and owners only.",
  middleware: [...admin] as const,
  request: {
    params: workspaceParam,
    body: {
      required: true as const,
      content: { "application/json": { schema: aiBudgetSchema } },
    },
  },
  responses: {
    200: jsonResponse("Budgets", aiBudgetSchema),
    403: noAccess,
    404: notFound,
  },
});

const usageRoutes = apiRouter()
  .openapi(usageRoute, async (c) =>
    c.json(await usageReport(c.req.valid("param").workspaceId), 200),
  )
  .openapi(budgetRoute, async (c) =>
    c.json(
      await setBudget(c.req.valid("param").workspaceId, c.req.valid("json")),
      200,
    ),
  );

export default usageRoutes;
