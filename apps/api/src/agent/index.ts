import { HTTPException } from "hono/http-exception";
import { streamSSE } from "hono/streaming";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { deleteChat, getChat, listChats, sendMessage } from "./controllers";
import { isAgentEnabled } from "./openrouter";
import {
  chatDetailSchema,
  chatParam,
  chatSummaryListSchema,
  deletedChatSchema,
  sendMessageBody,
  sentMessageSchema,
  workspaceParam,
} from "./schema";

const noAccess = errorResponse("Missing permission for this workspace");
const notFound = errorResponse("Agent is disabled or chat not found");
const tags = ["Agent"];
// The agent acts through the caller's own permissions, so read access is enough
// to talk to it; every tool call is authorised again by the API.
const read = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ project: ["read"] }),
] as const;

const listRoute = createRoute({
  method: "get",
  operationId: "listAgentChats",
  path: "/workspace/{workspaceId}/chats",
  tags,
  summary: "List agent chats",
  description: "List your agent chats in a workspace, most recent first.",
  middleware: [...read] as const,
  request: { params: workspaceParam },
  responses: {
    200: jsonResponse("Chats", chatSummaryListSchema),
    403: noAccess,
    404: notFound,
  },
});

const getRoute = createRoute({
  method: "get",
  operationId: "getAgentChat",
  path: "/workspace/{workspaceId}/chats/{chatId}",
  tags,
  summary: "Get agent chat",
  description: "Get the transcript of one of your agent chats.",
  middleware: [...read] as const,
  request: { params: chatParam },
  responses: {
    200: jsonResponse("Chat", chatDetailSchema),
    403: noAccess,
    404: notFound,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  operationId: "deleteAgentChat",
  path: "/workspace/{workspaceId}/chats/{chatId}",
  tags,
  summary: "Delete agent chat",
  description: "Delete one of your agent chats.",
  middleware: [...read] as const,
  request: { params: chatParam },
  responses: {
    200: jsonResponse("Chat deleted", deletedChatSchema),
    403: noAccess,
    404: notFound,
  },
});

const sendRoute = createRoute({
  method: "post",
  operationId: "sendAgentMessage",
  path: "/workspace/{workspaceId}/messages",
  tags,
  summary: "Send a message to the agent",
  description:
    "Send a message and wait for the agent to finish. The agent calls Kaneo tools with your own permissions and returns the full transcript of this turn.",
  middleware: [...read] as const,
  request: {
    params: workspaceParam,
    body: {
      required: true as const,
      content: { "application/json": { schema: sendMessageBody } },
    },
  },
  responses: {
    200: jsonResponse("Agent reply", sentMessageSchema),
    403: noAccess,
    404: notFound,
    502: errorResponse("The model request failed"),
  },
});

const streamRoute = createRoute({
  method: "post",
  operationId: "streamAgentMessage",
  path: "/workspace/{workspaceId}/messages/stream",
  tags,
  summary: "Send a message and stream the reply",
  description:
    "Same as sending a message, but answers as server-sent events: `chat` (chat id and title), `delta` (reply text as it is written), `message` (each finished message, tool calls and results included), then `done`, or `error`.",
  middleware: [...read] as const,
  request: {
    params: workspaceParam,
    body: {
      required: true as const,
      content: { "application/json": { schema: sendMessageBody } },
    },
  },
  responses: {
    200: {
      description: "Server-sent event stream",
      content: { "text/event-stream": { schema: z.string() } },
    },
    403: noAccess,
    404: notFound,
  },
});

const agent = apiRouter();
agent.use("*", async (_c, next) => {
  if (!isAgentEnabled()) {
    throw new HTTPException(404, { message: "Not found" });
  }
  await next();
});

const routes = agent
  .openapi(listRoute, async (c) =>
    c.json(
      await listChats(c.get("userId"), c.req.valid("param").workspaceId),
      200,
    ),
  )
  .openapi(getRoute, async (c) => {
    const { workspaceId, chatId } = c.req.valid("param");
    return c.json(await getChat(c.get("userId"), workspaceId, chatId), 200);
  })
  .openapi(deleteRoute, async (c) => {
    const { workspaceId, chatId } = c.req.valid("param");
    return c.json(await deleteChat(c.get("userId"), workspaceId, chatId), 200);
  })
  .openapi(sendRoute, async (c) =>
    c.json(
      await sendMessage(
        c.get("userId"),
        c.req.valid("param").workspaceId,
        c.req.raw.headers,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(streamRoute, (c) => {
    const { workspaceId } = c.req.valid("param");
    const body = c.req.valid("json");
    const userId = c.get("userId");
    const headers = c.req.raw.headers;
    return streamSSE(c, async (stream) => {
      const send = (event: object) =>
        stream.writeSSE({ data: JSON.stringify(event) });
      try {
        await sendMessage(userId, workspaceId, headers, body, (event) => {
          void send(event);
        });
        await send({ type: "done" });
      } catch (error) {
        await send({
          type: "error",
          message: error instanceof Error ? error.message : "The agent failed",
        });
      }
    }) as never;
  });

export default routes;
