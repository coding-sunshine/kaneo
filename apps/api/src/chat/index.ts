import type { z } from "zod";
import { activitySchema } from "../activity/response";
import { imageUploadSchema } from "../task/response";
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
import { addMessageToTicket } from "./controllers/add-message-to-ticket";
import { createChannel } from "./controllers/create-channel";
import { deleteMessage } from "./controllers/delete-message";
import { editMessage } from "./controllers/edit-message";
import { getChannel } from "./controllers/get-channel";
import { getChatFile } from "./controllers/get-chat-file";
import { chatFileWorkspaceAccess } from "./file-access";
import { requireCalls } from "./call/require-calls";
import { inviteMember } from "./controllers/invite-member";
import { joinCall } from "./controllers/join-call";
import { joinChannel } from "./controllers/join-channel";
import { leaveChannel } from "./controllers/leave-channel";
import { listChannels } from "./controllers/list-channels";
import { listDrafts } from "./controllers/list-drafts";
import { listDirectMessages } from "./controllers/list-direct-messages";
import { listMessages } from "./controllers/list-messages";
import { listPins } from "./controllers/list-pins";
import { listReplies } from "./controllers/list-replies";
import { markRead } from "./controllers/mark-read";
import { pinMessage } from "./controllers/pin-message";
import { openDirectMessage } from "./controllers/open-direct-message";
import { postMessage } from "./controllers/post-message";
import { reactToMessage } from "./controllers/react-to-message";
import { removeLinkPreview } from "./controllers/remove-link-preview";
import { removeMember } from "./controllers/remove-member";
import {
  createChatFileUpload,
  finalizeChatFile,
} from "./controllers/send-chat-file";
import { saveDraft } from "./controllers/save-draft";
import { startCall } from "./controllers/start-call";
import { updateChannel } from "./controllers/update-channel";
import { listOnline } from "./presence/list-online";
import {
  getPresenceSetting,
  recordHeartbeat,
  setPresenceSetting,
} from "./presence/set-presence";
import {
  callSessionSchema,
  channelDetailSchema,
  channelListSchema,
  channelMemberParam,
  channelParam,
  channelSchema,
  chatFileParam,
  chatFileUploadBody,
  createChannelBody,
  deletedMessageSchema,
  directMessageListSchema,
  draftListSchema,
  editMessageBody,
  draftSchema,
  finalizeChatFileBody,
  inviteMemberBody,
  leftChannelSchema,
  listMessagesQuery,
  messageListSchema,
  messageParam,
  messageSchema,
  onlineListSchema,
  openDirectMessageBody,
  postMessageBody,
  presenceSettingBody,
  presenceSettingSchema,
  reactionBody,
  removedMemberSchema,
  saveDraftBody,
  ticketCommentBody,
  updateChannelBody,
  workspaceIdParam,
} from "./schema";
import "./call/subscribe";
import "./link-preview/subscribe";
import "./mentions/subscribe";

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
const messagePath = `${channelPath}/messages/{messageId}`;
const messageNotFound = errorResponse("Channel or message not found");
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
  description:
    "The newest 50 messages, oldest first. Pass `before` to page back, or `around` to open the page that holds one message.",
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
  description:
    "Post to a channel you belong to. Give `parentId` to reply in a message's thread instead of the timeline.",
  middleware: [...write] as const,
  request: { params: channelParam, body: body(postMessageBody) },
  responses: {
    200: jsonResponse("Message posted", messageSchema),
    403: notMember,
    404: messageNotFound,
    409: archived,
  },
});

const listRepliesRoute = createRoute({
  method: "get",
  operationId: "listChatReplies",
  path: `${messagePath}/replies`,
  tags,
  summary: "List thread replies",
  description:
    "The replies in a message's thread, oldest first, for whoever can read the channel.",
  middleware: [...access] as const,
  request: { params: messageParam },
  responses: {
    200: jsonResponse("Replies", messageListSchema),
    403: noAccess,
    404: messageNotFound,
  },
});

const fileRefused = errorResponse(
  "The file's name does not end in a type chat can hold",
);

const startFileUploadRoute = createRoute({
  method: "put",
  operationId: "createChatFileUpload",
  path: `${channelPath}/upload`,
  tags,
  summary: "Start a file upload",
  description:
    "Get a presigned URL for sending a file to a channel you belong to. The stored type comes from the file name's extension: PDF, Office and OpenDocument files, plain text, Markdown, CSV and images are accepted. Send the bytes to the URL with the returned headers, then call the finalize route.",
  middleware: [...write] as const,
  request: { params: channelParam, body: body(chatFileUploadBody) },
  responses: {
    200: jsonResponse("The presigned upload", imageUploadSchema),
    400: errorResponse("The file is empty or too large"),
    403: notMember,
    404: notFound,
    409: archived,
    415: fileRefused,
    503: errorResponse("File uploads are not configured on this instance"),
  },
});

