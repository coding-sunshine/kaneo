import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  assignProjectLabel,
  createProjectLabel,
  deleteProjectLabel,
  listProjectLabels,
  unassignProjectLabel,
  updateProjectLabel,
} from "./controllers";
import {
  assignmentParam,
  assignmentSchema,
  assignProjectLabelBody,
  createProjectLabelBody,
  projectLabelIdSchema,
  projectLabelListSchema,
  projectLabelParam,
  projectLabelSchema,
  updateProjectLabelBody,
  workspaceIdParam,
} from "./schema";

// Project labels reuse the workspace `label` permission for the label records
// and `project: update` for attaching them to a project.
const body = <T extends import("zod").ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const noAccess = errorResponse("Missing permission for this workspace");
const tags = ["Project labels"];

const listRoute = createRoute({
  method: "get",
  operationId: "listProjectLabels",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "List project labels",
  description: "List a workspace's project labels.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ label: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Project labels", projectLabelListSchema),
    403: noAccess,
    404: errorResponse("Workspace not found"),
  },
});

const createRoute_ = createRoute({
  method: "post",
  operationId: "createProjectLabel",
  path: "/",
  tags,
  summary: "Create project label",
  description: "Create a workspace-scoped project label.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ label: ["create"] }),
  ] as const,
  request: { body: body(createProjectLabelBody) },
  responses: {
    200: jsonResponse("Project label created", projectLabelSchema),
    403: noAccess,
    409: errorResponse("A project label with this name already exists"),
  },
});

const updateRoute = createRoute({
  method: "put",
  operationId: "updateProjectLabel",
  path: "/{id}",
  tags,
  summary: "Update project label",
  description: "Rename or recolor a project label.",
  middleware: [
    workspaceAccess.fromProjectLabel(),
    requireWorkspacePermission({ label: ["update"] }),
  ] as const,
  request: { params: projectLabelParam, body: body(updateProjectLabelBody) },
  responses: {
    200: jsonResponse("Project label updated", projectLabelSchema),
    403: noAccess,
    404: errorResponse("Project label not found"),
    409: errorResponse("A project label with this name already exists"),
  },
});

const deleteRoute = createRoute({
  method: "delete",
  operationId: "deleteProjectLabel",
  path: "/{id}",
  tags,
  summary: "Delete project label",
  description: "Delete a project label; projects keep existing without it.",
  middleware: [
    workspaceAccess.fromProjectLabel(),
    requireWorkspacePermission({ label: ["delete"] }),
  ] as const,
  request: { params: projectLabelParam },
  responses: {
    200: jsonResponse("Project label deleted", projectLabelIdSchema),
    403: noAccess,
    404: errorResponse("Project label not found"),
  },
});

const assignRoute = createRoute({
  method: "put",
  operationId: "assignProjectLabel",
  path: "/{id}/work-project",
  tags,
  summary: "Add project label to a project",
  description: "Attach a project label to a project in the same workspace.",
  middleware: [
    workspaceAccess.fromProjectLabel(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: projectLabelParam, body: body(assignProjectLabelBody) },
  responses: {
    200: jsonResponse("Project label attached", assignmentSchema),
    400: errorResponse("Project is in another workspace"),
    403: noAccess,
    404: errorResponse("Project label not found"),
  },
});

const unassignRoute = createRoute({
  method: "delete",
  operationId: "unassignProjectLabel",
  path: "/{id}/work-project/{workProjectId}",
  tags,
  summary: "Remove project label from a project",
  description: "Detach a project label from a project.",
  middleware: [
    workspaceAccess.fromProjectLabel(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: assignmentParam },
  responses: {
    200: jsonResponse("Project label detached", assignmentSchema),
    403: noAccess,
    404: errorResponse("Project label not found"),
  },
});

const projectLabel = apiRouter()
  .openapi(listRoute, async (c) =>
    c.json(await listProjectLabels(c.req.valid("param").workspaceId), 200),
  )
  .openapi(createRoute_, async (c) =>
    c.json(await createProjectLabel(c.req.valid("json")), 200),
  )
  .openapi(updateRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await updateProjectLabel(id, c.req.valid("json")), 200);
  })
  .openapi(deleteRoute, async (c) =>
    c.json(await deleteProjectLabel(c.req.valid("param").id), 200),
  )
  .openapi(assignRoute, async (c) =>
    c.json(
      await assignProjectLabel(
        c.req.valid("param").id,
        c.req.valid("json").workProjectId,
      ),
      200,
    ),
  )
  .openapi(unassignRoute, async (c) => {
    const { id, workProjectId } = c.req.valid("param");
    return c.json(await unassignProjectLabel(id, workProjectId), 200);
  });

export default projectLabel;
