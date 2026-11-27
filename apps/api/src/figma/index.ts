import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { getFigmaPreview } from "./controllers/get-figma-preview";
import { figmaPreviewSchema } from "./response";
import { figmaPreviewBody, figmaPreviewQuery } from "./schema";

const previewResponses = {
  200: jsonResponse("The Figma link card", figmaPreviewSchema),
  400: errorResponse("Not a figma.com file link"),
  403: errorResponse("Missing workspace:read permission"),
  404: errorResponse(
    "Workspace not found, the caller is a guest, Figma previews are off (no access token configured), the file is not linked in a task, comment or document the caller can read, or the token cannot open it. All answer the same.",
  ),
  429: errorResponse(
    "Too many Figma lookups by the caller; see the Retry-After header",
  ),
  502: errorResponse("Figma did not answer"),
};

const getFigmaPreviewRoute = createRoute({
  method: "get",
  operationId: "getFigmaPreview",
  path: "/preview",
  tags: ["Figma"],
  summary: "Get a Figma link card",
  description:
    "Get the card for a Figma link that appears in a task description, comment or document of the workspace the caller can read. The first request for a link reads Figma; later ones get the stored card until someone refreshes it or its signed image link expires. Lookups that reach Figma are capped per person, and failed ones are remembered for five minutes.",
  middleware: [
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ workspace: ["read"] }),
  ] as const,
  request: { query: figmaPreviewQuery },
  responses: previewResponses,
});

const refreshFigmaPreviewRoute = createRoute({
  method: "post",
  operationId: "refreshFigmaPreview",
  path: "/preview/refresh",
  tags: ["Figma"],
  summary: "Refresh a Figma link card",
  description:
    "Read the Figma file again and store the new card. A failed read keeps the stored card.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ workspace: ["read"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: figmaPreviewBody } },
    },
  },
  responses: previewResponses,
});

const figma = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getFigmaPreviewRoute, async (c) =>
    c.json(
      await getFigmaPreview({
        ...c.req.valid("query"),
        userId: c.get("userId"),
      }),
      200,
    ),
  )
  .openapi(refreshFigmaPreviewRoute, async (c) =>
    c.json(
      await getFigmaPreview({
        ...c.req.valid("json"),
        userId: c.get("userId"),
        refresh: true,
      }),
      200,
    ),
  );

export default figma;
