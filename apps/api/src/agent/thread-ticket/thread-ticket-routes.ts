import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../../openapi";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { readerOf } from "../cite-messages";
import { proposalSchema } from "../proposals/proposal-schema";
import { proposalView } from "../proposals/proposal-view";
import { proposeDecision } from "../decision/propose-decision";
import { proposeThreadTicket } from "./propose-thread-ticket";

const messageParam = z.object({
  workspaceId: z.string(),
  channelId: z.string(),
  messageId: z.string(),
});

const threadTicketRoute = createRoute({
  method: "post",
  operationId: "proposeTicketFromThread",
  path: "/workspace/{workspaceId}/channels/{channelId}/messages/{messageId}/ticket-proposal",
  tags: ["Agent"],
  summary: "Propose a ticket from a chat thread",
  description:
    "Drafts a ticket from the whole thread the message is in: a title, a description, an assignee among the people the thread mentions, labels, a team and a project. It is a card for you; nothing is created until you accept it, and then the ticket links back to the thread and the thread links to the ticket. Counted as thread tickets in AI usage.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: { params: messageParam },
  responses: {
    200: jsonResponse("The ticket card", proposalSchema),
    403: errorResponse("Missing permission, or AI is off in the channel"),
    404: errorResponse("Agent is disabled, or the message was not found"),
    422: errorResponse("The model suggested no usable ticket"),
    502: errorResponse("The model request failed"),
  },
});

const decisionRoute = createRoute({
  method: "post",
  operationId: "proposeDecisionFromThread",
  path: "/workspace/{workspaceId}/channels/{channelId}/messages/{messageId}/decision-proposal",
  tags: ["Agent"],
  summary: "Propose a decision from a chat thread",
  description:
    "Finds the decision the thread the message is in reached: what was decided, who decided, the reason, the messages it rests on and a topic you can open. It is a card for you; nothing is filed until you accept it, and then the decision is filed as a draft on the topic for its decider to approve. A channel marked no AI refuses it. Counted as decisions in AI usage.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: { params: messageParam },
  responses: {
    200: jsonResponse("The decision card", proposalSchema),
    403: errorResponse("Missing permission, or AI is off in the channel"),
    404: errorResponse("Agent is disabled, or the message was not found"),
    422: errorResponse("The model found no usable decision"),
    502: errorResponse("The model request failed"),
  },
});

const threadTicketRoutes = apiRouter()
  .openapi(threadTicketRoute, async (c) => {
    const { workspaceId, channelId, messageId } = c.req.valid("param");
    const row = await proposeThreadTicket(
      c.get("userId"),
      workspaceId,
      channelId,
      messageId,
    );
    return c.json(await proposalView(await readerOf(c, workspaceId), row), 200);
  })
  .openapi(decisionRoute, async (c) => {
    const { workspaceId, channelId, messageId } = c.req.valid("param");
    const row = await proposeDecision(
      c.get("userId"),
      workspaceId,
      channelId,
      messageId,
    );
    return c.json(await proposalView(await readerOf(c, workspaceId), row), 200);
  });

export default threadTicketRoutes;
