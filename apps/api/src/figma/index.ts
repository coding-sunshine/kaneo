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
    "Workspace not found, Figma previews are off (no access token configured), or the file is not shared with the token",
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
    "Get the card for a Figma link: file name, frame name, thumbnail and when it was fetched. The first request for a link in a workspace reads Figma; later ones get the stored card until someone refreshes it.",
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
    c.json(await getFigmaPreview(c.req.valid("query")), 200),
  )
  .openapi(refreshFigmaPreviewRoute, async (c) =>
    c.json(
      await getFigmaPreview({ ...c.req.valid("json"), refresh: true }),
      200,
    ),
  );

export default figma;
