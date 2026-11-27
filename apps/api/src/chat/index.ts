import type { z } from "zod";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { createChannel } from "./controllers/create-channel";
import { getChannel } from "./controllers/get-channel";
import { requireCalls } from "./call/require-calls";
import { inviteMember } from "./controllers/invite-member";
import { joinCall } from "./controllers/join-call";
import { joinChannel } from "./controllers/join-channel";
import { leaveChannel } from "./controllers/leave-channel";
import { listChannels } from "./controllers/list-channels";
import { listDirectMessages } from "./controllers/list-direct-messages";
import { listMessages } from "./controllers/list-messages";
import { openDirectMessage } from "./controllers/open-direct-message";
import { postMessage } from "./controllers/post-message";
import { removeLinkPreview } from "./controllers/remove-link-preview";
import { removeMember } from "./controllers/remove-member";
import { startCall } from "./controllers/start-call";
import { updateChannel } from "./controllers/update-channel";
import {
  callSessionSchema,
  channelDetailSchema,
  channelListSchema,
  channelMemberParam,
  channelParam,
  channelSchema,
  createChannelBody,
  directMessageListSchema,
  inviteMemberBody,
  leftChannelSchema,
  listMessagesQuery,
  messageListSchema,
  messageParam,
  messageSchema,
  openDirectMessageBody,
  postMessageBody,
  removedMemberSchema,
  updateChannelBody,
  workspaceIdParam,
} from "./schema";
import "./call/subscribe";
import "./link-preview/subscribe";

const body = <T extends z.ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const tags = ["Chat"];
const noAccess = errorResponse("Missing permission for this workspace");
const notFound = errorResponse("Channel not found");
const notMember = errorResponse("Join the channel first");
const archived = errorResponse("Channel is archived");
const fixed = errorResponse(
  "Not a channel member, or a direct message, whose members are fixed",
);
// Channel rules (private, member-only, archived) live in channel-access.ts.
const access = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ workspace: ["read"] }),
] as const;
// Writing to chat is changing workspace content, so read-only viewers can
// read channels but not create, join or post.
const write = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ task: ["update"] }),
] as const;
const channelPath = "/workspace/{workspaceId}/channels/{channelId}";
// Who manages the workspace's people: adds guests to channels, removes anyone.
const manageMembers = { member: ["update"] };
const directPath = "/workspace/{workspaceId}/direct-messages";

const listRoute = createRoute({
  method: "get",
  operationId: "listChatChannels",
  path: "/workspace/{workspaceId}/channels",
  tags,
  summary: "List channels",
  description:
    "Every public channel in the workspace plus the private channels you belong to.",
  middleware: [...access] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Channels", channelListSchema),
    403: noAccess,
  },
});

const createChannelRoute = createRoute({
  method: "post",
  operationId: "createChatChannel",
  path: "/workspace/{workspaceId}/channels",
  tags,
  summary: "Create channel",
  description: "Create a public or private channel. You join it.",
  middleware: [...write] as const,
  request: { params: workspaceIdParam, body: body(createChannelBody) },
  responses: {
    200: jsonResponse("Channel created", channelSchema),
    403: noAccess,
  },
});

const getRoute = createRoute({
  method: "get",
  operationId: "getChatChannel",
  path: channelPath,
  tags,
  summary: "Get channel",
  description: "Get a channel and its member ids.",
  middleware: [...access] as const,
  request: { params: channelParam },
  responses: {
    200: jsonResponse("Channel", channelDetailSchema),
    403: noAccess,
    404: notFound,
  },
});

const updateRoute = createRoute({
  method: "patch",
  operationId: "updateChatChannel",
  path: channelPath,
  tags,
  summary: "Update channel",
  description: "Rename, set the topic, or archive and unarchive. Members only.",
  middleware: [...write] as const,
  request: { params: channelParam, body: body(updateChannelBody) },
  responses: {
    200: jsonResponse("Channel updated", channelDetailSchema),
    403: fixed,
    404: notFound,
  },
});

