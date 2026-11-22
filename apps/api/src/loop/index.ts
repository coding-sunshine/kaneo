import { HTTPException } from "hono/http-exception";
import { isAgentEnabled } from "../agent/openrouter";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  createLoop,
  deleteLoop,
  getLoop,
  getOwnLoop,
  getRun,
  listLoops,
  listRuns,
  updateLoop,
} from "./controllers";
import { executeLoop } from "./run-loop";
import {
  createLoopBody,
  deletedLoopSchema,
  listQuery,
  loopListSchema,
  loopParam,
  loopSchema,
  runDetailSchema,
  runListSchema,
  runParam,
  updateLoopBody,
  workspaceParam,
} from "./schema";

const body = <T extends import("zod").ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const noAccess = errorResponse("Missing permission for this workspace");
const notFound = errorResponse("Loop not found or the agent is disabled");
const tags = ["Loops"];
const read = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ project: ["read"] }),
] as const;

const listRoute = createRoute({
  method: "get",
  operationId: "listLoops",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "List loops",
  description: "List a workspace's loops, all of them or only your own.",
  middleware: [...read] as const,
  request: { params: workspaceParam, query: listQuery },
  responses: {
    200: jsonResponse("Loops", loopListSchema),
    403: noAccess,
    404: notFound,
  },
});

const getRoute = createRoute({
  method: "get",
  operationId: "getLoop",
  path: "/workspace/{workspaceId}/{id}",
  tags,
  summary: "Get loop",
  description: "Get one loop.",
  middleware: [...read] as const,
  request: { params: loopParam },
  responses: {
    200: jsonResponse("Loop", loopSchema),
    403: noAccess,
    404: notFound,
  },
});

const createRouteDef = createRoute({
  method: "post",
  operationId: "createLoop",
  path: "/",
  tags,
  summary: "Create loop",
  description:
    "Create a loop that runs its instructions on a schedule, with your permissions at run time.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { body: body(createLoopBody) },
  responses: {
    200: jsonResponse("Loop created", loopSchema),
    403: noAccess,
    404: notFound,
  },
});

const updateRoute = createRoute({
  method: "put",
  operationId: "updateLoop",
  path: "/workspace/{workspaceId}/{id}",
  tags,
  summary: "Update loop",
  description:
    "Edit a loop or enable and disable it. Only the creator can do this.",
  middleware: [...read] as const,
  request: { params: loopParam, body: body(updateLoopBody) },
  responses: {
    200: jsonResponse("Loop updated", loopSchema),
    403: noAccess,
    404: notFound,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  operationId: "deleteLoop",
  path: "/workspace/{workspaceId}/{id}",
  tags,
  summary: "Delete loop",
  description: "Delete a loop and its run history. Only the creator can.",
  middleware: [...read] as const,
  request: { params: loopParam },
  responses: {
    200: jsonResponse("Loop deleted", deletedLoopSchema),
    403: noAccess,
    404: notFound,
  },
});

const runNowRoute = createRoute({
  method: "post",
  operationId: "runLoop",
  path: "/workspace/{workspaceId}/{id}/run",
  tags,
  summary: "Run loop now",
  description:
    "Run the loop immediately and wait for it to finish. Only the creator can.",
  middleware: [...read] as const,
  request: { params: loopParam },
  responses: {
    200: jsonResponse("Finished run", runDetailSchema),
    403: noAccess,
    404: notFound,
  },
});

const listRunsRoute = createRoute({
  method: "get",
  operationId: "listLoopRuns",
  path: "/workspace/{workspaceId}/{id}/runs",
  tags,
  summary: "List loop runs",
  description: "The most recent runs of a loop.",
  middleware: [...read] as const,
  request: { params: loopParam },
  responses: {
    200: jsonResponse("Runs", runListSchema),
    403: noAccess,
    404: notFound,
  },
});

const getRunRoute = createRoute({
  method: "get",
  operationId: "getLoopRun",
  path: "/workspace/{workspaceId}/{id}/runs/{runId}",
  tags,
  summary: "Get loop run",
  description: "One run with its full agent transcript.",
  middleware: [...read] as const,
  request: { params: runParam },
  responses: {
    200: jsonResponse("Run", runDetailSchema),
    403: noAccess,
    404: notFound,
  },
});

const loop = apiRouter();
loop.use("*", async (_c, next) => {
  if (!isAgentEnabled()) throw new HTTPException(404, { message: "Not found" });
  await next();
});

const routes = loop
  .openapi(listRoute, async (c) =>
    c.json(
      await listLoops(
        c.req.valid("param").workspaceId,
        c.get("userId"),
        c.req.valid("query").scope,
      ),
      200,
    ),
  )
  .openapi(getRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await getLoop(workspaceId, id), 200);
  })
  .openapi(createRouteDef, async (c) =>
    c.json(await createLoop(c.get("userId"), c.req.valid("json")), 200),
  )
  .openapi(updateRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(
      await updateLoop(workspaceId, id, c.get("userId"), c.req.valid("json")),
      200,
    );
  })
  .openapi(deleteRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await deleteLoop(workspaceId, id, c.get("userId")), 200);
  })
  .openapi(runNowRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    const own = await getOwnLoop(workspaceId, id, c.get("userId"));
    return c.json(await executeLoop(own, "manual"), 200);
  })
  .openapi(listRunsRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await listRuns(workspaceId, id), 200);
  })
  .openapi(getRunRoute, async (c) => {
    const { workspaceId, id, runId } = c.req.valid("param");
    return c.json(await getRun(workspaceId, id, runId), 200);
  });

export default routes;
