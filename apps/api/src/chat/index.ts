import type { z } from "zod";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { createChannel } from "./controllers/create-channel";
import { deleteMessage } from "./controllers/delete-message";
import { editMessage } from "./controllers/edit-message";
import { getChannel } from "./controllers/get-channel";
import { inviteMember } from "./controllers/invite-member";
import { joinChannel } from "./controllers/join-channel";
import { leaveChannel } from "./controllers/leave-channel";
import { listChannels } from "./controllers/list-channels";
import { listMessages } from "./controllers/list-messages";
import { listPins } from "./controllers/list-pins";
import { markRead } from "./controllers/mark-read";
import { pinMessage } from "./controllers/pin-message";
import { postMessage } from "./controllers/post-message";
import { reactToMessage } from "./controllers/react-to-message";
import { updateChannel } from "./controllers/update-channel";
import { listOnline } from "./presence/list-online";
import {
  getPresenceSetting,
  recordHeartbeat,
  setPresenceSetting,
} from "./presence/set-presence";
import {
  channelDetailSchema,
  channelListSchema,
  channelParam,
  channelSchema,
  createChannelBody,
  deletedMessageSchema,
  inviteMemberBody,
  leftChannelSchema,
  listMessagesQuery,
  messageListSchema,
  messageParam,
  messageSchema,
  onlineListSchema,
  postMessageBody,
  presenceSettingBody,
  presenceSettingSchema,
  reactionBody,
  updateChannelBody,
  workspaceIdParam,
} from "./schema";

const body = <T extends z.ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const tags = ["Chat"];
const noAccess = errorResponse("Missing permission for this workspace");
const notFound = errorResponse("Channel not found");
const notMember = errorResponse("Join the channel first");
const archived = errorResponse("Channel is archived");
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
const messagePath = `${channelPath}/messages/{messageId}`;
const messageNotFound = errorResponse("Channel or message not found");

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
    403: notMember,
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
    403: noAccess,
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
    403: noAccess,
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
    403: notMember,
    404: errorResponse("Channel or member not found"),
    409: archived,
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

const editMessageRoute = createRoute({
  method: "patch",
  operationId: "editChatMessage",
  path: messagePath,
  tags,
  summary: "Edit message",
  description: "Change the text of your own message. It then shows as edited.",
  middleware: [...write] as const,
  request: { params: messageParam, body: body(postMessageBody) },
  responses: {
    200: jsonResponse("Message edited", messageSchema),
    403: errorResponse("Only the author can change this message"),
    404: messageNotFound,
    409: archived,
  },
});

const deleteMessageRoute = createRoute({
  method: "delete",
  operationId: "deleteChatMessage",
  path: messagePath,
  tags,
  summary: "Delete message",
  description: "Delete your own message for everyone.",
  middleware: [...write] as const,
  request: { params: messageParam },
  responses: {
    200: jsonResponse("Message deleted", deletedMessageSchema),
    403: errorResponse("Only the author can change this message"),
    404: messageNotFound,
    409: archived,
  },
});

const pinResponses = {
  200: jsonResponse("Message", messageSchema),
  403: notMember,
  404: messageNotFound,
  409: archived,
};

const pinRoute = createRoute({
  method: "post",
  operationId: "pinChatMessage",
  path: `${messagePath}/pin`,
  tags,
  summary: "Pin message",
  description: "Pin a message to its channel. Any channel member may pin.",
  middleware: [...write] as const,
  request: { params: messageParam },
  responses: pinResponses,
});

const unpinRoute = createRoute({
  method: "delete",
  operationId: "unpinChatMessage",
  path: `${messagePath}/pin`,
  tags,
  summary: "Unpin message",
  description: "Remove a message from the channel's pinned list.",
  middleware: [...write] as const,
  request: { params: messageParam },
  responses: pinResponses,
});

const reactionResponses = {
  200: jsonResponse("Message", messageSchema),
  400: errorResponse("Unknown custom emoji"),
  403: notMember,
  404: messageNotFound,
  409: archived,
};

const addReactionRoute = createRoute({
  method: "post",
  operationId: "addChatMessageReaction",
  path: `${messagePath}/reactions`,
  tags,
  summary: "Add reaction",
  description:
    "Add your emoji reaction to a message. Adding one you already have is a no-op.",
  middleware: [...write] as const,
  request: { params: messageParam, body: body(reactionBody) },
  responses: reactionResponses,
});

const removeReactionRoute = createRoute({
  method: "delete",
  operationId: "removeChatMessageReaction",
  path: `${messagePath}/reactions`,
  tags,
  summary: "Remove reaction",
  description: "Remove your emoji reaction from a message.",
  middleware: [...write] as const,
  request: { params: messageParam, body: body(reactionBody) },
  responses: reactionResponses,
});

