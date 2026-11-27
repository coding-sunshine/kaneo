import type { ZodType } from "zod";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { imageUploadSchema } from "../task/response";
import { normalizeApiServerUrl } from "../utils/openapi-spec";
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
import { documentAudience } from "./controllers/document-audience";
import { documentUsage } from "./controllers/document-usage";
import { getDocument } from "./controllers/get-document";
import { listIssueFiles } from "./controllers/issue-files";
import {
  handOverDocuments,
  listOwnerlessDocuments,
  takeOverDocument,
} from "./controllers/hand-over-documents";
import { listDocuments } from "./controllers/list-documents";
import { moveDocument } from "./controllers/move-document";
import {
  issueFileAudience,
  proposeIssueFile,
} from "./controllers/propose-issue-file";
import { setSubscribers } from "./controllers/set-subscribers";
import { shareDocument, unshareDocument } from "./controllers/share-document";
import {
  shareWithTask,
  taskAudience,
  unshareFromTask,
  unshareHiddenTasks,
} from "./controllers/share-with-task";
import { markDocumentsSeen } from "./controllers/mark-documents-seen";
import { decideLineage } from "./controllers/lineage";
import { snoozeDocument } from "./controllers/snooze-document";
import { updateDocument } from "./controllers/update-document";
import {
  createDocumentFileUpload,
  finalizeDocumentFileUpload,
} from "./controllers/upload-document-file";
import { saveDraft } from "./controllers/save-draft";
import { settleDocument } from "./controllers/settle-document";
import {
  addStatement,
  confirmStatement,
  listStatements,
  rejectStatement,
} from "../topic/controllers/statements";
import { listVersions, restoreVersion } from "./controllers/versions";
import {
  audienceQuery,
  createCommentBody,
  createDocumentBody,
  documentCommentListSchema,
  documentCommentParam,
  documentAudienceSchema,
  documentTaskAudienceSchema,
  documentCommentSchema,
  documentFileSchema,
  documentFileUploadBody,
  finalizeDocumentFileUploadBody,
  documentListSchema,
  documentParam,
  documentSchema,
  documentSnoozeSchema,
  documentTaskParam,
  documentUsageSchema,
  documentUserParam,
  documentVersionListSchema,
  documentVersionParam,
  handedOverSchema,
  handOverBody,
  idSchema,
  issueFileListSchema,
  issueFileParam,
  issueFilesQuery,
  issueFileTopic,
  listDocumentsQuery,
  moveDocumentBody,
  documentsSeenSchema,
  markDocumentsSeenBody,
  ownerlessDocumentListSchema,
  saveDraftBody,
  savedDraftSchema,
  settleDocumentBody,
  settledDocumentSchema,
  shareBody,
  decideLineageBody,
  snoozeDocumentBody,
  subscribersBody,
  subscribersSchema,
  updateCommentBody,
  updateDocumentBody,
  workspaceIdParam,
} from "./schema";
import {
  addStatementRoute,
  confirmStatementRoute,
  listStatementsRoute,
  rejectStatementRoute,
} from "./statement-routes";
import { decideConflictRoute, receiptRoute } from "./receipt-routes";
import {
  addDependentRoute,
  reliedTopicsRoute,
  removeDependentRoute,
} from "./dependency-routes";
import {
  addDependency,
  reliedTopics,
  removeDependency,
} from "../topic/controllers/dependencies";
import { decideConflict } from "../topic/controllers/decide-conflict";
import { getReceipt } from "../topic/controllers/receipt";

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
// Where a stored file is read back from.
const apiBaseUrl = (requestUrl: string) =>
  normalizeApiServerUrl(
    process.env.KANEO_API_URL || new URL(requestUrl).origin,
  );

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

const saveDraftRoute = createRoute({
  method: "post",
  operationId: "saveDocumentDraft",
  path: "/file",
  tags,
  summary: "Save a draft from an assistant",
  description:
    "Save text as a private draft of the signed-in person. The answer names the topics the title matches. A repeated call with the same key answers with the first draft.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: { body: body(saveDraftBody) },
  responses: {
    200: jsonResponse("Draft saved", savedDraftSchema),
    403: noAccess,
    409: errorResponse("The draft saved with this key was discarded"),
  },
});

