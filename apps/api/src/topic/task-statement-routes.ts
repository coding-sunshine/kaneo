import { createRoute, errorResponse, jsonResponse } from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  taskStatementDismissedSchema,
  taskStatementListSchema,
  topicFactParam,
  topicParam,
} from "./schema";

const tags = ["Topics"];
const facts = "/workspace/{workspaceId}/{id}/task-statement";
const dismissed = `${facts}/{factId}/dismissed`;
const notFound = errorResponse("Topic or fact not found");
const noAccess = errorResponse(
  "You do not have permission to change issues in this workspace",
);
const write = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ task: ["update"] }),
] as const;

export const listTaskStatementsRoute = createRoute({
  method: "get",
  operationId: "listTopicTaskStatements",
  path: facts,
  tags,
  summary: "List what issues say about a topic",
  description:
    "Facts the assistant read from issues, their comments and their text files for the topic's slots. Each one is a proposal with the words it was read from. It changes nothing the topic states. Facts from issues you cannot open are left out.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: topicParam },
  responses: {
    200: jsonResponse("Facts read from issues", taskStatementListSchema),
    404: errorResponse("Topic not found"),
  },
});

export const dismissTaskStatementRoute = createRoute({
  method: "put",
  operationId: "dismissTopicTaskStatement",
  path: dismissed,
  tags,
  summary: "Dismiss a fact read from an issue",
  description:
    "Hides a proposal that is wrong or not about this topic. It stays dismissed when the issue is read again.",
  middleware: [...write] as const,
  request: { params: topicFactParam },
  responses: {
    200: jsonResponse("Fact dismissed", taskStatementDismissedSchema),
    403: noAccess,
    404: notFound,
  },
});

export const restoreTaskStatementRoute = createRoute({
  method: "delete",
  operationId: "restoreTopicTaskStatement",
  path: dismissed,
  tags,
  summary: "Bring back a dismissed fact",
  description: "Shows a dismissed proposal again.",
  middleware: [...write] as const,
  request: { params: topicFactParam },
  responses: {
    200: jsonResponse("Fact restored", taskStatementDismissedSchema),
    403: noAccess,
    404: notFound,
  },
});
