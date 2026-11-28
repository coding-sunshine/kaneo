import { desc, eq } from "drizzle-orm";
import db from "../../database";
import { codingAgentRunTable } from "../../database/schema";
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
import { workspaceParam } from "../schema";
import { codingAgentConfig } from "./coding-agent-config";
import {
  codingAgentSchema,
  runSchema,
  startBody,
  taskParam,
} from "./delegation-schema";
import { proposeDelegation } from "./propose-delegation";
import { readableTask } from "./readable-task";
import { runView } from "./run-view";
import { startRun } from "./start-run";

const tags = ["Agent"];
const noAccess = errorResponse("Missing permission for this workspace");
const notFound = errorResponse("Agent is disabled or ticket not found");
const off = errorResponse("No coding agent is configured on this server");
const read = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ project: ["read"] }),
] as const;
// Handing a ticket over changes it, so it needs the right to change tickets.
const change = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ task: ["update"] }),
] as const;

const configRoute = createRoute({
  method: "get",
  operationId: "getCodingAgent",
  path: "/workspace/{workspaceId}/coding-agent",
  tags,
  summary: "Get the coding agent",
  description:
    "Whether the server has a coding agent tickets can be handed to, and its name.",
  middleware: [...read] as const,
  request: { params: workspaceParam },
  responses: {
    200: jsonResponse("The coding agent", codingAgentSchema),
    403: noAccess,
    404: notFound,
  },
});

const delegateRoute = createRoute({
  method: "post",
  operationId: "delegateTask",
  path: "/workspace/{workspaceId}/tasks/{taskId}/delegate",
  tags,
  summary: "Propose handing a ticket to the coding agent",
  description:
    "Puts a delegation card on the ticket for you. Nothing is sent to the coding agent until you accept it; then the ticket moves to In Progress, the pull request the agent opens is linked, and its merge moves the ticket to done.",
  middleware: [...change] as const,
  request: { params: taskParam },
  responses: {
    200: jsonResponse("The delegation card", proposalSchema),
    403: noAccess,
    404: notFound,
    503: off,
  },
});

const startRoute = createRoute({
  method: "post",
  operationId: "startCodingAgentRun",
  path: "/workspace/{workspaceId}/delegations",
  tags,
  summary: "Start the coding agent on a ticket",
  description:
    "Starts the run of a delegation card you accepted. Accepting the card calls this; without an accepted card it answers 404.",
  middleware: [...change] as const,
  request: {
    params: workspaceParam,
    body: {
      required: true as const,
      content: { "application/json": { schema: startBody } },
    },
  },
  responses: {
    200: jsonResponse("The started run", runSchema),
    403: noAccess,
    404: notFound,
    409: errorResponse("The run already started"),
    502: errorResponse("The coding agent refused the run"),
    503: off,
  },
});

const runsRoute = createRoute({
  method: "get",
  operationId: "listCodingAgentRuns",
  path: "/workspace/{workspaceId}/tasks/{taskId}/delegations",
  tags,
  summary: "List a ticket's coding agent runs",
  middleware: [...read] as const,
  request: { params: taskParam },
  responses: {
    200: jsonResponse("Runs, newest first", z.array(runSchema)),
    403: noAccess,
    404: notFound,
  },
});

const delegationRoutes = apiRouter()
  .openapi(configRoute, (c) => {
    const agent = codingAgentConfig();
    return c.json(
      { configured: Boolean(agent), name: agent?.name ?? null },
      200,
    );
  })
  .openapi(delegateRoute, async (c) => {
    const { workspaceId, taskId } = c.req.valid("param");
    const row = await proposeDelegation(c.get("userId"), workspaceId, taskId);
    return c.json(await proposalView(await readerOf(c, workspaceId), row), 200);
  })
  .openapi(startRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { taskId } = c.req.valid("json");
    return c.json(await startRun(c.get("userId"), workspaceId, taskId), 200);
  })
  .openapi(runsRoute, async (c) => {
    const { workspaceId, taskId } = c.req.valid("param");
    const task = await readableTask(c.get("userId"), workspaceId, taskId);
    const runs = await db
      .select()
      .from(codingAgentRunTable)
      .where(eq(codingAgentRunTable.taskId, task.id))
      .orderBy(desc(codingAgentRunTable.createdAt))
      .limit(20);
    return c.json(runs.map(runView), 200);
  });

export default delegationRoutes;
