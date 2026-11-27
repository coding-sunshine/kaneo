import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { isWorkspaceGuest } from "../guest/is-workspace-guest";
import { refuseGuests } from "../guest/refuse-guests";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  loadWorkProjectDetail,
  loadWorkProjects,
} from "./controllers/load-work-projects";
import {
  createProjectUpdate,
  deleteProjectUpdate,
  editProjectUpdate,
  listProjectUpdates,
  listWorkspaceUpdates,
} from "./controllers/work-project-updates";
import {
  createProjectComment,
  deleteProjectComment,
  editProjectComment,
  listProjectComments,
} from "./controllers/work-project-comments";
import {
  addProjectLink,
  removeProjectLink,
} from "./controllers/work-project-links";
import { addLinkRoute, removeLinkRoute } from "./link-routes";
import { saveWorkProject } from "./controllers/save-work-project";
import {
  createMilestone,
  deleteMilestone,
  deleteWorkProject,
  updateMilestone,
} from "./controllers/work-project-crud";
import { workProjectTable } from "../database/schema";
import { eq } from "drizzle-orm";
import { hasWorkspacePermission } from "../utils/require-workspace-permission";
import {
  deletedSchema,
  workProjectDetailSchema,
  workProjectListSchema,
  workProjectMilestoneSchema,
  workProjectCommentListSchema,
  workProjectCommentSchema,
  workProjectUpdateListSchema,
  workProjectUpdateSchema,
} from "./response";
import {
  commentBody,
  createMilestoneBody,
  createUpdateBody,
  createWorkProjectBody,
  listWorkProjectsQuery,
  milestoneParam,
  updateMilestoneBody,
  updateParam,
  updateUpdateBody,
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
    refuseGuests(),
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
    refuseGuests(),
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
    refuseGuests(),
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
    refuseGuests(),
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
    refuseGuests(),
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
    refuseGuests(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: milestoneParam, body: body(updateMilestoneBody) },
  responses: {
    200: jsonResponse("Milestone updated", workProjectMilestoneSchema),
    403: noAccess,
    404: errorResponse("Milestone not found"),
    409: errorResponse("A milestone with this name already exists"),
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
    refuseGuests(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: milestoneParam },
  responses: {
    200: jsonResponse("Milestone deleted", deletedSchema),
    403: noAccess,
    404: errorResponse("Milestone not found"),
  },
});

const listUpdatesRoute = createRoute({
  method: "get",
  operationId: "listWorkProjectUpdates",
  path: "/{id}/update",
  tags: ["Work projects"],
  summary: "List project updates",
  description: "Health updates posted on a project, newest first.",
  middleware: [
    workspaceAccess.fromWorkProject(),
    refuseGuests(),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: workProjectParam },
  responses: {
    200: jsonResponse("Project updates", workProjectUpdateListSchema),
    403: noAccess,
    404: errorResponse("Project not found"),
  },
});

