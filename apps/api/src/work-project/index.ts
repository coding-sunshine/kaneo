import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  loadWorkProjectDetail,
  loadWorkProjects,
} from "./controllers/load-work-projects";
import { saveWorkProject } from "./controllers/save-work-project";
import {
  createMilestone,
  deleteMilestone,
  deleteWorkProject,
  updateMilestone,
} from "./controllers/work-project-crud";
import { workProjectTable } from "../database/schema";
import { eq } from "drizzle-orm";
import {
  deletedSchema,
  workProjectDetailSchema,
  workProjectListSchema,
  workProjectMilestoneSchema,
} from "./response";
import {
  createMilestoneBody,
  createWorkProjectBody,
  listWorkProjectsQuery,
  milestoneParam,
  updateMilestoneBody,
  updateWorkProjectBody,
  workProjectParam,
  workspaceIdParam,
} from "./schema";

// Linear "Projects" reuse the workspace `project` permission (read/create/
// update/delete); Kaneo's own "project" is a Linear team.
const body = <T extends import("zod").ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const noAccess = errorResponse("Missing permission for this workspace");

const listRoute = createRoute({
  method: "get",
  operationId: "listWorkProjects",
  path: "/workspace/{workspaceId}",
  tags: ["Work projects"],
  summary: "List projects",
  description:
    "List a workspace's Linear-style projects with progress, optionally limited to one team.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam, query: listWorkProjectsQuery },
  responses: {
    200: jsonResponse("Projects in the workspace", workProjectListSchema),
    403: noAccess,
    404: errorResponse("Workspace not found"),
  },
});

const getRoute = createRoute({
  method: "get",
  operationId: "getWorkProject",
  path: "/{id}",
  tags: ["Work projects"],
  summary: "Get project",
  description: "Get a project with its milestones and their progress.",
  middleware: [
    workspaceAccess.fromWorkProject(),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: workProjectParam },
  responses: {
    200: jsonResponse("Project details", workProjectDetailSchema),
    403: noAccess,
    404: errorResponse("Project not found"),
    409: errorResponse("A project with this name already exists"),
  },
});

const createProjectRoute = createRoute({
  method: "post",
  operationId: "createWorkProject",
  path: "/",
  tags: ["Work projects"],
  summary: "Create project",
  description: "Create a Linear-style project in a workspace.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ project: ["create"] }),
  ] as const,
  request: { body: body(createWorkProjectBody) },
  responses: {
    200: jsonResponse("Project created", workProjectDetailSchema),
    400: errorResponse("Invalid body, lead, member or team"),
    403: noAccess,
    409: errorResponse("A project with this name already exists"),
  },
});

const updateProjectRoute = createRoute({
  method: "put",
  operationId: "updateWorkProject",
  path: "/{id}",
  tags: ["Work projects"],
  summary: "Update project",
  description:
    "Update any subset of a project's properties; teamIds and memberIds replace the full set.",
  middleware: [
    workspaceAccess.fromWorkProject(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: workProjectParam, body: body(updateWorkProjectBody) },
  responses: {
    200: jsonResponse("Project updated", workProjectDetailSchema),
    400: errorResponse("Invalid body, lead, member or team"),
    403: noAccess,
    404: errorResponse("Project not found"),
  },
});

const deleteProjectRoute = createRoute({
  method: "delete",
  operationId: "deleteWorkProject",
  path: "/{id}",
  tags: ["Work projects"],
  summary: "Delete project",
  description:
    "Delete a project and its milestones. Its issues stay and lose the project.",
  middleware: [
    workspaceAccess.fromWorkProject(),
    requireWorkspacePermission({ project: ["delete"] }),
  ] as const,
  request: { params: workProjectParam },
  responses: {
    200: jsonResponse("Project deleted", deletedSchema),
    403: noAccess,
    404: errorResponse("Project not found"),
  },
});

const createMilestoneRoute = createRoute({
  method: "post",
  operationId: "createWorkProjectMilestone",
  path: "/{id}/milestone",
  tags: ["Work projects"],
  summary: "Create milestone",
  description: "Add a milestone at the end of the project's milestone order.",
  middleware: [
    workspaceAccess.fromWorkProject(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: workProjectParam, body: body(createMilestoneBody) },
  responses: {
    200: jsonResponse("Milestone created", workProjectMilestoneSchema),
    403: noAccess,
    404: errorResponse("Project not found"),
    409: errorResponse("A milestone with this name already exists"),
  },
});

const updateMilestoneRoute = createRoute({
  method: "put",
  operationId: "updateWorkProjectMilestone",
  path: "/milestone/{id}",
  tags: ["Work projects"],
  summary: "Update milestone",
  description: "Rename, re-date or reorder a milestone.",
  middleware: [
    workspaceAccess.fromWorkProjectMilestone(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: milestoneParam, body: body(updateMilestoneBody) },
  responses: {
    200: jsonResponse("Milestone updated", workProjectMilestoneSchema),
    403: noAccess,
    404: errorResponse("Milestone not found"),
  },
});

const deleteMilestoneRoute = createRoute({
  method: "delete",
  operationId: "deleteWorkProjectMilestone",
  path: "/milestone/{id}",
  tags: ["Work projects"],
  summary: "Delete milestone",
  description: "Delete a milestone. Its issues stay in the project.",
  middleware: [
    workspaceAccess.fromWorkProjectMilestone(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: milestoneParam },
  responses: {
    200: jsonResponse("Milestone deleted", deletedSchema),
    403: noAccess,
    404: errorResponse("Milestone not found"),
  },
});

const workProject = apiRouter()
  .openapi(listRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { teamId } = c.req.valid("query");
    return c.json(
      await loadWorkProjects(
        eq(workProjectTable.workspaceId, workspaceId),
        teamId,
      ),
      200,
    );
  })
  .openapi(getRoute, async (c) =>
    c.json(await loadWorkProjectDetail(c.req.valid("param").id), 200),
  )
  .openapi(createProjectRoute, async (c) =>
    c.json(await saveWorkProject(c.req.valid("json")), 200),
  )
  .openapi(updateProjectRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await saveWorkProject(c.req.valid("json"), id), 200);
  })
  .openapi(deleteProjectRoute, async (c) =>
    c.json(await deleteWorkProject(c.req.valid("param").id), 200),
  )
  .openapi(createMilestoneRoute, async (c) =>
    c.json(
      await createMilestone(c.req.valid("param").id, c.req.valid("json")),
      200,
    ),
  )
  .openapi(updateMilestoneRoute, async (c) =>
    c.json(
      await updateMilestone(c.req.valid("param").id, c.req.valid("json")),
      200,
    ),
  )
  .openapi(deleteMilestoneRoute, async (c) =>
    c.json(await deleteMilestone(c.req.valid("param").id), 200),
  );

export default workProject;
