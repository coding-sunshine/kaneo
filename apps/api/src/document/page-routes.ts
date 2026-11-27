import { createRoute, errorResponse, jsonResponse } from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  deletedPageSchema,
  deletePageQuery,
  documentParam,
  documentSchema,
  movePageBody,
  pageTreeSchema,
  workspaceIdParam,
} from "./schema";

const tags = ["Documents"];
const noAccess = errorResponse(
  "Missing permission for this workspace or document",
);
const notFound = errorResponse("Document not found");
const read = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ task: ["read"] }),
] as const;
const write = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ task: ["update"] }),
] as const;

export const pageTreeRoute = createRoute({
  method: "get",
  operationId: "getDocumentPageTree",
  path: "/workspace/{workspaceId}/tree",
  tags,
  summary: "Page tree",
  description:
    "Every document you can open, with the page it sits under, for the sidebar tree.",
  middleware: [...read] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Pages", pageTreeSchema),
    403: noAccess,
  },
});

export const movePageRoute = createRoute({
  method: "put",
  operationId: "moveDocumentPage",
  path: "/workspace/{workspaceId}/{id}/parent",
  tags,
  summary: "Put a page under another",
  description:
    "Put a page under another page, or at the top of the tree. The page keeps its place and who can open it.",
  middleware: [...write] as const,
  request: {
    params: documentParam,
    body: {
      required: true as const,
      content: { "application/json": { schema: movePageBody } },
    },
  },
  responses: {
    200: jsonResponse("The moved page", documentSchema),
    403: noAccess,
    404: notFound,
    409: errorResponse("The new parent is the page itself or a page below it"),
  },
});

export const deletePageRoute = createRoute({
  method: "delete",
  operationId: "deleteDocument",
  path: "/workspace/{workspaceId}/{id}",
  tags,
  summary: "Delete document",
  description:
    "Move a document to trash. Restore undoes it. A page with pages under it needs `children` to say what happens to them.",
  middleware: [...write] as const,
  request: { params: documentParam, query: deletePageQuery },
  responses: {
    200: jsonResponse("Document deleted", deletedPageSchema),
    403: noAccess,
    404: notFound,
    409: errorResponse(
      "The document is current on its topic, or it has pages under it and no choice for them",
    ),
  },
});
