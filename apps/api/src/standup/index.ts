import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { buildStandupDraft } from "./build-standup-draft";
import { standupDraftSchema, standupParam, standupQuery } from "./schema";

const draftRoute = createRoute({
  method: "get",
  operationId: "getStandupDraft",
  path: "/workspace/{workspaceId}/draft",
  tags: ["Standup"],
  summary: "Draft my standup",
  description:
    "A private did, doing and blocked draft from the caller's own tickets: tickets they completed in the window, their started open tickets, and their open tickets with an open blocker. Only tickets in teams the caller can open. Nothing is stored, posted or sent; the caller copies the text where they want it.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ project: ["read"], task: ["read"] }),
  ] as const,
  request: { params: standupParam, query: standupQuery },
  responses: {
    200: jsonResponse("Standup draft", standupDraftSchema),
    400: errorResponse("Invalid window"),
    403: errorResponse("Missing project:read or task:read permission"),
    404: errorResponse("Workspace not found"),
  },
});

const standup = apiRouter().openapi(draftRoute, async (c) => {
  const { workspaceId } = c.req.valid("param");
  const { days } = c.req.valid("query");
  return c.json(
    await buildStandupDraft(workspaceId, c.get("userId"), days),
    200,
  );
});

export default standup;
