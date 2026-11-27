import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../../openapi";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../../utils/require-workspace-permission";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { workspaceParam } from "../schema";
import {
  aiDestinationSchema,
  setAiDestinationBody,
} from "./destination-schema";
import { changeDestination, destinationView } from "./store";

const tags = ["Agent"];
const path = "/workspace/{workspaceId}/ai-destination";
const noAccess = errorResponse("Missing permission for this workspace");
const notFound = errorResponse("Agent is disabled or workspace not found");
const manage = { workspace: ["manage_settings"] };
// Every member may see where their text goes; only admins change it.
const read = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ project: ["read"] }),
] as const;
const admin = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission(manage),
] as const;

const getRoute = createRoute({
  method: "get",
  operationId: "getAiDestination",
  path,
  tags,
  summary: "Get the AI data destination",
  description:
    "Which provider receives this workspace's text when AI runs, and which model.",
  middleware: [...read] as const,
  request: { params: workspaceParam },
  responses: {
    200: jsonResponse("AI data destination", aiDestinationSchema),
    403: noAccess,
    404: notFound,
  },
});

const setRoute = createRoute({
  method: "put",
  operationId: "setAiDestination",
  path,
  tags,
  summary: "Set the AI data destination",
  description:
    "Choose OpenRouter or the server's self-hosted model, by name. The change is listed in the AI audit. A provider the server has not configured answers 400. Admins and owners only.",
  middleware: [...admin] as const,
  request: {
    params: workspaceParam,
    body: {
      required: true as const,
      content: { "application/json": { schema: setAiDestinationBody } },
    },
  },
  responses: {
    200: jsonResponse("AI data destination", aiDestinationSchema),
    400: errorResponse("The provider is not configured on this server"),
    403: noAccess,
    404: notFound,
  },
});

const destinationRoutes = apiRouter()
  .openapi(getRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const canChange = await hasWorkspacePermission(c, manage, workspaceId);
    return c.json(await destinationView(workspaceId, canChange), 200);
  })
  .openapi(setRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const body = c.req.valid("json");
    await changeDestination(workspaceId, c.get("userId"), {
      provider: body.provider,
      model: body.provider === "self-hosted" ? body.model : null,
    });
    return c.json(await destinationView(workspaceId, true), 200);
  });

export default destinationRoutes;
