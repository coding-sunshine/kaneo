import { createRoute, errorResponse, jsonResponse, z } from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  dependencyBody,
  dependencySchema,
  documentDependencyParam,
  documentParam,
  documentStatementParam,
} from "./schema";

const tags = ["Documents"];
const dependents =
  "/workspace/{workspaceId}/{id}/statements/{statementId}/dependents";
const notFound = errorResponse(
  "Document, statement, issue or dependency not found",
);
const write = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ task: ["update"] }),
] as const;

export const addDependentRoute = createRoute({
  method: "put",
  operationId: "addStatementDependent",
  path: dependents,
  tags,
  summary: "Say that work relies on a statement",
  description:
    "Links an issue or a document to a value its topic states now. When the topic stops stating that value, the work is flagged for review. Send exactly one of taskId and documentId. Sending the same link again keeps the one there is.",
  middleware: [...write] as const,
  request: {
    params: documentStatementParam,
    body: {
      required: true as const,
      content: { "application/json": { schema: dependencyBody } },
    },
  },
  responses: {
    200: jsonResponse("The dependency", dependencySchema),
    404: notFound,
    409: errorResponse("The topic does not state this value now"),
  },
});

export const removeDependentRoute = createRoute({
  method: "delete",
  operationId: "removeStatementDependent",
  path: `${dependents}/{dependencyId}`,
  tags,
  summary: "Remove a dependency on a statement",
  description:
    "The work no longer relies on the value, so a later change does not flag it.",
  middleware: [...write] as const,
  request: { params: documentDependencyParam },
  responses: {
    200: jsonResponse("Removed", z.object({ id: z.string() })),
    404: notFound,
  },
});

export const reliedTopicsRoute = createRoute({
  method: "get",
  operationId: "listDocumentReliedTopics",
  path: "/workspace/{workspaceId}/{id}/relies-on",
  tags,
  summary: "List the topics a document relies on",
  description:
    "The topics whose values the document relies on. A topic you cannot open is left out.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: documentParam },
  responses: {
    200: jsonResponse(
      "Topic ids",
      z
        .object({ topicIds: z.array(z.string()) })
        .openapi("DocumentReliedTopics"),
    ),
    404: errorResponse("Document not found"),
  },
});
