import type { ZodType } from "zod";
import { isWorkspaceGuest } from "../guest/is-workspace-guest";
import { refuseGuests } from "../guest/refuse-guests";
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
import { deletedSchema } from "../work-project/response";
import {
  createInitiativeUpdate,
  deleteInitiativeUpdate,
  listInitiativeUpdates,
  listWorkspaceInitiativeUpdates,
} from "./controllers/initiative-updates";
import {
  loadInitiativeDetail,
  loadInitiatives,
} from "./controllers/load-initiatives";
import {
  deleteInitiative,
  saveInitiative,
} from "./controllers/save-initiative";
import {
  initiativeDetailSchema,
  initiativeListSchema,
  initiativeUpdateListSchema,
  initiativeUpdateSchema,
} from "./response";
import {
  createInitiativeBody,
  createInitiativeUpdateBody,
  initiativeParam,
  updateInitiativeBody,
  workspaceIdParam,
} from "./schema";

// Initiatives sit above projects, so they use the same workspace `project`
// permission; posting an update needs `task: update`, like a project update.
const body = <T extends ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const noAccess = errorResponse("Missing permission for this workspace");
const tags = ["Initiatives"];

const listRoute = createRoute({
  method: "get",
  operationId: "listInitiatives",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "List initiatives",
  description:
    "List a workspace's initiatives with their rolled-up health and progress.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Initiatives in the workspace", initiativeListSchema),
    403: noAccess,
    404: errorResponse("Workspace not found"),
  },
});

const pulseRoute = createRoute({
  method: "get",
  operationId: "listWorkspaceInitiativeUpdates",
  path: "/workspace/{workspaceId}/updates",
  tags,
  summary: "Initiative updates for Pulse",
  description: "The latest 100 initiative updates across the workspace.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Initiative updates", initiativeUpdateListSchema),
    403: noAccess,
    404: errorResponse("Workspace not found"),
  },
});

const getRoute = createRoute({
  method: "get",
  operationId: "getInitiative",
  path: "/{id}",
  tags,
  summary: "Get initiative",
  description: "Get an initiative with its projects.",
  middleware: [
    workspaceAccess.fromInitiative(),
    refuseGuests(),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: initiativeParam },
  responses: {
    200: jsonResponse("Initiative details", initiativeDetailSchema),
    403: noAccess,
    404: errorResponse("Initiative not found"),
  },
});

const createInitiativeRoute = createRoute({
  method: "post",
  operationId: "createInitiative",
  path: "/",
  tags,
  summary: "Create initiative",
  description: "Create an initiative in a workspace.",
  middleware: [
    workspaceAccess.fromBody(),
    refuseGuests(),
    requireWorkspacePermission({ project: ["create"] }),
  ] as const,
  request: { body: body(createInitiativeBody) },
  responses: {
    200: jsonResponse("Initiative created", initiativeDetailSchema),
    400: errorResponse("Invalid body, owner or project"),
    403: noAccess,
  },
});

const updateInitiativeRoute = createRoute({
  method: "put",
  operationId: "updateInitiative",
  path: "/{id}",
  tags,
  summary: "Update initiative",
  description:
    "Update any subset of an initiative's properties; workProjectIds replaces the full set.",
  middleware: [
    workspaceAccess.fromInitiative(),
    refuseGuests(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: initiativeParam, body: body(updateInitiativeBody) },
  responses: {
    200: jsonResponse("Initiative updated", initiativeDetailSchema),
    400: errorResponse("Invalid body, owner or project"),
    403: noAccess,
    404: errorResponse("Initiative not found"),
  },
});

const deleteInitiativeRoute = createRoute({
  method: "delete",
  operationId: "deleteInitiative",
  path: "/{id}",
  tags,
  summary: "Delete initiative",
  description: "Delete an initiative and its updates. Its projects stay.",
  middleware: [
    workspaceAccess.fromInitiative(),
    refuseGuests(),
    requireWorkspacePermission({ project: ["delete"] }),
  ] as const,
  request: { params: initiativeParam },
  responses: {
    200: jsonResponse("Initiative deleted", deletedSchema),
    403: noAccess,
    404: errorResponse("Initiative not found"),
  },
});

const listUpdatesRoute = createRoute({
  method: "get",
  operationId: "listInitiativeUpdates",
  path: "/{id}/update",
  tags,
  summary: "List initiative updates",
  description: "Health updates posted on an initiative, newest first.",
  middleware: [
    workspaceAccess.fromInitiative(),
    refuseGuests(),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: initiativeParam },
  responses: {
    200: jsonResponse("Initiative updates", initiativeUpdateListSchema),
    403: noAccess,
    404: errorResponse("Initiative not found"),
  },
});

const createUpdateRoute = createRoute({
  method: "post",
  operationId: "createInitiativeUpdate",
  path: "/{id}/update",
  tags,
  summary: "Post initiative update",
  description:
    "Post an update with a health value; the initiative's health follows its latest update.",
  middleware: [
    workspaceAccess.fromInitiative(),
    refuseGuests(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: initiativeParam, body: body(createInitiativeUpdateBody) },
  responses: {
    200: jsonResponse("Update posted", initiativeUpdateSchema),
    403: noAccess,
    404: errorResponse("Initiative not found"),
  },
});

const deleteUpdateRoute = createRoute({
  method: "delete",
  operationId: "deleteInitiativeUpdate",
  path: "/update/{id}",
  tags,
  summary: "Delete initiative update",
  description: "Delete an update. Its author or a workspace admin can.",
  middleware: [
    workspaceAccess.fromInitiativeUpdate(),
    refuseGuests(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: initiativeParam },
  responses: {
    200: jsonResponse("Update deleted", deletedSchema),
    403: noAccess,
    404: errorResponse("Update not found"),
  },
});

const initiative = apiRouter()
  .openapi(listRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    // Initiatives span the workspace; a guest has none of them.
    if (await isWorkspaceGuest(workspaceId, c.get("userId")))
      return c.json([], 200);
    return c.json(await loadInitiatives(workspaceId, c.get("userId")), 200);
  })
  .openapi(pulseRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    if (await isWorkspaceGuest(workspaceId, c.get("userId")))
      return c.json([], 200);
    return c.json(await listWorkspaceInitiativeUpdates(workspaceId), 200);
  })
  .openapi(listUpdatesRoute, async (c) =>
    c.json(await listInitiativeUpdates(c.req.valid("param").id), 200),
  )
  .openapi(createUpdateRoute, async (c) =>
    c.json(
      await createInitiativeUpdate(
        c.req.valid("param").id,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(deleteUpdateRoute, async (c) =>
    c.json(
      await deleteInitiativeUpdate(
        c.req.valid("param").id,
        c.get("userId"),
        await hasWorkspacePermission(c, { project: ["delete"] }),
      ),
      200,
    ),
  )
  .openapi(getRoute, async (c) =>
    c.json(
      await loadInitiativeDetail(c.req.valid("param").id, c.get("userId")),
      200,
    ),
  )
  .openapi(createInitiativeRoute, async (c) =>
    c.json(await saveInitiative(c.req.valid("json"), c.get("userId")), 200),
  )
  .openapi(updateInitiativeRoute, async (c) =>
    c.json(
      await saveInitiative(
        c.req.valid("json"),
        c.get("userId"),
        c.req.valid("param").id,
      ),
      200,
    ),
  )
  .openapi(deleteInitiativeRoute, async (c) =>
    c.json(await deleteInitiative(c.req.valid("param").id), 200),
  );

export default initiative;
