import { refuseGuests } from "../guest/refuse-guests";
import { createRoute, errorResponse, jsonResponse } from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { workProjectDetailSchema } from "./response";
import { dependencyBody, dependencyParam, workProjectParam } from "./schema";

const noAccess = errorResponse("Missing permission for this workspace");

// Dependencies are read with the project (`dependsOnIds`, `dependentIds`);
// changing one changes the project's plan, so it needs `project: update`.
export const addDependencyRoute = createRoute({
  method: "post",
  operationId: "addWorkProjectDependency",
  path: "/{id}/dependency",
  tags: ["Work projects"],
  summary: "Add a project dependency",
  description:
    "Make this project wait on another project in the same workspace. Refused when the other project already waits on this one.",
  middleware: [
    workspaceAccess.fromWorkProject(),
    refuseGuests(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: workProjectParam,
    body: {
      required: true as const,
      content: { "application/json": { schema: dependencyBody } },
    },
  },
  responses: {
    200: jsonResponse("Dependency added", workProjectDetailSchema),
    400: errorResponse(
      "The project depends on itself or on a project outside the workspace",
    ),
    403: noAccess,
    404: errorResponse("Project not found"),
    409: errorResponse("The projects would wait on each other"),
  },
});

export const removeDependencyRoute = createRoute({
  method: "delete",
  operationId: "removeWorkProjectDependency",
  path: "/{id}/dependency/{dependsOnId}",
  tags: ["Work projects"],
  summary: "Remove a project dependency",
  description: "Stop this project waiting on another project.",
  middleware: [
    workspaceAccess.fromWorkProject(),
    refuseGuests(),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: dependencyParam },
  responses: {
    200: jsonResponse("Dependency removed", workProjectDetailSchema),
    403: noAccess,
    404: errorResponse("Project not found"),
  },
});
