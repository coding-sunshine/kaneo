import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../../openapi";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { workspaceParam } from "../schema";
import { readAiFeatures, saveAiFeatures } from "./ai-features";

const aiFeaturesSchema = z
  .object({
    triage: z.boolean().openapi({
      description:
        "Ask the model for a triage suggestion on every new ticket in triage.",
    }),
    prSummary: z.boolean().openapi({
      description:
        "Ask the model for a summary comment when a linked pull request merges.",
    }),
    chatAssistant: z.boolean().openapi({
      description:
        "Let people mention @assistant in a chat thread to get a summary posted there, built from what the asker can open.",
    }),
  })
  .openapi("AiFeatures", {
    description: "AI features that are off until an admin turns them on.",
  });

const tags = ["Agent"];
const noAccess = errorResponse("Missing permission for this workspace");
const notFound = errorResponse("Agent is disabled or workspace not found");

const getRoute = createRoute({
  method: "get",
  operationId: "getAiFeatures",
  path: "/workspace/{workspaceId}/ai-features",
  tags,
  summary: "Get AI feature switches",
  description:
    "Which AI features run on their own in this workspace. Readable by every member, so settings can say whether a feature is on.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ workspace: ["read"] }),
  ] as const,
  request: { params: workspaceParam },
  responses: {
    200: jsonResponse("AI feature switches", aiFeaturesSchema),
    403: noAccess,
    404: notFound,
  },
});

const putRoute = createRoute({
  method: "put",
  operationId: "setAiFeatures",
  path: "/workspace/{workspaceId}/ai-features",
  tags,
  summary: "Set AI feature switches",
  description:
    "Turn AI triage suggestions, pull request summaries and the chat assistant on or off for the workspace. Admins and owners only.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: {
    params: workspaceParam,
    body: {
      required: true as const,
      content: {
        "application/json": {
          schema: aiFeaturesSchema.partial().openapi({
            description:
              "The switches to change; any left out keep their value.",
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse("AI feature switches", aiFeaturesSchema),
    403: noAccess,
    404: notFound,
  },
});

const aiFeaturesRoutes = apiRouter()
  .openapi(getRoute, async (c) =>
    c.json(await readAiFeatures(c.req.valid("param").workspaceId), 200),
  )
  .openapi(putRoute, async (c) =>
    c.json(
      await saveAiFeatures(
        c.req.valid("param").workspaceId,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    ),
  );

export default aiFeaturesRoutes;