const finalizeFileUploadRoute = createRoute({
  method: "post",
  operationId: "finalizeChatFileUpload",
  path: `${channelPath}/upload/finalize`,
  tags,
  summary: "Send an uploaded file",
  description:
    "Post an uploaded file to the channel as a message, with optional text, or add it to a message you sent there by giving its id. The file opens for whoever can read the channel, and for nobody else; it goes when the message is deleted.",
  middleware: [...write] as const,
  request: { params: channelParam, body: body(finalizeChatFileBody) },
  responses: {
    200: jsonResponse("Message posted", messageSchema),
    400: errorResponse(
      "The key does not belong to this channel, the stored object does not match the name and size, or text came with a file added to a sent message",
    ),
    403: errorResponse(
      "Not a channel member, or the message to add to is someone else's",
    ),
    404: errorResponse("Channel or message not found"),
    409: archived,
    415: fileRefused,
    503: errorResponse("The stored object could not be checked"),
  },
});

const getFileRoute = createRoute({
  method: "get",
  operationId: "getChatFile",
  path: `${channelPath}/files/{fileId}`,
  tags,
  summary: "Download a file",
  description:
    "Download a file sent in a channel you can read. Image types are served inline, everything else as an attachment. A channel you cannot read, one that does not exist, or a workspace you are not in answers 403.",
  middleware: [
    chatFileWorkspaceAccess,
    requireWorkspacePermission({ workspace: ["read"] }),
  ] as const,
  request: { params: chatFileParam },
  responses: {
    200: {
      description: "The file's bytes",
      content: { "*/*": { schema: { type: "string", format: "binary" } } },
    },
    403: errorResponse("You cannot read this channel, or it does not exist"),
    404: errorResponse("File not found in this channel"),
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
  request: { params: messageParam, body: body(editMessageBody) },
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

const ticketCommentRoute = createRoute({
  method: "post",
  operationId: "addChatMessageToTicket",
  path: `${messagePath}/ticket-comment`,
  tags,
  summary: "Add message to ticket",
  description:
    "Copy a message you can read onto a ticket as your comment, with a link back to the message. The ticket's activity records it.",
  middleware: [...write] as const,
  request: { params: messageParam, body: body(ticketCommentBody) },
  responses: {
    200: jsonResponse("The comment", activitySchema),
    403: noAccess,
    404: errorResponse("Channel, message or ticket not found"),
  },
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

const listDraftsRoute = createRoute({
  method: "get",
  operationId: "listChatDrafts",
  path: "/workspace/{workspaceId}/drafts",
  tags,
  summary: "List your drafts",
  description:
    "Your unsent message drafts in this workspace, newest first. Drafts are private: nobody else can read them.",
  middleware: [...access] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Drafts", draftListSchema),
    403: noAccess,
  },
});

const saveDraftRoute = createRoute({
  method: "put",
  operationId: "saveChatDraft",
  path: `${channelPath}/draft`,
  tags,
  summary: "Save draft",
  description:
    "Keep your unsent text for a channel you can post in. An empty body deletes the draft; posting a message deletes it too.",
  middleware: [...write] as const,
  request: { params: channelParam, body: body(saveDraftBody) },
  responses: {
    200: jsonResponse("Draft saved", draftSchema),
    403: notMember,
    404: notFound,
    409: archived,
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

const removePreviewRoute = createRoute({
  method: "delete",
  operationId: "removeChatLinkPreview",
  path: `${messagePath}/preview`,
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
  .openapi(listDraftsRoute, async (c) =>
    c.json(
      await listDrafts(c.req.valid("param").workspaceId, c.get("userId")),
      200,
    ),
  )
  .openapi(saveDraftRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    return c.json(
      await saveDraft(
        workspaceId,
        channelId,
        c.get("userId"),
        c.req.valid("json").body,
      ),
      200,
    );
  })
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
        c.req.valid("query"),
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
        c.req.valid("json").parentId,
      ),
      200,
    );
  })
  .openapi(listRepliesRoute, async (c) => {
    const { workspaceId, channelId, messageId } = c.req.valid("param");
    return c.json(
      await listReplies(workspaceId, channelId, messageId, c.get("userId")),
      200,
    );
  })
  .openapi(startFileUploadRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    return c.json(
      await createChatFileUpload(
        workspaceId,
        channelId,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    );
  })
  .openapi(finalizeFileUploadRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    return c.json(
      await finalizeChatFile(
        workspaceId,
        channelId,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    );
  })
  .openapi(getFileRoute, async (c) => {
    const { workspaceId, channelId, fileId } = c.req.valid("param");
    return getChatFile(workspaceId, channelId, fileId, c.get("userId"));
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
  .openapi(ticketCommentRoute, async (c) => {
    const { workspaceId, channelId, messageId } = c.req.valid("param");
    return c.json(
      await addMessageToTicket(
        workspaceId,
        channelId,
        messageId,
        c.get("userId"),
        c.req.valid("json").taskId,
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
