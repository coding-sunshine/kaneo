import { createRoute, errorResponse, jsonResponse } from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  clearedReviewFlagSchema,
  needsReviewSchema,
  reviewFlagParam,
  topicDependentsSchema,
  topicParam,
  workspaceIdParam,
} from "./schema";

const tags = ["Topics"];
const needsReview = "/workspace/{workspaceId}/needs-review";

export const needsReviewRoute = createRoute({
  method: "get",
  operationId: "listNeedsReview",
  path: needsReview,
  tags,
  summary: "List work that needs review",
  description:
    "Issues and documents that rely on a value a topic no longer states. Each names the statement it relies on and the statement whose change raised the flag. Lists only what the caller can open: the work and both documents.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam },
  responses: { 200: jsonResponse("Flagged work", needsReviewSchema) },
});

export const clearNeedsReviewRoute = createRoute({
  method: "post",
  operationId: "clearNeedsReview",
  path: `${needsReview}/{dependencyId}/clear`,
  tags,
  summary: "Clear a review flag",
  description:
    "Someone looked at the work. The dependency stays, and the next change flags it again.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: reviewFlagParam },
  responses: {
    200: jsonResponse("Cleared", clearedReviewFlagSchema),
    404: errorResponse("No flag under this id"),
  },
});

export const topicDependentsRoute = createRoute({
  method: "get",
  operationId: "listTopicDependents",
  path: "/workspace/{workspaceId}/{id}/dependents",
  tags,
  summary: "List the work that relies on a topic's values",
  description:
    "Issues and documents that rely on a value one of the topic's documents states, and whether each needs review. Only work the reader can open is listed.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: topicParam },
  responses: {
    200: jsonResponse("Work that relies on the topic", topicDependentsSchema),
    404: errorResponse("Topic not found"),
  },
});
