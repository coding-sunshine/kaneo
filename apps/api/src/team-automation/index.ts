import { and, eq, notInArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import {
  projectTable,
  projectTriageResponsibleTable,
} from "../database/schema";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { projectSchema } from "../project/response";
import { filterAssignableUsers } from "../utils/assert-assignable-user";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { setUpItIntake } from "./it-intake";
import {
  itIntakeSchema,
  projectIdParam,
  slaSettingsBody,
  triageResponsibilityBody,
  triageResponsibilitySchema,
} from "./schema";
import "./sla";
import "./triage";

const body = <T extends import("zod").ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const noAccess = errorResponse("Missing permission for this team");

const slaRoute = createRoute({
  method: "put",
  operationId: "updateSlaSettings",
  path: "/sla/{projectId}",
  tags: ["Team automation"],
  summary: "Update a team's SLA settings",
  description:
    "Turn SLAs on and set the deadline for urgent and high priority issues. The rule applies when an issue is created or its priority changes.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: projectIdParam, body: body(slaSettingsBody) },
  responses: {
    200: jsonResponse("The updated team", projectSchema),
    403: noAccess,
    404: errorResponse("Team not found"),
  },
});

const getTriageRoute = createRoute({
  method: "get",
  operationId: "getTriageResponsibility",
  path: "/triage/{projectId}",
  tags: ["Team automation"],
  summary: "Get a team's triage responsibility",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "Who handles incoming triage",
      triageResponsibilitySchema,
    ),
    403: noAccess,
    404: errorResponse("Team not found"),
  },
});

const setTriageRoute = createRoute({
  method: "put",
  operationId: "updateTriageResponsibility",
  path: "/triage/{projectId}",
  tags: ["Team automation"],
  summary: "Set a team's triage responsibility",
  description:
    "Name the people who handle incoming triage issues. In notify mode they are notified; in assign mode new triage issues rotate through them.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: projectIdParam, body: body(triageResponsibilityBody) },
  responses: {
    200: jsonResponse(
      "Who handles incoming triage",
      triageResponsibilitySchema,
    ),
    400: errorResponse("A listed user cannot work on this team"),
    403: noAccess,
    404: errorResponse("Team not found"),
  },
});

const itIntakeRoute = createRoute({
  method: "post",
  operationId: "setUpItIntake",
  path: "/it-intake/{projectId}",
  tags: ["Team automation"],
  summary: "Set up IT intake for a team",
  description:
    'Add a Triage status, a required Category dropdown, an "IT request" template that files high priority requests into Triage, turn SLAs on, and add a shared "IT queue" view of Triage. Running it again reuses what already exists.',
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("What the IT intake uses", itIntakeSchema),
    403: noAccess,
    404: errorResponse("Team not found"),
  },
});

async function loadTriage(projectId: string) {
  const [project] = await db
    .select({ mode: projectTable.triageResponsibilityMode })
    .from(projectTable)
    .where(eq(projectTable.id, projectId));
  if (!project) throw new HTTPException(404, { message: "Team not found" });
  const rows = await db
    .select({ userId: projectTriageResponsibleTable.userId })
    .from(projectTriageResponsibleTable)
    .where(eq(projectTriageResponsibleTable.projectId, projectId));
  return {
    mode: project.mode as "notify" | "assign",
    userIds: rows.map((row) => row.userId),
  };
}

const teamAutomation = apiRouter()
  .openapi(slaRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const [project] = await db
      .update(projectTable)
      .set(c.req.valid("json"))
      .where(eq(projectTable.id, projectId))
      .returning();
    if (!project) throw new HTTPException(404, { message: "Team not found" });
    return c.json(project, 200);
  })
  .openapi(itIntakeRoute, async (c) =>
    c.json(
      await setUpItIntake(c.req.valid("param").projectId, c.get("userId")),
      200,
    ),
  )
  .openapi(getTriageRoute, async (c) =>
    c.json(await loadTriage(c.req.valid("param").projectId), 200),
  )
  .openapi(setTriageRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const { mode, userIds } = c.req.valid("json");
    const [project] = await db
      .select({ workspaceId: projectTable.workspaceId })
      .from(projectTable)
      .where(eq(projectTable.id, projectId));
    if (!project) throw new HTTPException(404, { message: "Team not found" });
    const ids = [...new Set(userIds)];
    const assignable = await filterAssignableUsers(ids, project.workspaceId);
    if (ids.some((id) => !assignable.has(id)))
      throw new HTTPException(400, {
        message: "Everyone listed must be a member of this workspace",
      });
    await db.transaction(async (tx) => {
      await tx
        .update(projectTable)
        .set({ triageResponsibilityMode: mode })
        .where(eq(projectTable.id, projectId));
      // Keep rows that stay so their rotation order survives.
      await tx
        .delete(projectTriageResponsibleTable)
        .where(
          and(
            eq(projectTriageResponsibleTable.projectId, projectId),
            ids.length
              ? notInArray(projectTriageResponsibleTable.userId, ids)
              : undefined,
          ),
        );
      if (ids.length)
        await tx
          .insert(projectTriageResponsibleTable)
          .values(ids.map((userId) => ({ projectId, userId })))
          .onConflictDoNothing();
    });
    return c.json({ mode, userIds: ids }, 200);
  });

export default teamAutomation;
