import { createRoute, errorResponse, jsonResponse } from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  conflictSchema,
  decideConflictBody,
  documentConflictParam,
  documentParam,
  receiptSchema,
} from "./schema";

const tags = ["Documents"];

export const receiptRoute = createRoute({
  method: "get",
  operationId: "getDocumentReceipt",
  path: "/workspace/{workspaceId}/{id}/receipt",
  tags,
  summary: "Compare a document with its topic",
  description:
    "Sorts what the document states for its topic's slots against what the topic's current document states: what it repeats, what is new, where it says something else, and which slots it leaves out. Only a current document the caller can open is compared. To someone who cannot open the topic, every list is empty.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: documentParam },
  responses: {
    200: jsonResponse("The document compared with its topic", receiptSchema),
    404: errorResponse("Document not found"),
  },
});

export const decideConflictRoute = createRoute({
  method: "post",
  operationId: "decideDocumentConflict",
  path: "/workspace/{workspaceId}/{id}/conflicts/{conflictId}/decide",
  tags,
  summary: "Settle a conflict with the current document",
  description:
    "The topic's decider says which value stands, or lets the two differ until a date. A document cannot be made current while one of its conflicts is open.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: documentConflictParam,
    body: {
      required: true,
      content: { "application/json": { schema: decideConflictBody } },
    },
  },
  responses: {
    200: jsonResponse("The conflict as it stands now", conflictSchema),
    400: errorResponse("Tolerating needs a date that lies ahead"),
    403: errorResponse("Only the topic's decider settles a conflict"),
    404: errorResponse("Document or conflict not found"),
  },
});
