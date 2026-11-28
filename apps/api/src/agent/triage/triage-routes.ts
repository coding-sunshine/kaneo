import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../../openapi";
import { canAccessProject } from "../../project-access/can-access-project";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { teamParam, triageSettingsSchema } from "./triage-schema";
import { readTriageSettings, saveTriageSettings } from "./triage-settings";

const tags = ["Agent"];
const path = "/workspace/{workspaceId}/teams/{projectId}/triage-settings";
const responses = {
  200: jsonResponse("The team's AI triage settings", triageSettingsSchema),
  403: errorResponse("Missing permission for this workspace"),
  404: errorResponse("Agent is disabled or team not found"),
};

// A team of the workspace the person can open; any other answers 404.
async function openTeam(
  workspaceId: string,
  projectId: string,
  userId: string,
) {
  const [team] = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, projectId),
        eq(projectTable.workspaceId, workspaceId),
      ),
    );
  if (!team || !(await canAccessProject(userId, team.id)))
    throw new HTTPException(404, { message: "Team not found" });
}

const getRoute = createRoute({
  method: "get",
  operationId: "getAiTriageSettings",
  path,
  tags,
  summary: "Get a team's AI triage settings",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: teamParam },
  responses,
});

const putRoute = createRoute({
  method: "put",
  operationId: "updateAiTriageSettings",
  path,
  tags,
  summary: "Update a team's AI triage settings",
  description:
    "Set the guidance the model reads for the team's new triage tickets, and whether its suggestion applies without anyone accepting it.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: teamParam,
    body: {
      required: true as const,
      content: { "application/json": { schema: triageSettingsSchema } },
    },
  },
  responses,
});

const triageRoutes = apiRouter()
  .openapi(getRoute, async (c) => {
    const { workspaceId, projectId } = c.req.valid("param");
    await openTeam(workspaceId, projectId, c.get("userId"));
    return c.json(await readTriageSettings(projectId), 200);
  })
  .openapi(putRoute, async (c) => {
    const { workspaceId, projectId } = c.req.valid("param");
    const userId = c.get("userId");
    await openTeam(workspaceId, projectId, userId);
    return c.json(
      await saveTriageSettings(projectId, userId, c.req.valid("json")),
      200,
    );
  });

export default triageRoutes;
