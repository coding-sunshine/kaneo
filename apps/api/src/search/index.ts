import { AI_READER_HEADER } from "@kaneo/mcp/tools";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import globalSearch from "./controllers/global-search";
import { requireSearchPermission } from "./require-search-permission";
import { searchResponseSchema } from "./response";
import { searchQuery } from "./schema";

const globalSearchRoute = createRoute({
  method: "get",
  operationId: "globalSearch",
  path: "/",
  tags: ["Search"],
  summary: "Global search",
  description:
    "Search across tasks, projects, workspaces, comments, activities, documents, chat messages and people in one workspace. Messages come only from channels and direct messages the caller can read, archived channels included. Results are ranked by relevance and returned as a single flat list, each entry tagged with its `type`.",
  middleware: [workspaceAccess.fromQuery(), requireSearchPermission] as const,
  request: { query: searchQuery },
  responses: {
    200: jsonResponse("Ranked search results", searchResponseSchema),
    400: errorResponse(
      "Invalid query, or workspace ID could not be determined",
    ),
    403: errorResponse("Missing read permission for the requested search type"),
    404: errorResponse("Workspace not found"),
  },
});

const search = apiRouter().openapi(globalSearchRoute, async (c) => {
  const { q, type, workspaceId, projectId, limit, userEmail } =
    c.req.valid("query");

  return c.json(
    await globalSearch({
      query: q,
      userId: c.get("userId"),
      userEmail,
      type,
      workspaceId,
      projectId,
      limit,
      // An AI reading for someone never sees channels marked no AI.
      forAi: c.req.header(AI_READER_HEADER) === "1",
    }),
    200,
  );
});

export default search;