const markReadRoute = createRoute({
  method: "post",
  operationId: "markChatChannelRead",
  path: `${channelPath}/read`,
  tags,
  summary: "Mark channel read",
  description:
    "Clear your unread count for the channel. Only you can see when you read it.",
  middleware: [...access] as const,
  request: { params: channelParam },
  responses: {
    200: jsonResponse("Marked read", leftChannelSchema),
    403: noAccess,
    404: notFound,
  },
});

const listPinsRoute = createRoute({
  method: "get",
  operationId: "listChatPins",
  path: `${channelPath}/pins`,
  tags,
  summary: "List pinned messages",
  description: "Every pinned message of the channel, newest pin first.",
  middleware: [...access] as const,
  request: { params: channelParam },
  responses: {
    200: jsonResponse("Pinned messages", messageListSchema),
    403: noAccess,
    404: notFound,
  },
});

const getPresenceRoute = createRoute({
  method: "get",
  operationId: "getChatPresenceSetting",
  path: "/presence",
  tags,
  summary: "Get presence setting",
  description: "Whether you show others when you are online. Off by default.",
  responses: { 200: jsonResponse("Presence setting", presenceSettingSchema) },
});

const setPresenceRoute = createRoute({
  method: "put",
  operationId: "setChatPresenceSetting",
  path: "/presence",
  tags,
  summary: "Set presence setting",
  description:
    "Turn your online presence on or off. Off removes it for everyone at once.",
  request: { body: body(presenceSettingBody) },
  responses: { 200: jsonResponse("Presence setting", presenceSettingSchema) },
});

const heartbeatRoute = createRoute({
  method: "post",
  operationId: "chatPresenceHeartbeat",
  path: "/presence/heartbeat",
  tags,
  summary: "Send presence heartbeat",
  description:
    "Mark yourself online for the next 90 seconds. Does nothing while presence is off.",
  responses: { 200: jsonResponse("Presence setting", presenceSettingSchema) },
});

const onlineRoute = createRoute({
  method: "get",
  operationId: "listChatOnline",
  path: "/workspace/{workspaceId}/presence",
  tags,
  summary: "List online members",
  description:
    "Members of the workspace who turned presence on and are online. Empty unless your own presence is on.",
  middleware: [...access] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Online members", onlineListSchema),
    403: noAccess,
  },
});

const chat = apiRouter()
  .openapi(getPresenceRoute, async (c) =>
    c.json(await getPresenceSetting(c.get("userId")), 200),
  )
  .openapi(setPresenceRoute, async (c) =>
    c.json(
      await setPresenceSetting(c.get("userId"), c.req.valid("json").enabled),
      200,
    ),
  )
  .openapi(heartbeatRoute, async (c) =>
    c.json(await recordHeartbeat(c.get("userId")), 200),
  )
  .openapi(onlineRoute, async (c) =>
    c.json(
      await listOnline(c.req.valid("param").workspaceId, c.get("userId")),
      200,
    ),
  )
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
      ),
      200,
    );
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
  .openapi(editMessageRoute, async (c) => {
    const { workspaceId, channelId, messageId } = c.req.valid("param");
    return c.json(
      await editMessage(
        workspaceId,
        channelId,
        messageId,
        c.get("userId"),
        c.req.valid("json").body,
      ),
      200,
    );
  })
  .openapi(deleteMessageRoute, async (c) => {
    const { workspaceId, channelId, messageId } = c.req.valid("param");
    return c.json(
      await deleteMessage(workspaceId, channelId, messageId, c.get("userId")),
      200,
    );
  })
  .openapi(pinRoute, async (c) => {
    const { workspaceId, channelId, messageId } = c.req.valid("param");
    return c.json(
      await pinMessage(
        workspaceId,
        channelId,
        messageId,
        c.get("userId"),
        true,
      ),
      200,
    );
  })
  .openapi(unpinRoute, async (c) => {
    const { workspaceId, channelId, messageId } = c.req.valid("param");
    return c.json(
      await pinMessage(
        workspaceId,
        channelId,
        messageId,
        c.get("userId"),
        false,
      ),
      200,
    );
  })
  .openapi(addReactionRoute, async (c) => {
    const { workspaceId, channelId, messageId } = c.req.valid("param");
    return c.json(
      await reactToMessage(
        workspaceId,
        channelId,
        messageId,
        c.get("userId"),
        c.req.valid("json").emoji,
        true,
      ),
      200,
    );
  })
  .openapi(removeReactionRoute, async (c) => {
    const { workspaceId, channelId, messageId } = c.req.valid("param");
    return c.json(
      await reactToMessage(
        workspaceId,
        channelId,
        messageId,
        c.get("userId"),
        c.req.valid("json").emoji,
        false,
      ),
      200,
    );
  })
  .openapi(markReadRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    return c.json(await markRead(workspaceId, channelId, c.get("userId")), 200);
  })
  .openapi(listPinsRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    return c.json(await listPins(workspaceId, channelId, c.get("userId")), 200);
  });

export default chat;