const joinRoute = createRoute({
  method: "post",
  operationId: "joinChatChannel",
  path: `${channelPath}/join`,
  tags,
  summary: "Join channel",
  description: "Join a public channel.",
  middleware: [...write] as const,
  request: { params: channelParam },
  responses: {
    200: jsonResponse("Joined", channelDetailSchema),
    403: errorResponse(
      "Missing permission for this workspace, or a direct message, whose members are fixed",
    ),
    404: notFound,
    409: archived,
  },
});

const leaveRoute = createRoute({
  method: "post",
  operationId: "leaveChatChannel",
  path: `${channelPath}/leave`,
  tags,
  summary: "Leave channel",
  description:
    "Leave a channel. A private channel then disappears for you; its last member cannot leave.",
  middleware: [...write] as const,
  request: { params: channelParam },
  responses: {
    200: jsonResponse("Left", leftChannelSchema),
    403: errorResponse(
      "Missing permission for this workspace, or a direct message, whose members are fixed",
    ),
    404: notFound,
    409: errorResponse("The last member cannot leave a private channel"),
  },
});

const inviteRoute = createRoute({
  method: "post",
  operationId: "inviteChatChannelMember",
  path: `${channelPath}/members`,
  tags,
  summary: "Add member",
  description: "Add a workspace member to a channel you belong to.",
  middleware: [...write] as const,
  request: { params: channelParam, body: body(inviteMemberBody) },
  responses: {
    200: jsonResponse("Member added", channelDetailSchema),
    403: fixed,
    404: errorResponse("Channel or member not found"),
    409: archived,
  },
});

const removeMemberRoute = createRoute({
  method: "delete",
  operationId: "removeChatChannelMember",
  path: `${channelPath}/members/{userId}`,
  tags,
  summary: "Remove member",
  description:
    "Take a member out of a channel. They lose it with their next request. Workspace admins only.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission(manageMembers),
  ] as const,
  request: { params: channelMemberParam },
  responses: {
    200: jsonResponse("Member removed", removedMemberSchema),
    403: noAccess,
    404: errorResponse("Channel or member not found"),
    409: errorResponse("The last member cannot leave a private channel"),
  },
});

const listDirectRoute = createRoute({
  method: "get",
  operationId: "listChatDirectMessages",
  path: directPath,
  tags,
  summary: "List direct messages",
  description:
    "Your direct messages and group direct messages, newest first. Read and post through the channel routes.",
  middleware: [...access] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Direct messages", directMessageListSchema),
    403: noAccess,
  },
});

const openDirectRoute = createRoute({
  method: "post",
  operationId: "openChatDirectMessage",
  path: directPath,
  tags,
  summary: "Open direct message",
  description:
    "Open the direct message with these workspace members, creating it the first time. The same people always get the same conversation.",
  middleware: [...write] as const,
  request: { params: workspaceIdParam, body: body(openDirectMessageBody) },
  responses: {
    200: jsonResponse("Direct message", channelDetailSchema),
    400: errorResponse("No member other than yourself"),
    403: noAccess,
    404: errorResponse("Member not found"),
  },
});

const listMessagesRoute = createRoute({
  method: "get",
  operationId: "listChatMessages",
  path: `${channelPath}/messages`,
  tags,
  summary: "List messages",
  description: "The newest 50 messages, oldest first.",
  middleware: [...access] as const,
  request: { params: channelParam, query: listMessagesQuery },
  responses: {
    200: jsonResponse("Messages", messageListSchema),
    403: noAccess,
    404: notFound,
  },
});

const postMessageRoute = createRoute({
  method: "post",
  operationId: "postChatMessage",
  path: `${channelPath}/messages`,
  tags,
  summary: "Post message",
  description: "Post to a channel you belong to.",
  middleware: [...write] as const,
  request: { params: channelParam, body: body(postMessageBody) },
  responses: {
    200: jsonResponse("Message posted", messageSchema),
    403: notMember,
    404: notFound,
    409: archived,
  },
});

