import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../../openapi";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { workspaceParam } from "../schema";
import { parseFilterBody, parsedFilterSchema } from "./filter-schema";
import { parseFilter } from "./parse-filter";

const parseRoute = createRoute({
  method: "post",
  operationId: "parseAgentFilter",
  path: "/workspace/{workspaceId}/filters/parse",
  tags: ["Agent"],
  summary: "Turn a sentence into a board filter",
  description:
    "Reads a plain-English sentence as a filter on one team's board and returns the filter in ids, or one question when the sentence is unclear. Only teams you can open; answers 429 when an AI budget is used up.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: {
    params: workspaceParam,
    body: {
      required: true as const,
      content: { "application/json": { schema: parseFilterBody } },
    },
  },
  responses: {
    200: jsonResponse("The filter, or a question", parsedFilterSchema),
    403: errorResponse("Missing permission for this workspace"),
    404: errorResponse("Agent is disabled or team not found"),
  },
});

const filterRoutes = apiRouter().openapi(parseRoute, async (c) => {
  const { workspaceId } = c.req.valid("param");
  const { projectId, text } = c.req.valid("json");
  return c.json(
    await parseFilter({
      userId: c.get("userId"),
      workspaceId,
      projectId,
      text,
    }),
    200,
  );
});

export default filterRoutes;
