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
import { rewriteText } from "./rewrite-text";
import { WRITING_ACTIONS, type WritingAction } from "./writing-actions";

const actions = Object.keys(WRITING_ACTIONS) as [
  WritingAction,
  ...WritingAction[],
];

const writingBody = z.object({
  action: z.enum(actions).openapi({
    description:
      "shorten, lengthen, simplify, fix (spelling and grammar) or professional.",
  }),
  text: z.string().trim().min(1).max(8_000).openapi({
    description: "The selected passage.",
  }),
});

const writingSchema = z
  .object({ text: z.string() })
  .openapi("WritingSuggestion", {
    description: "The rewritten passage. Nothing is saved.",
  });

const writingRoute = createRoute({
  method: "post",
  operationId: "rewriteSelection",
  path: "/workspace/{workspaceId}/writing",
  tags: ["Agent"],
  summary: "Rewrite a selected passage",
  description:
    "Rewrites the passage a person selected in the editor and returns the result to show beside the original. Nothing is saved; the editor replaces the selection only when the person accepts. Needs the permission to edit documents. Counted as writing help in AI usage.",
  middleware: [
    workspaceAccess.fromParam(),
    // The same permission as editing a document: a viewer spends no AI tokens.
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: workspaceParam,
    body: {
      required: true as const,
      content: { "application/json": { schema: writingBody } },
    },
  },
  responses: {
    200: jsonResponse("The rewritten passage", writingSchema),
    403: errorResponse("Missing permission for this workspace"),
    404: errorResponse("Agent is disabled"),
    502: errorResponse("The model request failed"),
  },
});

const writingRoutes = apiRouter().openapi(writingRoute, async (c) => {
  const { workspaceId } = c.req.valid("param");
  const { action, text } = c.req.valid("json");
  return c.json(
    await rewriteText({ workspaceId, userId: c.get("userId") }, action, text),
    200,
  );
});

export default writingRoutes;
