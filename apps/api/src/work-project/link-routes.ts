import { createRoute, errorResponse, jsonResponse } from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { refuseGuests } from "../guest/refuse-guests";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { deletedSchema, workProjectLinkSchema } from "./response";
import { linkBody, linkParam, workProjectParam } from "./schema";

const noAccess = errorResponse("Missing permission for this workspace");

// Links are read with the project (`GET /{id}`); whoever may post on a project
// may add and remove them, as with its comments.
export const addLinkRoute = createRoute({
  method: "post",
  operationId: "addWorkProjectLink",
  path: "/{id}/link",
  tags: ["Work projects"],
  summary: "Add a link to a project",
  description:
    "Add a link to the project's resources: a web address, or a path inside the app.",
  middleware: [
    workspaceAccess.fromWorkProject(),
    refuseGuests(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: workProjectParam,
    body: {
      required: true as const,
      content: { "application/json": { schema: linkBody } },
    },
  },
  responses: {
    200: jsonResponse("Link added", workProjectLinkSchema),
    403: noAccess,
    404: errorResponse("Project not found"),
  },
});

export const removeLinkRoute = createRoute({
  method: "delete",
  operationId: "removeWorkProjectLink",
  path: "/{id}/link/{linkId}",
  tags: ["Work projects"],
  summary: "Remove a link from a project",
  description: "Remove one link from the project's resources.",
  middleware: [
    workspaceAccess.fromWorkProject(),
    refuseGuests(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: linkParam },
  responses: {
    200: jsonResponse("Link removed", deletedSchema),
    403: noAccess,
    404: errorResponse("Link not found"),
  },
});