const createUpdateRoute = createRoute({
  method: "post",
  operationId: "createWorkProjectUpdate",
  path: "/{id}/update",
  tags: ["Work projects"],
  summary: "Post project update",
  description:
    "Post an update with a health value; the project's health follows its latest update.",
  middleware: [
    workspaceAccess.fromWorkProject(),
    refuseGuests(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: workProjectParam, body: body(createUpdateBody) },
  responses: {
    200: jsonResponse("Update posted", workProjectUpdateSchema),
    403: noAccess,
    404: errorResponse("Project not found"),
  },
});

const editUpdateRoute = createRoute({
  method: "put",
  operationId: "updateWorkProjectUpdate",
  path: "/update/{id}",
  tags: ["Work projects"],
  summary: "Edit project update",
  description:
    "Edit the health or text of an update. Only its author can; the project's health follows the latest update.",
  middleware: [
    workspaceAccess.fromWorkProjectUpdate(),
    refuseGuests(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: updateParam, body: body(updateUpdateBody) },
  responses: {
    200: jsonResponse("Update edited", workProjectUpdateSchema),
    403: noAccess,
    404: errorResponse("Update not found"),
  },
});

const deleteUpdateRoute = createRoute({
  method: "delete",
  operationId: "deleteWorkProjectUpdate",
  path: "/update/{id}",
  tags: ["Work projects"],
  summary: "Delete project update",
  description:
    "Delete an update. Its author or a workspace admin can; the project's health falls back to the previous update, or clears.",
  middleware: [
    workspaceAccess.fromWorkProjectUpdate(),
    refuseGuests(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: updateParam },
  responses: {
    200: jsonResponse("Update deleted", deletedSchema),
    403: noAccess,
    404: errorResponse("Update not found"),
  },
});

const listCommentsRoute = createRoute({
  method: "get",
  operationId: "listWorkProjectComments",
  path: "/{id}/comment",
  tags: ["Work projects"],
  summary: "List project comments",
  description: "Comments on a project's activity feed, oldest first.",
  middleware: [
    workspaceAccess.fromWorkProject(),
    refuseGuests(),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: workProjectParam },
  responses: {
    200: jsonResponse("Project comments", workProjectCommentListSchema),
    403: noAccess,
    404: errorResponse("Project not found"),
  },
});

const createCommentRoute = createRoute({
  method: "post",
  operationId: "createWorkProjectComment",
  path: "/{id}/comment",
  tags: ["Work projects"],
  summary: "Comment on a project",
  description: "Add a comment to a project's activity feed.",
  middleware: [
    workspaceAccess.fromWorkProject(),
    refuseGuests(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: workProjectParam, body: body(commentBody) },
  responses: {
    200: jsonResponse("Comment posted", workProjectCommentSchema),
    403: noAccess,
    404: errorResponse("Project not found"),
  },
});

const editCommentRoute = createRoute({
  method: "put",
  operationId: "updateWorkProjectComment",
  path: "/comment/{id}",
  tags: ["Work projects"],
  summary: "Edit project comment",
  description: "Edit a project comment. Only its author can.",
  middleware: [
    workspaceAccess.fromWorkProjectComment(),
    refuseGuests(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: updateParam, body: body(commentBody) },
  responses: {
    200: jsonResponse("Comment edited", workProjectCommentSchema),
    403: noAccess,
    404: errorResponse("Comment not found"),
  },
});

const deleteCommentRoute = createRoute({
  method: "delete",
  operationId: "deleteWorkProjectComment",
  path: "/comment/{id}",
  tags: ["Work projects"],
  summary: "Delete project comment",
  description: "Delete a project comment. Its author or a workspace admin can.",
  middleware: [
    workspaceAccess.fromWorkProjectComment(),
    refuseGuests(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: updateParam },
  responses: {
    200: jsonResponse("Comment deleted", deletedSchema),
    403: noAccess,
    404: errorResponse("Comment not found"),
  },
});

const pulseRoute = createRoute({
  method: "get",
  operationId: "listWorkspaceProjectUpdates",
  path: "/workspace/{workspaceId}/updates",
  tags: ["Work projects"],
  summary: "Pulse feed",
  description: "The latest 100 project updates across the workspace.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Project updates", workProjectUpdateListSchema),
    403: noAccess,
    404: errorResponse("Workspace not found"),
  },
});

const workProject = apiRouter()
  .openapi(listRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { teamId } = c.req.valid("query");
    // Projects span the workspace; a guest has none of them.
    if (await isWorkspaceGuest(workspaceId, c.get("userId")))
      return c.json([], 200);
    return c.json(
      await loadWorkProjects(
        eq(workProjectTable.workspaceId, workspaceId),
        c.get("userId"),
        teamId,
      ),
      200,
    );
  })
  .openapi(pulseRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    if (await isWorkspaceGuest(workspaceId, c.get("userId")))
      return c.json([], 200);
    return c.json(await listWorkspaceUpdates(workspaceId), 200);
  })
  .openapi(listUpdatesRoute, async (c) =>
    c.json(await listProjectUpdates(c.req.valid("param").id), 200),
  )
  .openapi(createUpdateRoute, async (c) =>
    c.json(
      await createProjectUpdate(
        c.req.valid("param").id,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(editUpdateRoute, async (c) =>
    c.json(
      await editProjectUpdate(
        c.req.valid("param").id,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(deleteUpdateRoute, async (c) =>
    c.json(
      await deleteProjectUpdate(
        c.req.valid("param").id,
        c.get("userId"),
        await hasWorkspacePermission(c, { project: ["delete"] }),
      ),
      200,
    ),
  )
  .openapi(listCommentsRoute, async (c) =>
    c.json(await listProjectComments(c.req.valid("param").id), 200),
  )
  .openapi(createCommentRoute, async (c) =>
    c.json(
      await createProjectComment(
        c.req.valid("param").id,
        c.get("userId"),
        c.req.valid("json").content,
      ),
      200,
    ),
  )
  .openapi(editCommentRoute, async (c) =>
    c.json(
      await editProjectComment(
        c.req.valid("param").id,
        c.get("userId"),
        c.req.valid("json").content,
      ),
      200,
    ),
  )
  .openapi(deleteCommentRoute, async (c) =>
    c.json(
      await deleteProjectComment(
        c.req.valid("param").id,
        c.get("userId"),
        await hasWorkspacePermission(c, { project: ["delete"] }),
      ),
      200,
    ),
  )
  .openapi(getRoute, async (c) =>
    c.json(
      await loadWorkProjectDetail(c.req.valid("param").id, c.get("userId")),
      200,
    ),
  )
  .openapi(createProjectRoute, async (c) =>
    c.json(await saveWorkProject(c.req.valid("json"), c.get("userId")), 200),
  )
  .openapi(updateProjectRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(
      await saveWorkProject(c.req.valid("json"), c.get("userId"), id),
      200,
    );
  })
  .openapi(deleteProjectRoute, async (c) =>
    c.json(await deleteWorkProject(c.req.valid("param").id), 200),
  )
  .openapi(createMilestoneRoute, async (c) =>
    c.json(
      await createMilestone(
        c.req.valid("param").id,
        c.req.valid("json"),
        c.get("userId"),
      ),
      200,
    ),
  )
  .openapi(updateMilestoneRoute, async (c) =>
    c.json(
      await updateMilestone(
        c.req.valid("param").id,
        c.req.valid("json"),
        c.get("userId"),
      ),
      200,
    ),
  )
  .openapi(deleteMilestoneRoute, async (c) =>
    c.json(await deleteMilestone(c.req.valid("param").id), 200),
  )
  .openapi(addLinkRoute, async (c) =>
    c.json(
      await addProjectLink(
        c.req.valid("param").id,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(removeLinkRoute, async (c) => {
    const { id, linkId } = c.req.valid("param");
    return c.json(await removeProjectLink(id, linkId), 200);
  });

export default workProject;