const settleRoute = createRoute({
  method: "post",
  operationId: "settleDocument",
  path: `${one}/settle`,
  tags,
  summary: "Settle a draft",
  description:
    "Record what the author decided for their draft: file it on a topic, keep it as a brainstorm, or discard it. No choice makes a document current.",
  middleware: [...write] as const,
  request: { params: documentParam, body: body(settleDocumentBody) },
  responses: {
    200: jsonResponse("Draft settled", settledDocumentSchema),
    400: errorResponse("The choice needs a topic"),
    403: errorResponse("Only the author can settle a draft"),
    404: errorResponse("Document or topic not found"),
    409: errorResponse(
      "The document is not a draft, or the topic has nothing to replace",
    ),
  },
});

const ownersOnly = errorResponse(
  "Only a workspace owner can hand over private documents",
);

const handOverRoute = createRoute({
  method: "post",
  operationId: "handOverDocuments",
  path: "/workspace/{workspaceId}/hand-over",
  tags,
  summary: "Hand over a former member's private documents",
  description:
    "Make a member the author of the private documents of somebody who left the workspace. Workspace owners only. The private documents of a current member never move: the answer is then 0.",
  middleware: [...write] as const,
  request: { params: workspaceIdParam, body: body(handOverBody) },
  responses: {
    200: jsonResponse("How many documents moved", handedOverSchema),
    403: ownersOnly,
    404: errorResponse("The receiving member was not found"),
  },
});

const seenRoute = createRoute({
  method: "post",
  operationId: "markDocumentsSeen",
  path: "/workspace/{workspaceId}/seen",
  tags,
  summary: "Mark new documents as seen",
  description:
    "Record that you have seen what is new on the topics you follow, up to a time. The time only moves forward.",
  middleware: [...read] as const,
  request: { params: workspaceIdParam, body: body(markDocumentsSeenBody) },
  responses: {
    200: jsonResponse("Your last visit", documentsSeenSchema),
    403: noAccess,
  },
});

const ownerlessRoute = createRoute({
  method: "get",
  operationId: "listOwnerlessDocuments",
  path: "/workspace/{workspaceId}/ownerless",
  tags,
  summary: "List private documents with no author",
  description:
    "Title and date of the private documents whose author deleted their account or left the workspace. Workspace owners only.",
  middleware: [...read] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Documents with no author", ownerlessDocumentListSchema),
    403: ownersOnly,
  },
});

const issueFiles = "/workspace/{workspaceId}/issue-files";
const fileNotFound = errorResponse(
  "No such file on an issue you can open, or no such topic of that issue",
);

const issueFilesRoute = createRoute({
  method: "get",
  operationId: "listIssueFiles",
  path: issueFiles,
  tags,
  summary: "List issue files",
  description:
    "The files attached to issues you can open, newest first, each with its issue and that issue's topics. They are reference material: none is a document or a proposal until someone proposes it. Pictures pasted into a description are left out.",
  middleware: [...read] as const,
  request: { params: workspaceIdParam, query: issueFilesQuery },
  responses: {
    200: jsonResponse("Issue files", issueFileListSchema),
    403: noAccess,
    404: errorResponse("Topic not found"),
  },
});

const issueFileAudienceRoute = createRoute({
  method: "get",
  operationId: "getIssueFileAudience",
  path: `${issueFiles}/{assetId}/audience`,
  tags,
  summary: "See who an issue file would open to",
  description:
    "Who can open the file now, on its issue, and who could open the document it becomes when proposed on the topic.",
  middleware: [...read] as const,
  request: { params: issueFileParam, query: issueFileTopic },
  responses: {
    200: jsonResponse("Audience", documentAudienceSchema),
    403: noAccess,
    404: fileNotFound,
  },
});

const proposeIssueFileRoute = createRoute({
  method: "post",
  operationId: "proposeIssueFile",
  path: `${issueFiles}/{assetId}/propose`,
  tags,
  summary: "Propose an issue file on a topic",
  description:
    "Make a document from an issue's file and file it as a proposal on a topic of that issue. The document holds its own copy of the file and opens for everyone who can open the topic. The issue keeps its file.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["create", "update"] }),
  ] as const,
  request: { params: issueFileParam, body: body(issueFileTopic) },
  responses: {
    200: jsonResponse("The proposal", documentSchema),
    400: errorResponse("The file is too large for a document"),
    403: noAccess,
    404: fileNotFound,
    409: errorResponse("The file is already proposed on this topic"),
    415: errorResponse(
      "The file's name does not end in a type a document can hold",
    ),
    503: errorResponse("The file could not be copied"),
  },
});

