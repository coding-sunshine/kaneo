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
import { followTopic, unfollowTopic } from "./controllers/follow-topic";
import { findTopics } from "./controllers/find-topics";
import { getTopic, listTopics } from "./controllers/get-topic";
import { getCurrent, listUnreviewed } from "./controllers/read-topic";
import { recordDecision } from "./controllers/record-decision";
import { createSlot, deleteSlot, listSlots } from "./controllers/slots";
import {
  linkTaskTopic,
  listTaskTopics,
  listTopicTasks,
  unlinkTaskTopic,
} from "./controllers/topic-tasks";
import { updateTopic } from "./controllers/update-topic";
import {
  createTopicBody,
  makeCurrentBody,
  recordDecisionBody,
  taskTopicsParam,
  topicDocumentParam,
  topicCurrentSchema,
  topicListQuery,
  topicListSchema,
  topicParam,
  currentReadQuery,
  topicReadQuery,
  topicSchema,
  topicTaskParam,
  topicTasksSchema,
  topicUnreviewedSchema,
  updateTopicBody,
  workspaceIdParam,
} from "./schema";
import {
  createSlotRoute,
  deleteSlotRoute,
  listSlotsRoute,
} from "./slot-routes";
import {
  clearFlag,
  listDependents,
  listNeedsReview,
} from "./controllers/needs-review";
import {
  clearNeedsReviewRoute,
  needsReviewRoute,
  topicDependentsRoute,
} from "./needs-review-routes";

const body = <T extends ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const tags = ["Topics"];
const noAccess = errorResponse(
  "Missing permission for this workspace, topic or document",
);
const notFound = errorResponse("Topic or document not found");
const noTopicOrTask = errorResponse(
  "Topic or issue not found. One you cannot open answers the same.",
);
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
const onTopic = `${one}/task/{taskId}`;

const listRoute = createRoute({
  method: "get",
  operationId: "listTopics",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "List topics",
  description:
    "List the topics you can open. A topic is open to whoever can open the place it lives in. With `match`, only the topics that text names.",
  middleware: [...read] as const,
  request: { params: workspaceIdParam, query: topicListQuery },
  responses: {
    200: jsonResponse("Topics", topicListSchema),
    403: noAccess,
  },
});

const readCurrentRoute = createRoute({
  method: "get",
  operationId: "getTopicCurrent",
  path: "/workspace/{workspaceId}/current",
  tags,
  summary: "Read what is approved on a topic",
  description:
    "Find topics by id or by name and return each one's current document with its approved text, and what it states for each slot of the topic. The text is sent when exactly one topic matches. A topic you cannot open answers like a name nobody used: an empty list.",
  middleware: [...read] as const,
  request: { params: workspaceIdParam, query: currentReadQuery },
  responses: {
    200: jsonResponse("Matching topics", topicCurrentSchema),
    403: noAccess,
  },
});