const removePreviewRoute = createRoute({
  method: "delete",
  operationId: "removeChatLinkPreview",
  path: `${channelPath}/messages/{messageId}/preview`,
  tags,
  summary: "Remove link preview",
  description: "Remove the link preview from your own message.",
  middleware: [...write] as const,
  request: { params: messageParam },
  responses: {
    200: jsonResponse("Preview removed", messageSchema),
    403: errorResponse("Only the author can remove the preview"),
    404: errorResponse("Channel or message not found"),
  },
});

const callsOff = errorResponse(
  "Calls are off on this server, or channel not found",
);

const startCallRoute = createRoute({
  method: "post",
  operationId: "startChatCall",
  path: `${channelPath}/call`,
  tags,
  summary: "Start call",
  description:
    "Start a voice or video call in a channel or direct message you belong to. Rings the other members, at most 10 starts a minute per person. Needs LiveKit configured on the server.",
  middleware: [requireCalls, ...write] as const,
  request: { params: channelParam },
  responses: {
    200: jsonResponse("Call started", callSessionSchema),
    403: notMember,
    404: callsOff,
    409: archived,
    429: errorResponse("Too many calls started; see the Retry-After header"),
  },
});

const joinCallRoute = createRoute({
  method: "post",
  operationId: "joinChatCall",
  path: `${channelPath}/call/join`,
  tags,
  summary: "Join call",
  description: "Join the call in a channel you belong to.",
  middleware: [requireCalls, ...write] as const,
  request: { params: channelParam },
  responses: {
    200: jsonResponse("Call session", callSessionSchema),
    403: notMember,
    404: callsOff,
    409: archived,
  },
});

const chat = apiRouter()
  .openapi(listRoute, async (c) =>
    c.json(
      await listChannels(c.req.valid("param").workspaceId, c.get("userId")),
      200,
    ),
  )
  .openapi(createChannelRoute, async (c) =>
    c.json(
      await createChannel(
        c.req.valid("param").workspaceId,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(listDirectRoute, async (c) =>
    c.json(
      await listDirectMessages(
        c.req.valid("param").workspaceId,
        c.get("userId"),
      ),
      200,
    ),
  )
  .openapi(openDirectRoute, async (c) =>
    c.json(
      await openDirectMessage(
        c.req.valid("param").workspaceId,
        c.get("userId"),
        c.req.valid("json").userIds,
      ),
      200,
    ),
  )
  .openapi(getRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    return c.json(
      await getChannel(workspaceId, channelId, c.get("userId")),
      200,
    );
  })
  .openapi(updateRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    return c.json(
      await updateChannel(
        workspaceId,
        channelId,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    );
  })
  .openapi(joinRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    return c.json(
      await joinChannel(workspaceId, channelId, c.get("userId")),
      200,
    );
  })
  .openapi(leaveRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    return c.json(
      await leaveChannel(workspaceId, channelId, c.get("userId")),
      200,
    );
  })
  .openapi(inviteRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    return c.json(
      await inviteMember(
        workspaceId,
        channelId,
        c.get("userId"),
        c.req.valid("json").userId,
        await hasWorkspacePermission(c, manageMembers),
      ),
      200,
    );
  })
  .openapi(removeMemberRoute, async (c) => {
    const { workspaceId, channelId, userId } = c.req.valid("param");
    return c.json(await removeMember(workspaceId, channelId, userId), 200);
  })
  .openapi(listMessagesRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    return c.json(
      await listMessages(
        workspaceId,
        channelId,
        c.get("userId"),
        c.req.valid("query").before,
      ),
      200,
    );
  })
  .openapi(postMessageRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    return c.json(
      await postMessage(
        workspaceId,
        channelId,
        c.get("userId"),
        c.req.valid("json").body,
      ),
      200,
    );
  })
  .openapi(startCallRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    return c.json(
      await startCall(workspaceId, channelId, c.get("userId")),
      200,
    );
  })
  .openapi(joinCallRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    return c.json(await joinCall(workspaceId, channelId, c.get("userId")), 200);
  })
  .openapi(removePreviewRoute, async (c) => {
    const { workspaceId, channelId, messageId } = c.req.valid("param");
    return c.json(
      await removeLinkPreview(
        workspaceId,
        channelId,
        messageId,
        c.get("userId"),
      ),
      200,
    );
  });

export default chat;
