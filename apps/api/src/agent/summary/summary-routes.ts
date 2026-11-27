import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../../openapi";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { citationSchema } from "../citation-schema";
import { readerOf } from "../cite-messages";
import { summarizeTask } from "./summarize-task";

const taskSummarySchema = z
  .object({
    currentState: z.string(),
    blockers: z.array(z.string()),
    sources: z.array(citationSchema).openapi({
      description: "The comments the summary rests on.",
    }),
  })
  .openapi("TaskSummary");

const summaryRoute = createRoute({
  method: "post",
  operationId: "summarizeTask",
  path: "/workspace/{workspaceId}/tasks/{taskId}/summary",
  tags: ["Agent"],
  summary: "Summarise a ticket",
  description:
    "A short current-state and blockers summary of a ticket and its comments, with the comments it used. Reads only; the ticket is not changed. Only tickets you can open; answers 429 when an AI budget is used up.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: {
    params: z.object({ workspaceId: z.string(), taskId: z.string() }),
  },
  responses: {
    200: jsonResponse("Ticket summary", taskSummarySchema),
    403: errorResponse("Missing permission for this workspace"),
    404: errorResponse("Agent is disabled or task not found"),
    502: errorResponse("The model's answer could not be read"),
  },
});

const summaryRoutes = apiRouter().openapi(summaryRoute, async (c) => {
  const { workspaceId, taskId } = c.req.valid("param");
  return c.json(
    await summarizeTask(await readerOf(c, workspaceId), taskId),
    200,
  );
});

export default summaryRoutes;
