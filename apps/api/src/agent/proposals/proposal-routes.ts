import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../../openapi";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { readerOf } from "../cite-messages";
import { workspaceParam } from "../schema";
import { acceptProposal, declineProposal } from "./decide-proposal";
import { listAudit } from "./list-audit";
import {
  acceptQuery,
  auditListSchema,
  proposalParam,
  proposalSchema,
  taskProposalsParam,
} from "./proposal-schema";
import { z } from "../../openapi";
import { pendingDrafts, proposalView, taskProposals } from "./proposal-view";

const tags = ["Agent"];
const noAccess = errorResponse("Missing permission for this workspace");
const notFound = errorResponse("Agent is disabled or proposal not found");
// Deciding needs only read access: accepting runs the write with the
// person's own credentials, and the API checks it like any other request.
const read = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ project: ["read"] }),
] as const;
// The audit shows every member's accepted writes, so only admins see it.
const admin = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
] as const;

const decideRoute = <D extends "accept" | "decline">(decision: D) =>
  createRoute({
    method: "post",
    operationId:
      decision === "accept" ? "acceptAgentProposal" : "declineAgentProposal",
    path: `/workspace/{workspaceId}/proposals/{proposalId}/${decision}`,
    tags,
    summary:
      decision === "accept"
        ? "Accept an agent proposal"
        : "Decline an agent proposal",
    description:
      decision === "accept"
        ? "Apply one of your agent's proposed writes with your own permissions. A write the API refuses leaves the proposal `failed`, with the error as its result."
        : "Decline one of your agent's proposed writes. Nothing changes.",
    middleware: [...read] as const,
    request: { params: proposalParam },
    responses: {
      200: jsonResponse("The decided proposal", proposalSchema),
      403: noAccess,
      404: notFound,
      409: errorResponse("The proposal was already decided"),
    },
  });

const auditRoute = createRoute({
  method: "get",
  operationId: "getAiAudit",
  path: "/workspace/{workspaceId}/audit",
  tags,
  summary: "Get the AI audit",
  description:
    "The agent writes people accepted in this workspace, and admins' changes of the AI data destination, newest first, with the prompt, the tool call, sources, the accepting person and the result. A write is left out unless you can open its team and, for a move, the team it goes to. Admins and owners only.",
  middleware: [...admin] as const,
  request: { params: workspaceParam },
  responses: {
    200: jsonResponse("AI audit", auditListSchema),
    403: noAccess,
    404: notFound,
  },
});

const draftsRoute = createRoute({
  method: "get",
  operationId: "listAgentDrafts",
  path: "/workspace/{workspaceId}/proposals/drafts",
  tags,
  summary: "List your drafted project updates",
  description:
    "Project updates your loops drafted that you have not accepted or declined yet, newest first. Accepting one posts it as you.",
  middleware: [...read] as const,
  request: { params: workspaceParam },
  responses: {
    200: jsonResponse("Drafts", z.array(proposalSchema)),
    403: noAccess,
    404: notFound,
  },
});

const acceptRoute = createRoute({
  ...decideRoute("accept"),
  request: {
    params: proposalParam,
    query: acceptQuery,
  },
  responses: {
    ...decideRoute("accept").responses,
    400: errorResponse("No field was kept"),
  },
});

const taskRoute = createRoute({
  method: "get",
  operationId: "listTaskProposals",
  path: "/workspace/{workspaceId}/tasks/{taskId}/proposals",
  tags,
  summary: "List your proposals about a ticket",
  description:
    "The proposals made for you about one ticket, such as an AI triage suggestion, newest first. Other people's proposals are not shown.",
  middleware: [...read] as const,
  request: { params: taskProposalsParam },
  responses: {
    200: jsonResponse("Proposals", z.array(proposalSchema)),
    403: noAccess,
    404: notFound,
  },
});

const proposalRoutes = apiRouter()
  .openapi(taskRoute, async (c) => {
    const { workspaceId, taskId } = c.req.valid("param");
    return c.json(
      await taskProposals(await readerOf(c, workspaceId), taskId),
      200,
    );
  })
  .openapi(draftsRoute, async (c) =>
    c.json(
      await pendingDrafts(await readerOf(c, c.req.valid("param").workspaceId)),
      200,
    ),
  )
  .openapi(acceptRoute, async (c) => {
    const { workspaceId, proposalId } = c.req.valid("param");
    const { fields } = c.req.valid("query");
    const row = await acceptProposal(
      c.get("userId"),
      workspaceId,
      proposalId,
      c.req.raw.headers,
      fields?.split(",").map((field) => field.trim()),
    );
    return c.json(await proposalView(await readerOf(c, workspaceId), row), 200);
  })
  .openapi(decideRoute("decline"), async (c) => {
    const { workspaceId, proposalId } = c.req.valid("param");
    const row = await declineProposal(c.get("userId"), workspaceId, proposalId);
    return c.json(await proposalView(await readerOf(c, workspaceId), row), 200);
  })
  .openapi(auditRoute, async (c) =>
    c.json(
      await listAudit(await readerOf(c, c.req.valid("param").workspaceId)),
      200,
    ),
  );

export default proposalRoutes;
