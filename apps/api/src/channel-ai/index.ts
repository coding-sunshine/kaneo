import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { getChannelAi, setChannelAi } from "./channel-ai";

const params = z.object({
  workspaceId: z.string().min(1),
  channelId: z.string().min(1),
});
const channelAiSchema = z
  .object({
    excluded: z.boolean().openapi({
      description: "True when no AI feature reads this channel's messages.",
    }),
  })
  .openapi("ChannelAi");
const path = "/workspace/{workspaceId}/channels/{channelId}";
const tags = ["Chat"];

const getRoute = createRoute({
  method: "get",
  operationId: "getChannelAi",
  path,
  tags,
  summary: "Is the channel marked no AI",
  description:
    "Whether AI features (catch-up, search answers, briefs) skip this channel.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ workspace: ["read"] }),
  ] as const,
  request: { params },
  responses: {
    200: jsonResponse("Mark", channelAiSchema),
    403: errorResponse("Missing permission"),
    404: errorResponse("Channel not found"),
  },
});

const putRoute = createRoute({
  method: "put",
  operationId: "setChannelAi",
  path,
  tags,
  summary: "Mark a channel no AI",
  description:
    "Marks or unmarks the channel so no AI feature reads its messages. Channel members only; not for direct messages or guests.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params,
    body: {
      content: { "application/json": { schema: channelAiSchema } },
      required: true,
    },
  },
  responses: {
    200: jsonResponse("Mark", channelAiSchema),
    403: errorResponse("Not a member, or missing permission"),
    404: errorResponse("Channel not found"),
  },
});

const channelAi = apiRouter()
  .openapi(getRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    return c.json(
      await getChannelAi(workspaceId, channelId, c.get("userId")),
      200,
    );
  })
  .openapi(putRoute, async (c) => {
    const { workspaceId, channelId } = c.req.valid("param");
    const { excluded } = c.req.valid("json");
    return c.json(
      await setChannelAi(workspaceId, channelId, c.get("userId"), excluded),
      200,
    );
  });

export default channelAi;