const readUnreviewedRoute = createRoute({
  method: "get",
  operationId: "listTopicUnreviewed",
  path: "/workspace/{workspaceId}/unreviewed",
  tags,
  summary: "List what waits for a decision on a topic",
  description:
    "Find topics by id or by name and list the documents filed on each that its decider has not decided on. Titles only, never their text. A topic you cannot open answers like a name nobody used: an empty list.",
  middleware: [...read] as const,
  request: { params: workspaceIdParam, query: topicReadQuery },
  responses: {
    200: jsonResponse("Matching topics", topicUnreviewedSchema),
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

const decisionRoute = createRoute({
  method: "post",
  operationId: "recordDecision",
  path: `${one}/decision`,
  tags,
  summary: "Record a decision",
  description:
    "Write down a decision on a topic. With no current document, the decision is saved as a document of kind decision and made current. Otherwise it is added to the current document as a dated line under a Decisions heading, and the document reads as edited after approval until the line is approved. For the decider, the backup decider and workspace owners.",
  middleware: [...write] as const,
  request: { params: topicParam, body: body(recordDecisionBody) },
  responses: {
    200: jsonResponse("The document that holds the decision", documentSchema),
    403: noAccess,
    404: notFound,
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

const followRoute = createRoute({
  method: "put",
  operationId: "followTopic",
  path: `${one}/follow`,
  tags,
  summary: "Follow topic",
  description:
    "Follow a topic you can open. Followers are told about a new proposal and a new current document, and the Documents page lists both as new.",
  middleware: [...read] as const,
  request: { params: topicParam },
  responses: {
    200: jsonResponse("Topic followed", topicSchema),
    403: noAccess,
    404: notFound,
  },
});

const unfollowRoute = createRoute({
  method: "delete",
  operationId: "unfollowTopic",
  path: `${one}/follow`,
  tags,
  summary: "Unfollow topic",
  description: "Stop following a topic.",
  middleware: [...read] as const,
  request: { params: topicParam },
  responses: {
    200: jsonResponse("Topic unfollowed", topicSchema),
    403: noAccess,
    404: notFound,
  },
});

const taskTopicsRoute = createRoute({
  method: "get",
  operationId: "listTaskTopics",
  path: "/workspace/{workspaceId}/task/{taskId}/topics",
  tags,
  summary: "List an issue's topics",
  description:
    "List the topics an issue is on that you can open, each with its current document.",
  middleware: [...read] as const,
  request: { params: taskTopicsParam },
  responses: {
    200: jsonResponse("Topics", topicListSchema),
    403: noAccess,
    404: noTopicOrTask,
  },
});

const topicTasksRoute = createRoute({
  method: "get",
  operationId: "listTopicTasks",
  path: `${one}/task`,
  tags,
  summary: "List a topic's issues",
  description: "List the issues on a topic that you can open.",
  middleware: [...read] as const,
  request: { params: topicParam },
  responses: {
    200: jsonResponse("Issues", topicTasksSchema),
    403: noAccess,
    404: notFound,
  },
});

const linkTaskRoute = createRoute({
  method: "put",
  operationId: "linkTaskTopic",
  path: onTopic,
  tags,
  summary: "Put an issue on a topic",
  description:
    "Put an issue you can open on a topic you can open. Nobody is notified. Doing it twice changes nothing.",
  middleware: [...write] as const,
  request: { params: topicTaskParam },
  responses: {
    200: jsonResponse("Issues on the topic", topicTasksSchema),
    403: noAccess,
    404: noTopicOrTask,
  },
});

const unlinkTaskRoute = createRoute({
  method: "delete",
  operationId: "unlinkTaskTopic",
  path: onTopic,
  tags,
  summary: "Take an issue off a topic",
  description: "Take an issue off a topic. Doing it twice changes nothing.",
  middleware: [...write] as const,
  request: { params: topicTaskParam },
  responses: {
    200: jsonResponse("Issues on the topic", topicTasksSchema),
    403: noAccess,
    404: noTopicOrTask,
  },
});

const topic = apiRouter()
  .openapi(listRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { match } = c.req.valid("query");
    return c.json(
      match
        ? await findTopics(workspaceId, c.get("userId"), match)
        : await listTopics(workspaceId, c.get("userId")),
      200,
    );
  })
  .openapi(taskTopicsRoute, async (c) => {
    const { workspaceId, taskId } = c.req.valid("param");
    return c.json(
      await listTaskTopics(workspaceId, taskId, c.get("userId")),
      200,
    );
  })
  .openapi(createTopicRoute, async (c) =>
    c.json(await createTopic(c.get("userId"), c.req.valid("json")), 200),
  )
  // Before the route for one topic: its `{id}` would take these words
  // for a topic's id and answer 404.
  .openapi(needsReviewRoute, async (c) =>
    c.json(
      await listNeedsReview(c.req.valid("param").workspaceId, c.get("userId")),
      200,
    ),
  )
  .openapi(clearNeedsReviewRoute, async (c) => {
    const { workspaceId, dependencyId } = c.req.valid("param");
    return c.json(
      await clearFlag(workspaceId, dependencyId, c.get("userId")),
      200,
    );
  })
  .openapi(readCurrentRoute, async (c) =>
    c.json(
      await getCurrent(
        c.req.valid("param").workspaceId,
        c.get("userId"),
        c.req.valid("query").topic,
        c.req.valid("query").slot,
      ),
      200,
    ),
  )
  .openapi(readUnreviewedRoute, async (c) =>
    c.json(
      await listUnreviewed(
        c.req.valid("param").workspaceId,
        c.get("userId"),
        c.req.valid("query").topic,
      ),
      200,
    ),
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
  .openapi(topicDependentsRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await listDependents(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(listSlotsRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await listSlots(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(createSlotRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(
      await createSlot(workspaceId, id, c.get("userId"), c.req.valid("json")),
      200,
    );
  })
  .openapi(deleteSlotRoute, async (c) => {
    const { workspaceId, id, slotId } = c.req.valid("param");
    return c.json(
      await deleteSlot(workspaceId, id, slotId, c.get("userId")),
      200,
    );
  })
  .openapi(topicTasksRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await listTopicTasks(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(linkTaskRoute, async (c) => {
    const { workspaceId, id, taskId } = c.req.valid("param");
    return c.json(
      await linkTaskTopic(workspaceId, id, taskId, c.get("userId")),
      200,
    );
  })
  .openapi(unlinkTaskRoute, async (c) => {
    const { workspaceId, id, taskId } = c.req.valid("param");
    return c.json(
      await unlinkTaskTopic(workspaceId, id, taskId, c.get("userId")),
      200,
    );
  })
  .openapi(followRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await followTopic(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(unfollowRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await unfollowTopic(workspaceId, id, c.get("userId")), 200);
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
        c.req.valid("json").contentHash,
      ),
      200,
    );
  })
  .openapi(decisionRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(
      await recordDecision(
        workspaceId,
        id,
        c.get("userId"),
        c.req.valid("json"),
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
