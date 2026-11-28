import { HTTPException } from "hono/http-exception";
import { readerOf } from "../agent/cite-messages";
import { isSemanticSearchEnabled } from "../assist/embeddings";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  semanticSearchBody,
  semanticSearchSchema,
  semanticSearchSettingSchema,
  semanticSearchSwitchBody,
  workspaceParam,
} from "./schema";
import { semanticSearch } from "./semantic-search";
import {
  saveSemanticSearchSwitch,
  semanticSearchView,
} from "./workspace-setting";

const searchRoute = createRoute({
  method: "post",
  operationId: "semanticSearch",
  path: "/workspace/{workspaceId}",
  tags: ["Search"],
  summary: "Search by meaning",
  description:
    "Finds messages, tickets and documents close in meaning to the question, among those you can open now, and answers with citations. Channels with AI turned off and direct messages are never searched. Off until the server has EMBEDDING_API_KEY and an admin turns it on for the workspace.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ workspace: ["read"] }),
  ] as const,
  request: {
    params: workspaceParam,
    body: {
      content: { "application/json": { schema: semanticSearchBody } },
      required: true,
    },
  },
  responses: {
    200: jsonResponse("Answer and matches", semanticSearchSchema),
    403: errorResponse("Missing permission"),
    404: errorResponse(
      "Semantic search is off, or the workspace was not found",
    ),
    429: errorResponse("AI budget used up"),
  },
});

const getSettingRoute = createRoute({
  method: "get",
  operationId: "getSemanticSearchSetting",
  path: "/workspace/{workspaceId}/setting",
  tags: ["Search"],
  summary: "Search by meaning setting",
  description:
    "Whether search by meaning is on for the workspace, and whether its text may go to the embedding service at all under the workspace's AI destination.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ workspace: ["read"] }),
  ] as const,
  request: { params: workspaceParam },
  responses: {
    200: jsonResponse("Setting", semanticSearchSettingSchema),
    404: errorResponse("Off on this server, or the workspace was not found"),
  },
});

const setSettingRoute = createRoute({
  method: "put",
  operationId: "setSemanticSearchSetting",
  path: "/workspace/{workspaceId}/setting",
  tags: ["Search"],
  summary: "Turn search by meaning on or off",
  description:
    "Turning it on sends the workspace's messages, tickets and documents to the embedding service in EMBEDDING_API_URL. Admins and owners only.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: {
    params: workspaceParam,
    body: {
      content: { "application/json": { schema: semanticSearchSwitchBody } },
      required: true,
    },
  },
  responses: {
    200: jsonResponse("Setting", semanticSearchSettingSchema),
    403: errorResponse("Missing permission"),
    404: errorResponse("Off on this server, or the workspace was not found"),
  },
});

const router = apiRouter();
router.use("*", async (_c, next) => {
  if (!isSemanticSearchEnabled())
    throw new HTTPException(404, { message: "Not found" });
  await next();
});

const semanticSearchRoutes = router
  .openapi(searchRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { query } = c.req.valid("json");
    return c.json(
      await semanticSearch(await readerOf(c, workspaceId), query),
      200,
    );
  })
  .openapi(getSettingRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(await semanticSearchView(workspaceId), 200);
  })
  .openapi(setSettingRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { enabled } = c.req.valid("json");
    return c.json(
      await saveSemanticSearchSwitch(workspaceId, c.get("userId"), enabled),
      200,
    );
  });

export default semanticSearchRoutes;
