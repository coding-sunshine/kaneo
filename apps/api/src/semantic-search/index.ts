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
  workspaceParam,
} from "./schema";
import { semanticSearch } from "./semantic-search";

const searchRoute = createRoute({
  method: "post",
  operationId: "semanticSearch",
  path: "/workspace/{workspaceId}",
  tags: ["Search"],
  summary: "Search by meaning",
  description:
    "Finds messages, tickets and documents close in meaning to the question, among those you can open now, and answers with citations. Channels marked no AI and direct messages are never searched. Off until the server has EMBEDDING_API_KEY.",
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

const router = apiRouter();
router.use("*", async (_c, next) => {
  if (!isSemanticSearchEnabled())
    throw new HTTPException(404, { message: "Not found" });
  await next();
});

const semanticSearchRoutes = router.openapi(searchRoute, async (c) => {
  const { workspaceId } = c.req.valid("param");
  const { query } = c.req.valid("json");
  return c.json(
    await semanticSearch(await readerOf(c, workspaceId), query),
    200,
  );
});

export default semanticSearchRoutes;
