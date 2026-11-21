import type { ZodType } from "zod";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from "./controllers/comments";
import { createDocument } from "./controllers/create-document";
import { deleteDocument, restoreDocument } from "./controllers/delete-document";
import { getDocument } from "./controllers/get-document";
import { listDocuments } from "./controllers/list-documents";
import { moveDocument } from "./controllers/move-document";
import { setSubscribers } from "./controllers/set-subscribers";
import { shareDocument, unshareDocument } from "./controllers/share-document";
import { updateDocument } from "./controllers/update-document";
import { listVersions, restoreVersion } from "./controllers/versions";
import {
  createCommentBody,
  createDocumentBody,
  documentCommentListSchema,
  documentCommentParam,
  documentCommentSchema,
  documentListSchema,
  documentParam,
  documentSchema,
  documentUserParam,
  documentVersionListSchema,
  documentVersionParam,
  idSchema,
  listDocumentsQuery,
  moveDocumentBody,
  shareBody,
  subscribersBody,
  subscribersSchema,
  updateCommentBody,
  updateDocumentBody,
  workspaceIdParam,
} from "./schema";

const body = <T extends ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
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
const one = "/workspace/{workspaceId}/{id}";

const listRoute = createRoute({
  method: "get",
  operationId: "listDocuments",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "List documents",
  description:
    "List the documents you can see: yours, shared with you, or those in a team, project or issue.",
  middleware: [...read] as const,
  request: { params: workspaceIdParam, query: listDocumentsQuery },
  responses: {
    200: jsonResponse("Documents", documentListSchema),
    403: noAccess,
  },
});

const createRouteDef = createRoute({
  method: "post",
  operationId: "createDocument",
  path: "/",
  tags,
  summary: "Create document",
  description:
    "Create a document. Without a team, project or issue it is private to you.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: { body: body(createDocumentBody) },
  responses: {
    200: jsonResponse("Document created", documentSchema),
    400: errorResponse("Document parent not found"),
    403: noAccess,
  },
});

const getRoute = createRoute({
  method: "get",
  operationId: "getDocument",
  path: one,
  tags,
  summary: "Get document",
  description: "Get a document with your access level, shares and subscribers.",
  middleware: [...read] as const,
  request: { params: documentParam },
  responses: {
    200: jsonResponse("Document", documentSchema),
    403: noAccess,
    404: notFound,
  },
});

const updateRoute = createRoute({
  method: "patch",
  operationId: "updateDocument",
  path: one,
  tags,
  summary: "Update document",
  description:
    "Change the title, content, icon, color or general access. Text edits are kept in history.",
  middleware: [...write] as const,
  request: { params: documentParam, body: body(updateDocumentBody) },
  responses: {
    200: jsonResponse("Document updated", documentSchema),
    403: noAccess,
    404: notFound,
  },
});

