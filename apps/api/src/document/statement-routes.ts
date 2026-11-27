import type { ZodType } from "zod";
import { createRoute, errorResponse, jsonResponse } from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  documentParam,
  documentStatementParam,
  rejectStatementBody,
  statementBody,
  statementListSchema,
  statementSchema,
} from "./schema";

const tags = ["Documents"];
const statements = "/workspace/{workspaceId}/{id}/statements";
const decided = `${statements}/{statementId}`;
const notFound = errorResponse("Document or statement not found");
const noEdit = errorResponse(
  "Needs edit access to the document. On a current document, only the topic's decider or backup; on a proposal, only they confirm or reject.",
);
const body = <T extends ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const read = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ task: ["read"] }),
] as const;
const write = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ task: ["update"] }),
] as const;

export const listStatementsRoute = createRoute({
  method: "get",
  operationId: "listDocumentStatements",
  path: statements,
  tags,
  summary: "List a document's statements",
  description:
    "What the document states for the slots of its topic, each with the passage that says so. Only statements written for the document's present text are listed.",
  middleware: [...read] as const,
  request: { params: documentParam },
  responses: {
    200: jsonResponse("Statements", statementListSchema),
    404: notFound,
  },
});

export const addStatementRoute = createRoute({
  method: "post",
  operationId: "addDocumentStatement",
  path: statements,
  tags,
  summary: "Add a statement to a document",
  description:
    "Record what the document states for one slot of its topic. The quote must be in the document. The statement is a proposal until a person confirms it. Sending a slot again replaces its unconfirmed statement. On a current document, only the topic's decider or backup adds or replaces a statement.",
  middleware: [...write] as const,
  request: { params: documentParam, body: body(statementBody) },
  responses: {
    200: jsonResponse("Statement added", statementSchema),
    400: errorResponse(
      "The topic has no such slot, the quote is not in the document, or the value does not fit the slot",
    ),
    403: noEdit,
    404: notFound,
    409: errorResponse(
      "The document is not filed on a topic, or the slot has a confirmed statement",
    ),
  },
});

export const confirmStatementRoute = createRoute({
  method: "post",
  operationId: "confirmDocumentStatement",
  path: `${decided}/confirm`,
  tags,
  summary: "Confirm a statement",
  description:
    "A person agrees that the document states this. The confirmation is for the text as it is now: after an edit the statement is a proposal again.",
  middleware: [...write] as const,
  request: { params: documentStatementParam },
  responses: {
    200: jsonResponse("Statement confirmed", statementSchema),
    403: noEdit,
    404: notFound,
    409: errorResponse(
      "The document changed after the statement was written, or the statement was rejected",
    ),
  },
});

export const rejectStatementRoute = createRoute({
  method: "post",
  operationId: "rejectDocumentStatement",
  path: `${decided}/reject`,
  tags,
  summary: "Reject a statement",
  description:
    "A person says the document does not state this, with the reason. The slot can then take a new statement.",
  middleware: [...write] as const,
  request: {
    params: documentStatementParam,
    body: body(rejectStatementBody),
  },
  responses: {
    200: jsonResponse("Statement rejected", statementSchema),
    403: noEdit,
    404: notFound,
  },
});
