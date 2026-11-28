import { createRoute, errorResponse, jsonResponse } from "../../openapi";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { documentParam, documentSchema } from "../schema";
import {
  collabAppliedSchema,
  collabSeedBody,
  collabStateSchema,
  collabTextBody,
  collabUpdateBody,
} from "./collab-schema";

const tags = ["Documents"];
const path = "/workspace/{workspaceId}/{id}/collab";
const body = <
  T extends
    | typeof collabSeedBody
    | typeof collabUpdateBody
    | typeof collabTextBody,
>(
  schema: T,
) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const refused = {
  403: errorResponse("Missing permission for this workspace or document"),
  404: errorResponse("Document not found"),
  409: errorResponse(
    "Co-editing is off (COEDITING_OFF), or the state does not match the text",
  ),
};
const read = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ task: ["read"] }),
] as const;
const write = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ task: ["update"] }),
] as const;

export const getCollabRoute = createRoute({
  method: "get",
  operationId: "getDocumentCollabState",
  path,
  tags,
  summary: "Co-editing state",
  description:
    "The live Yjs state of the document, when co-editing is on (DOCUMENT_COEDITING_KEY).",
  middleware: [...read] as const,
  request: { params: documentParam },
  responses: {
    200: jsonResponse("State", collabStateSchema),
    ...refused,
  },
});

export const seedCollabRoute = createRoute({
  method: "post",
  operationId: "seedDocumentCollabState",
  path: `${path}/seed`,
  tags,
  summary: "Start co-editing",
  description:
    "Stores the first Yjs state, made from the current text. 409 COEDIT_SEEDED when someone else did first: load theirs.",
  middleware: [...write] as const,
  request: { params: documentParam, body: body(collabSeedBody) },
  responses: {
    200: jsonResponse("Seeded", collabAppliedSchema),
    400: errorResponse("Not a Yjs update"),
    ...refused,
  },
});

export const updateCollabRoute = createRoute({
  method: "post",
  operationId: "updateDocumentCollabState",
  path: `${path}/update`,
  tags,
  summary: "Send co-editing changes",
  description:
    "Merges a Yjs update into the state and passes it on to the document's readers.",
  middleware: [...write] as const,
  request: { params: documentParam, body: body(collabUpdateBody) },
  responses: {
    200: jsonResponse("Merged", collabAppliedSchema),
    400: errorResponse("Not a Yjs update"),
    ...refused,
  },
});

export const collabAwarenessRoute = createRoute({
  method: "post",
  operationId: "announceDocumentCollabAwareness",
  path: `${path}/awareness`,
  tags,
  summary: "Send cursor",
  description:
    "Passes a Yjs awareness update (cursor, selection, name) to the document's other readers. Not stored.",
  middleware: [...write] as const,
  request: { params: documentParam, body: body(collabUpdateBody) },
  responses: {
    200: jsonResponse("Passed on", collabAppliedSchema),
    ...refused,
  },
});

export const saveCollabTextRoute = createRoute({
  method: "put",
  operationId: "saveDocumentCollabText",
  path: `${path}/text`,
  tags,
  summary: "Save co-edited text",
  description:
    "Saves the Markdown of the co-edited state as the document's text. 409 DOCUMENT_CHANGED when the text was changed outside co-editing since.",
  middleware: [...write] as const,
  request: { params: documentParam, body: body(collabTextBody) },
  responses: {
    200: jsonResponse("Document updated", documentSchema),
    ...refused,
  },
});
