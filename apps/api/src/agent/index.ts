import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
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
  );

export default routes;
