import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../../openapi";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { messageListSchema, messageParam, workspaceIdParam } from "../schema";
import { listSaved } from "./list-saved";
import { remindMessage } from "./remind-message";
import {
  messageReminderSchema,
  remindMessageBody,
  saveMessageBody,
  savedMessageSchema,
} from "./schema";
import { setSaved } from "./set-saved";

const tags = ["Chat"];
const access = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ workspace: ["read"] }),
] as const;
const noAccess = errorResponse("Missing permission for this workspace");
const noWorkspace = errorResponse("Workspace not found");
const messageNotFound = errorResponse("Channel or message not found");
const messagePath =
  "/workspace/{workspaceId}/channels/{channelId}/messages/{messageId}";
const body = <T extends z.ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});

const remindRoute = createRoute({
  method: "post",
  operationId: "remindChatMessage",
  path: `${messagePath}/reminder`,
  tags,
  summary: "Remind me about a message",
  description:
    "At the time you pick, the message reaches your Inbox with a link to it, as long as you can still read its channel. Only you are told. Counts toward your waiting reminders.",
  middleware: [...access] as const,
  request: { params: messageParam, body: body(remindMessageBody) },
  responses: {
    200: jsonResponse("Reminder set", messageReminderSchema),
    400: errorResponse("The time is in the past or over a year ahead"),
    403: noAccess,
    404: messageNotFound,
    409: errorResponse("Too many reminders waiting"),
  },
});

const saveRoute = createRoute({
  method: "put",
  operationId: "saveChatMessage",
  path: `${messagePath}/saved`,
  tags,
  summary: "Save message",
  description:
    "Add a message you can read to your saved list, or remove it. The message itself stays in its channel. Only you can see your saved list.",
  middleware: [...access] as const,
  request: { params: messageParam, body: body(saveMessageBody) },
  responses: {
    200: jsonResponse("Saved state", savedMessageSchema),
    403: noAccess,
    404: messageNotFound,
  },
});

const listSavedRoute = createRoute({
  method: "get",
  operationId: "listSavedChatMessages",
  path: "/workspace/{workspaceId}/saved-messages",
  tags,
  summary: "List your saved messages",
  description:
    "Messages you saved in this workspace, newest save first. A message in a channel you can no longer read is left out. Nobody else can read your list.",
  middleware: [...access] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Saved messages", messageListSchema),
    403: noAccess,
    404: noWorkspace,
  },
});

const laterRoutes = apiRouter()
  .openapi(remindRoute, async (c) => {
    const { workspaceId, channelId, messageId } = c.req.valid("param");
    return c.json(
      await remindMessage(
        workspaceId,
        channelId,
        messageId,
        c.get("userId"),
        new Date(c.req.valid("json").remindAt),
      ),
      200,
    );
  })
  .openapi(saveRoute, async (c) => {
    const { workspaceId, channelId, messageId } = c.req.valid("param");
    return c.json(
      await setSaved(
        workspaceId,
        channelId,
        messageId,
        c.get("userId"),
        c.req.valid("json").saved,
      ),
      200,
    );
  })
  .openapi(listSavedRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(await listSaved(workspaceId, c.get("userId")), 200);
  });

export default laterRoutes;