const usageRoute = createRoute({
  method: "get",
  operationId: "getDocumentUsage",
  path: "/workspace/{workspaceId}/usage",
  tags,
  summary: "Count documents added, filed and saved from chat",
  description:
    "For each of the last four weeks: documents added, how many of them were filed on a topic and how many an assistant saved. Also the number of topics with a current document. Numbers only, with no title, topic or person. They count documents the caller cannot open, so they go to workspace owners only.",
  middleware: [...read] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Usage numbers", documentUsageSchema),
    403: errorResponse("Only a workspace owner can see document usage"),
  },
});

const takeOverRoute = createRoute({
  method: "post",
  operationId: "takeOverDocument",
  path: `${one}/take-over`,
  tags,
  summary: "Take over a private document with no author",
  description:
    "Become the author of a private document whose author deleted their account or left the workspace. Workspace owners only.",
  middleware: [...write] as const,
  request: { params: documentParam },
  responses: {
    200: jsonResponse("Document taken over", idSchema),
    403: ownersOnly,
    404: notFound,
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

const snoozeRoute = createRoute({
  method: "post",
  operationId: "snoozeDocument",
  path: `${one}/snooze`,
  tags,
  summary: "Snooze document",
  description:
    "Set a document aside in the Inbox until a time, for everybody who sees it there. Needs edit access.",
  middleware: [...write] as const,
  request: { params: documentParam, body: body(snoozeDocumentBody) },
  responses: {
    200: jsonResponse("Document snoozed", documentSnoozeSchema),
    403: noAccess,
    404: notFound,
  },
});

const lineageRoute = createRoute({
  method: "put",
  operationId: "decideDocumentLineage",
  path: `${one}/lineage`,
  tags,
  summary: "Confirm or dismiss a proposed revision link",
  description:
    "Say whether the document is a revision of the older document it resembles. Either answer can be changed later. The link is a hint: no status changes. Needs edit access.",
  middleware: [...write] as const,
  request: { params: documentParam, body: body(decideLineageBody) },
  responses: {
    200: jsonResponse("Link decided", documentSchema),
    403: noAccess,
    404: errorResponse("Document not found, or it has no link to decide"),
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

const taskAudienceRoute = createRoute({
  method: "get",
  operationId: "getDocumentTaskAudience",
  path: `${one}/task/{taskId}/audience`,
  tags,
  summary: "Who on an issue cannot open a document",
  description:
    "How many people can open the issue, and how many of them cannot open the document. A link in the issue's text gives nobody access.",
  middleware: [...read] as const,
  request: { params: documentTaskParam },
  responses: {
    200: jsonResponse("Issue audience", documentTaskAudienceSchema),
    403: noAccess,
    404: errorResponse("Document or issue not found"),
  },
});

const shareTaskRoute = createRoute({
  method: "put",
  operationId: "shareDocumentWithTask",
  path: `${one}/task/{taskId}/share`,
  tags,
  summary: "Share document with an issue",
  description:
    "Everyone who can open the issue can view the document from then on. Needs edit rights on the document and an issue you can open.",
  middleware: [...write] as const,
  request: { params: documentTaskParam },
  responses: {
    200: jsonResponse("Document shared", documentSchema),
    403: noAccess,
    404: errorResponse("Document or issue not found"),
  },
});

const unshareTaskRoute = createRoute({
  method: "delete",
  operationId: "unshareDocumentFromTask",
  path: `${one}/task/{taskId}/share`,
  tags,
  summary: "Stop sharing with an issue",
  description:
    "The issue no longer lets anyone into the document. Needs edit rights on the document.",
  middleware: [...write] as const,
  request: { params: documentTaskParam },
  responses: {
    200: jsonResponse("Sharing stopped", documentSchema),
    403: noAccess,
    404: notFound,
  },
});

const unshareHiddenTasksRoute = createRoute({
  method: "delete",
  operationId: "unshareDocumentFromHiddenTasks",
  path: `${one}/task-shares/hidden`,
  tags,
  summary: "Stop sharing with issues you cannot open",
  description:
    "Removes every share on an issue in a team you cannot open; those issues no longer let anyone into the document. Needs edit rights on the document.",
  middleware: [...write] as const,
  request: { params: documentParam },
  responses: {
    200: jsonResponse("Sharing stopped", documentSchema),
    403: noAccess,
    404: notFound,
  },
});

const audienceRoute = createRoute({
  method: "get",
  operationId: "getDocumentAudience",
  path: `${one}/audience`,
  tags,
  summary: "Who can open a document",
  description:
    "The workspace members who can open the document, and who could after a move to the place given in the query.",
  middleware: [...read] as const,
  request: { params: documentParam, query: audienceQuery },
  responses: {
    200: jsonResponse("Document audience", documentAudienceSchema),
    400: errorResponse("Document parent not found"),
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

const superseded = errorResponse("A superseded document cannot be changed");
const fileRefused = errorResponse(
  "The file's name does not end in a type a document can hold",
);

const createFileUploadRoute = createRoute({
  method: "put",
  operationId: "createDocumentFileUpload",
  path: `${one}/upload`,
  tags,
  summary: "Start a file upload",
  description:
    "Get a presigned URL for adding a file to a document. Anyone who can edit the document can add one. The stored type comes from the file name's extension: PDF, Office and OpenDocument files, plain text, Markdown, CSV and images are accepted. Send the bytes to the URL with the returned headers, then call the finalize route.",
  middleware: [...write] as const,
  request: { params: documentParam, body: body(documentFileUploadBody) },
  responses: {
    200: jsonResponse("The presigned upload", imageUploadSchema),
    400: errorResponse("The file is empty or too large"),
    403: noAccess,
    404: notFound,
    409: superseded,
    415: fileRefused,
    503: errorResponse("File uploads are not configured on this instance"),
  },
});

const finalizeFileUploadRoute = createRoute({
  method: "post",
  operationId: "finalizeDocumentFileUpload",
  path: `${one}/upload/finalize`,
  tags,
  summary: "Finalize a file upload",
  description:
    "Record an uploaded file as part of a document and return the URL to reference it by. The file opens for whoever can open the document, and for nobody else.",
  middleware: [...write] as const,
  request: {
    params: documentParam,
    body: body(finalizeDocumentFileUploadBody),
  },
  responses: {
    200: jsonResponse("The stored file", documentFileSchema),
    400: errorResponse(
      "The key does not belong to this document, or the stored object does not match the name and size",
    ),
    403: noAccess,
    404: notFound,
    409: superseded,
    415: fileRefused,
    503: errorResponse("The stored object could not be checked"),
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
  .openapi(saveDraftRoute, async (c) =>
    c.json(await saveDraft(c.get("userId"), c.req.valid("json")), 200),
  )
  .openapi(settleRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    const userId = c.get("userId");
    return c.json(
      await settleDocument(workspaceId, id, userId, c.req.valid("json")),
      200,
    );
  })
  .openapi(listStatementsRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await listStatements(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(addStatementRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    const userId = c.get("userId");
    return c.json(
      await addStatement(workspaceId, id, userId, c.req.valid("json")),
      200,
    );
  })
  .openapi(confirmStatementRoute, async (c) => {
    const { workspaceId, id, statementId } = c.req.valid("param");
    return c.json(
      await confirmStatement(workspaceId, id, statementId, c.get("userId")),
      200,
    );
  })
  .openapi(rejectStatementRoute, async (c) => {
    const { workspaceId, id, statementId } = c.req.valid("param");
    const { reason } = c.req.valid("json");
    return c.json(
      await rejectStatement(
        workspaceId,
        id,
        statementId,
        c.get("userId"),
        reason,
      ),
      200,
    );
  })
  .openapi(reliedTopicsRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await reliedTopics(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(addDependentRoute, async (c) => {
    const { workspaceId, id, statementId } = c.req.valid("param");
    return c.json(
      await addDependency(
        workspaceId,
        id,
        statementId,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    );
  })
  .openapi(removeDependentRoute, async (c) => {
    const { workspaceId, id, statementId, dependencyId } = c.req.valid("param");
    return c.json(
      await removeDependency(
        workspaceId,
        id,
        statementId,
        dependencyId,
        c.get("userId"),
      ),
      200,
    );
  })
  // Before the routes that read the last segment as a document id.
  .openapi(receiptRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await getReceipt(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(decideConflictRoute, async (c) => {
    const { workspaceId, id, conflictId } = c.req.valid("param");
    const userId = c.get("userId");
    return c.json(
      await decideConflict(
        workspaceId,
        id,
        conflictId,
        userId,
        c.req.valid("json"),
      ),
      200,
    );
  })
  .openapi(handOverRoute, async (c) =>
    c.json(
      await handOverDocuments(
        c.req.valid("param").workspaceId,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(seenRoute, async (c) =>
    c.json(
      await markDocumentsSeen(
        c.req.valid("param").workspaceId,
        c.get("userId"),
        c.req.valid("json").until,
      ),
      200,
    ),
  )
  .openapi(ownerlessRoute, async (c) =>
    c.json(
      await listOwnerlessDocuments(
        c.req.valid("param").workspaceId,
        c.get("userId"),
      ),
      200,
    ),
  )
  .openapi(issueFilesRoute, async (c) =>
    c.json(
      await listIssueFiles(
        c.req.valid("param").workspaceId,
        c.get("userId"),
        c.req.valid("query").topicId,
        apiBaseUrl(c.req.url),
      ),
      200,
    ),
  )
  .openapi(issueFileAudienceRoute, async (c) => {
    const { workspaceId, assetId } = c.req.valid("param");
    return c.json(
      await issueFileAudience(
        workspaceId,
        assetId,
        c.get("userId"),
        c.req.valid("query").topicId,
      ),
      200,
    );
  })
  .openapi(proposeIssueFileRoute, async (c) => {
    const { workspaceId, assetId } = c.req.valid("param");
    return c.json(
      await proposeIssueFile(
        workspaceId,
        assetId,
        c.get("userId"),
        c.req.valid("json").topicId,
        apiBaseUrl(c.req.url),
      ),
      200,
    );
  })
  .openapi(usageRoute, async (c) =>
    c.json(
      await documentUsage(c.req.valid("param").workspaceId, c.get("userId")),
      200,
    ),
  )
  .openapi(takeOverRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(
      await takeOverDocument(workspaceId, c.get("userId"), id),
      200,
    );
  })
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
  .openapi(snoozeRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    const { until } = c.req.valid("json");
    return c.json(
      await snoozeDocument(workspaceId, id, c.get("userId"), until),
      200,
    );
  })
  .openapi(lineageRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    const userId = c.get("userId");
    await decideLineage(workspaceId, id, userId, c.req.valid("json").status);
    return c.json(await getDocument(workspaceId, id, userId), 200);
  })
  .openapi(deleteRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await deleteDocument(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(restoreRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await restoreDocument(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(audienceRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(
      await documentAudience(
        workspaceId,
        id,
        c.get("userId"),
        c.req.valid("query"),
      ),
      200,
    );
  })
  .openapi(taskAudienceRoute, async (c) => {
    const { workspaceId, id, taskId } = c.req.valid("param");
    return c.json(
      await taskAudience(workspaceId, id, c.get("userId"), taskId),
      200,
    );
  })
  .openapi(shareTaskRoute, async (c) => {
    const { workspaceId, id, taskId } = c.req.valid("param");
    return c.json(
      await shareWithTask(workspaceId, id, c.get("userId"), taskId),
      200,
    );
  })
  .openapi(unshareTaskRoute, async (c) => {
    const { workspaceId, id, taskId } = c.req.valid("param");
    return c.json(
      await unshareFromTask(workspaceId, id, c.get("userId"), taskId),
      200,
    );
  })
  .openapi(unshareHiddenTasksRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(
      await unshareHiddenTasks(workspaceId, id, c.get("userId")),
      200,
    );
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
  .openapi(createFileUploadRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(
      await createDocumentFileUpload(
        workspaceId,
        id,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    );
  })
  .openapi(finalizeFileUploadRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    const file = await finalizeDocumentFileUpload(
      workspaceId,
      id,
      c.get("userId"),
      c.req.valid("json"),
    );
    return c.json(
      { ...file, url: `${apiBaseUrl(c.req.url)}/asset/${file.id}` },
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
