import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { projectTable, taskTable } from "../database/schema";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { validateWorkspaceAccess } from "../utils/validate-workspace-access";
import { declineDuplicate } from "./decline-duplicate";
import { findDuplicateSuggestions } from "./find-duplicate-suggestions";
import {
  declineDuplicateBody,
  declinedDuplicateSchema,
  duplicateSuggestionsSchema,
  duplicateTaskParam,
} from "./schema";

// Route middleware runs before the validators, so it reads the raw param.
// A ticket of a workspace the caller is not in is the same 404 as none.
async function scopeToTask(c: Context, next: Next) {
  const notFound = () => new HTTPException(404, { message: "Task not found" });
  const [task] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(eq(taskTable.id, c.req.param("taskId") ?? ""));
  if (!task) throw notFound();
  await validateWorkspaceAccess(
    c.get("userId"),
    task.workspaceId,
    c.get("apiKey")?.id,
    { notFoundMessage: "Task not found" },
  );
  c.set("workspaceId", task.workspaceId);
  return next();
}

const tags = ["Duplicate suggestions"];

const listRoute = createRoute({
  method: "get",
  operationId: "listDuplicateSuggestions",
  path: "/task/{taskId}",
  tags,
  summary: "Suggest duplicates of a ticket",
  description:
    "Up to three open tickets whose titles read like this one's, in teams the caller can open. Tickets already related to it and pairs someone declined are left out. Reads only; accept a suggestion by creating a `duplicate` task relation.",
  middleware: [
    scopeToTask,
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: duplicateTaskParam },
  responses: {
    200: jsonResponse("Suggested duplicates", duplicateSuggestionsSchema),
    403: errorResponse("Missing task:read permission"),
    404: errorResponse("Task not found"),
  },
});

const declineRoute = createRoute({
  method: "post",
  operationId: "declineDuplicateSuggestion",
  path: "/task/{taskId}/decline",
  tags,
  summary: "Decline a suggested duplicate",
  description:
    "Marks the two tickets as not duplicates, so neither suggests the other again, for anyone. Both tickets must be ones the caller can open. Declining twice is fine.",
  middleware: [
    scopeToTask,
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: duplicateTaskParam,
    body: {
      content: { "application/json": { schema: declineDuplicateBody } },
      required: true,
    },
  },
  responses: {
    200: jsonResponse("Suggestion declined", declinedDuplicateSchema),
    400: errorResponse("A ticket is not a duplicate of itself"),
    403: errorResponse("Missing task:update permission"),
    404: errorResponse("Task not found"),
  },
});

const duplicateSuggestion = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listRoute, async (c) => {
    const { taskId } = c.req.valid("param");
    return c.json(
      await findDuplicateSuggestions(
        taskId,
        c.get("workspaceId"),
        c.get("userId"),
      ),
      200,
    );
  })
  .openapi(declineRoute, async (c) => {
    const { taskId } = c.req.valid("param");
    const { otherTaskId } = c.req.valid("json");
    return c.json(
      await declineDuplicate(
        taskId,
        otherTaskId,
        c.get("workspaceId"),
        c.get("userId"),
      ),
      200,
    );
  });

export default duplicateSuggestion;
