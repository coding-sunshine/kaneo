import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { cycleTable, projectTable } from "../database/schema";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { projectSchema } from "../project/response";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { validateAndParseDate } from "../utils/validate-dates";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { loadCycle, loadCycles } from "./load";
import { reconcileCycles } from "./reconcile";
import { cycleListSchema, cycleSchema } from "./response";
import {
  cycleParam,
  cycleSettingsBody,
  projectIdParam,
  updateCycleBody,
} from "./schema";
import { publishEvent } from "../events";
import "./subscribe";

const body = <T extends import("zod").ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const noAccess = errorResponse("Missing permission for this team");

const listRoute = createRoute({
  method: "get",
  operationId: "listCycles",
  path: "/project/{projectId}",
  tags: ["Cycles"],
  summary: "List a team's cycles",
  description:
    "Brings the team's cycles up to date (upcoming cycles created, ended ones completed with unfinished issues rolled over), then lists them newest first with progress.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("Cycles of the team", cycleListSchema),
    403: noAccess,
    404: errorResponse("Team not found"),
  },
});

const getRoute = createRoute({
  method: "get",
  operationId: "getCycle",
  path: "/{id}",
  tags: ["Cycles"],
  summary: "Get cycle",
  description: "Get one cycle with its progress.",
  middleware: [
    workspaceAccess.fromCycle(),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: cycleParam },
  responses: {
    200: jsonResponse("The cycle", cycleSchema),
    403: noAccess,
    404: errorResponse("Cycle not found"),
  },
});

const updateRoute = createRoute({
  method: "put",
  operationId: "updateCycle",
  path: "/{id}",
  tags: ["Cycles"],
  summary: "Update cycle",
  description: "Rename a cycle or move its start and end dates.",
  middleware: [
    workspaceAccess.fromCycle(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: cycleParam, body: body(updateCycleBody) },
  responses: {
    200: jsonResponse("The updated cycle", cycleSchema),
    400: errorResponse("Invalid dates"),
    403: noAccess,
    404: errorResponse("Cycle not found"),
  },
});

const settingsRoute = createRoute({
  method: "put",
  operationId: "updateCycleSettings",
  path: "/settings/{projectId}",
  tags: ["Cycles"],
  summary: "Update a team's cycle settings",
  description:
    "Enable cycles and set duration, cooldown, start day, how many upcoming cycles exist, and the auto-add and rollover behaviour.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: projectIdParam, body: body(cycleSettingsBody) },
  responses: {
    200: jsonResponse("The updated team", projectSchema),
    403: noAccess,
    404: errorResponse("Team not found"),
  },
});

const cycle = apiRouter()
  .openapi(listRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    await reconcileCycles(projectId);
    return c.json(await loadCycles(eq(cycleTable.projectId, projectId)), 200);
  })
  .openapi(getRoute, async (c) =>
    c.json(await loadCycle(c.req.valid("param").id), 200),
  )
  .openapi(updateRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { name, startsAt, endsAt } = c.req.valid("json");
    const current = await loadCycle(id);
    const start = startsAt
      ? validateAndParseDate(startsAt, "startsAt")
      : current.startsAt;
    const end = endsAt
      ? validateAndParseDate(endsAt, "endsAt")
      : current.endsAt;
    if (end <= start)
      throw new HTTPException(400, {
        message: "A cycle must end after it starts",
      });
    await db
      .update(cycleTable)
      .set({
        ...(name === undefined ? {} : { name: name || null }),
        startsAt: start,
        endsAt: end,
      })
      .where(eq(cycleTable.id, id));
    await publishEvent("cycle.updated", { cycleId: id });
    return c.json(await loadCycle(id), 200);
  })
  .openapi(settingsRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const settings = c.req.valid("json");
    const [project] = await db
      .update(projectTable)
      .set(settings)
      .where(eq(projectTable.id, projectId))
      .returning();
    if (!project) throw new HTTPException(404, { message: "Team not found" });
    await reconcileCycles(projectId);
    return c.json(project, 200);
  });

export default cycle;