const moveRoute = createRoute({
  method: "put",
  operationId: "moveDocument",
  path: `${one}/location`,
  tags,
  summary: "Move document",
  description:
    "Move a document to My documents, the workspace, a team, a project or an issue. Moving to My documents removes everyone invited. Returns null when you can no longer see it.",
  middleware: [...write] as const,
  request: { params: documentParam, body: body(moveDocumentBody) },
  responses: {
    200: jsonResponse("Document moved", documentSchema.nullable()),
    400: errorResponse("Document parent not found"),
    403: noAccess,
    404: notFound,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  operationId: "deleteDocument",
  path: one,
  tags,
  summary: "Delete document",
  description: "Move a document to trash. Restore undoes it.",
  middleware: [...write] as const,
  request: { params: documentParam },
  responses: {
    200: jsonResponse("Document deleted", idSchema),
    403: noAccess,
    404: notFound,
  },
});

const restoreRoute = createRoute({
  method: "post",
  operationId: "restoreDocument",
  path: `${one}/restore`,
  tags,
  summary: "Restore document",
  description: "Bring a deleted document back.",
  middleware: [...write] as const,
  request: { params: documentParam },
  responses: {
    200: jsonResponse("Document restored", documentSchema),
    403: noAccess,
    404: notFound,
  },
});

const shareRoute = createRoute({
  method: "put",
  operationId: "shareDocument",
  path: `${one}/share/{userId}`,
  tags,
  summary: "Share document",
  description: "Invite a workspace member or change what they may do.",
  middleware: [...write] as const,
  request: { params: documentUserParam, body: body(shareBody) },
  responses: {
    200: jsonResponse("Document shared", documentSchema),
    400: errorResponse("Only workspace members can be invited"),
    403: noAccess,
    404: notFound,
  },
});

const unshareRoute = createRoute({
  method: "delete",
  operationId: "unshareDocument",
  path: `${one}/share/{userId}`,
  tags,
  summary: "Remove access",
  description: "Remove someone's direct access. Anyone may remove themselves.",
  middleware: [...read] as const,
  request: { params: documentUserParam },
  responses: {
    200: jsonResponse("Access removed", idSchema),
    403: noAccess,
    404: notFound,
  },
});

const subscribersRoute = createRoute({
  method: "put",
  operationId: "setDocumentSubscribers",
  path: `${one}/subscribers`,
  tags,
  summary: "Set subscribers",
  description: "Replace who is notified about comments on the document.",
  middleware: [...read] as const,
  request: { params: documentParam, body: body(subscribersBody) },
  responses: {
    200: jsonResponse("Subscribers", subscribersSchema),
    400: errorResponse("Subscribers must be able to see the document"),
    403: noAccess,
    404: notFound,
  },
});

const versionsRoute = createRoute({
  method: "get",
  operationId: "listDocumentVersions",
  path: `${one}/versions`,
  tags,
  summary: "List versions",
  description: "The document's history, newest first.",
  middleware: [...read] as const,
  request: { params: documentParam },
  responses: {
    200: jsonResponse("Versions", documentVersionListSchema),
    403: noAccess,
    404: notFound,
  },
});

const restoreVersionRoute = createRoute({
  method: "post",
  operationId: "restoreDocumentVersion",
  path: `${one}/versions/{versionId}/restore`,
  tags,
  summary: "Restore version",
  description: "Replace the document's title and content with a past version.",
  middleware: [...write] as const,
  request: { params: documentVersionParam },
  responses: {
    200: jsonResponse("Version restored", documentSchema),
    403: noAccess,
    404: errorResponse("Version not found"),
  },
});

const commentsRoute = createRoute({
  method: "get",
  operationId: "listDocumentComments",
  path: `${one}/comments`,
  tags,
  summary: "List comments",
  description: "All comments and replies, oldest first.",
  middleware: [...read] as const,
  request: { params: documentParam },
  responses: {
    200: jsonResponse("Comments", documentCommentListSchema),
    403: noAccess,
    404: notFound,
  },
});

const createCommentRoute = createRoute({
  method: "post",
  operationId: "createDocumentComment",
  path: `${one}/comments`,
  tags,
  summary: "Comment",
  description:
    "Start a thread, optionally on quoted text, or reply to one. Needs comment access.",
  middleware: [...read] as const,
  request: { params: documentParam, body: body(createCommentBody) },
  responses: {
    200: jsonResponse("Comment created", documentCommentSchema),
    400: errorResponse("Reply to the thread instead"),
    403: noAccess,
    404: notFound,
  },
});

const updateCommentRoute = createRoute({
  method: "patch",
  operationId: "updateDocumentComment",
  path: `${one}/comments/{commentId}`,
  tags,
  summary: "Update comment",
  description: "Edit your comment, or resolve or reopen a thread.",
  middleware: [...read] as const,
  request: { params: documentCommentParam, body: body(updateCommentBody) },
  responses: {
    200: jsonResponse("Comment updated", documentCommentSchema),
    400: errorResponse("Resolve the thread instead"),
    403: noAccess,
    404: errorResponse("Comment not found"),
  },
});

const deleteCommentRoute = createRoute({
  method: "delete",
  operationId: "deleteDocumentComment",
  path: `${one}/comments/{commentId}`,
  tags,
  summary: "Delete comment",
  description: "Delete your comment. Deleting a thread removes its replies.",
  middleware: [...read] as const,
  request: { params: documentCommentParam },
  responses: {
    200: jsonResponse("Comment deleted", idSchema),
    403: noAccess,
    404: errorResponse("Comment not found"),
  },
});

const document = apiRouter()
  .openapi(listRoute, async (c) =>
    c.json(
      await listDocuments(
        c.req.valid("param").workspaceId,
        c.get("userId"),
        c.req.valid("query"),
      ),
      200,
    ),
  )
  .openapi(createRouteDef, async (c) =>
    c.json(await createDocument(c.get("userId"), c.req.valid("json")), 200),
  )
  .openapi(getRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await getDocument(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(updateRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    const userId = c.get("userId");
    return c.json(
      await updateDocument(workspaceId, id, userId, c.req.valid("json")),
      200,
    );
  })
  .openapi(moveRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    const userId = c.get("userId");
    return c.json(
      await moveDocument(workspaceId, id, userId, c.req.valid("json")),
      200,
    );
  })
  .openapi(deleteRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await deleteDocument(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(restoreRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await restoreDocument(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(shareRoute, async (c) => {
    const { workspaceId, id, userId: target } = c.req.valid("param");
    const { access } = c.req.valid("json");
    return c.json(
      await shareDocument(workspaceId, id, c.get("userId"), target, access),
      200,
    );
  })
  .openapi(unshareRoute, async (c) => {
    const { workspaceId, id, userId: target } = c.req.valid("param");
    return c.json(
      await unshareDocument(workspaceId, id, c.get("userId"), target),
      200,
    );
  })
  .openapi(subscribersRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    const { userIds } = c.req.valid("json");
    return c.json(
      await setSubscribers(workspaceId, id, c.get("userId"), userIds),
      200,
    );
  })
  .openapi(versionsRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await listVersions(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(restoreVersionRoute, async (c) => {
    const { workspaceId, id, versionId } = c.req.valid("param");
    return c.json(
      await restoreVersion(workspaceId, id, c.get("userId"), versionId),
      200,
    );
  })
  .openapi(commentsRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await listComments(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(createCommentRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    const userId = c.get("userId");
    return c.json(
      await createComment(workspaceId, id, userId, c.req.valid("json")),
      200,
    );
  })
  .openapi(updateCommentRoute, async (c) => {
    const { workspaceId, id, commentId } = c.req.valid("param");
    const userId = c.get("userId");
    return c.json(
      await updateComment(
        workspaceId,
        id,
        userId,
        commentId,
        c.req.valid("json"),
      ),
      200,
    );
  })
  .openapi(deleteCommentRoute, async (c) => {
    const { workspaceId, id, commentId } = c.req.valid("param");
    return c.json(
      await deleteComment(workspaceId, id, c.get("userId"), commentId),
      200,
    );
  });

export default document;
