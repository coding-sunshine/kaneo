import type { ZodType } from "zod";
import { documentSchema } from "../document/schema";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { createTopic } from "./controllers/create-topic";
import { confirmCurrent, makeCurrent, setAside } from "./controllers/decide";
import { fileDocument } from "./controllers/file-document";
import { getTopic, listTopics } from "./controllers/get-topic";
import { updateTopic } from "./controllers/update-topic";
import {
  createTopicBody,
  makeCurrentBody,
  topicDocumentParam,
  topicListSchema,
  topicParam,
  topicSchema,
  updateTopicBody,
  workspaceIdParam,
} from "./schema";

const body = <T extends ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const tags = ["Topics"];
const noAccess = errorResponse(
  "Missing permission for this workspace, topic or document",
);
const notFound = errorResponse("Topic or document not found");
const read = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ task: ["read"] }),
] as const;
const write = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ task: ["update"] }),
] as const;
const one = "/workspace/{workspaceId}/{id}";
const filed = `${one}/document/{documentId}`;

const listRoute = createRoute({
  method: "get",
  operationId: "listTopics",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "List topics",
  description:
    "List the topics you can open. A topic is open to whoever can open the place it lives in.",
  middleware: [...read] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Topics", topicListSchema),
    403: noAccess,
  },
});

const createTopicRoute = createRoute({
  method: "post",
  operationId: "createTopic",
  path: "/",
  tags,
  summary: "Create topic",
  description:
    "Create a topic in the workspace, a team or a project. You decide on it until you name someone else.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: { body: body(createTopicBody) },
  responses: {
    200: jsonResponse("Topic created", topicSchema),
    400: errorResponse("Unknown place, or a decider who cannot open the topic"),
    403: noAccess,
  },
});

const getRoute = createRoute({
  method: "get",
  operationId: "getTopic",
  path: one,
  tags,
  summary: "Get topic",
  description: "Get a topic, its deciders and its current document.",
  middleware: [...read] as const,
  request: { params: topicParam },
  responses: {
    200: jsonResponse("Topic", topicSchema),
    403: noAccess,
    404: notFound,
  },
});

const updateRoute = createRoute({
  method: "patch",
  operationId: "updateTopic",
  path: one,
  tags,
  summary: "Update topic",
  description:
    "Rename a topic or name its decider and backup decider. For the decider and workspace owners.",
  middleware: [...write] as const,
  request: { params: topicParam, body: body(updateTopicBody) },
  responses: {
    200: jsonResponse("Topic updated", topicSchema),
    400: errorResponse("A decider who cannot open the topic"),
    403: noAccess,
    404: notFound,
  },
});

const fileRoute = createRoute({
  method: "put",
  operationId: "fileDocumentOnTopic",
  path: filed,
  tags,
  summary: "File document on topic",
  description:
    "Propose a document on a topic. It moves to the topic's place and waits for approval.",
  middleware: [...write] as const,
  request: { params: topicDocumentParam },
  responses: {
    200: jsonResponse("Document filed", documentSchema),
    403: noAccess,
    404: notFound,
    409: errorResponse("The document is current or superseded"),
  },
});

const currentRoute = createRoute({
  method: "post",
  operationId: "makeDocumentCurrent",
  path: `${filed}/current`,
  tags,
  summary: "Make document current",
  description:
    "Approve a document as the one to rely on for its topic. The document that was current becomes superseded. For the decider, the backup decider and workspace owners.",
  middleware: [...write] as const,
  request: { params: topicDocumentParam, body: body(makeCurrentBody) },
  responses: {
    200: jsonResponse("Document made current", documentSchema),
    403: noAccess,
    404: notFound,
    409: errorResponse("The document is a draft or superseded"),
  },
});

const confirmRoute = createRoute({
  method: "post",
  operationId: "confirmCurrentDocument",
  path: `${filed}/confirm`,
  tags,
  summary: "Confirm current document",
  description: "Say that the current document is still current.",
  middleware: [...write] as const,
  request: { params: topicDocumentParam },
  responses: {
    200: jsonResponse("Document confirmed", documentSchema),
    403: noAccess,
    404: notFound,
    409: errorResponse("The document is not current"),
  },
});

const setAsideRoute = createRoute({
  method: "post",
  operationId: "setCurrentDocumentAside",
  path: `${filed}/set-aside`,
  tags,
  summary: "Set current document aside",
  description:
    "Turn the current document back into a proposal. The topic has no current document until one is approved.",
  middleware: [...write] as const,
  request: { params: topicDocumentParam },
  responses: {
    200: jsonResponse("Document set aside", documentSchema),
    403: noAccess,
    404: notFound,
    409: errorResponse("The document is not current"),
  },
});

const topic = apiRouter()
  .openapi(listRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(await listTopics(workspaceId, c.get("userId")), 200);
  })
  .openapi(createTopicRoute, async (c) =>
    c.json(await createTopic(c.get("userId"), c.req.valid("json")), 200),
  )
  .openapi(getRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await getTopic(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(updateRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(
      await updateTopic(workspaceId, id, c.get("userId"), c.req.valid("json")),
      200,
    );
  })
  .openapi(fileRoute, async (c) => {
    const { workspaceId, id, documentId } = c.req.valid("param");
    return c.json(
      await fileDocument(workspaceId, id, documentId, c.get("userId")),
      200,
    );
  })
  .openapi(currentRoute, async (c) => {
    const { workspaceId, id, documentId } = c.req.valid("param");
    return c.json(
      await makeCurrent(
        workspaceId,
        id,
        documentId,
        c.get("userId"),
        c.req.valid("json").reason,
      ),
      200,
    );
  })
  .openapi(confirmRoute, async (c) => {
    const { workspaceId, id, documentId } = c.req.valid("param");
    return c.json(
      await confirmCurrent(workspaceId, id, documentId, c.get("userId")),
      200,
    );
  })
  .openapi(setAsideRoute, async (c) => {
    const { workspaceId, id, documentId } = c.req.valid("param");
    return c.json(
      await setAside(workspaceId, id, documentId, c.get("userId")),
      200,
    );
  });

export default topic;
