import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  createDraft,
  deleteDraft,
  listDrafts,
  updateDraft,
} from "./controllers";
import {
  deletedDraftSchema,
  draftBody,
  draftListSchema,
  draftParam,
  draftSchema,
  workspaceIdParam,
} from "./schema";

const tags = ["Drafts"];
const middleware = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ task: ["create"] }),
] as const;
const noAccess = errorResponse("Missing permission for this workspace");
const notFound = errorResponse("Draft not found");
const body = {
  required: true as const,
  content: { "application/json": { schema: draftBody } },
};

const listRoute = createRoute({
  method: "get",
  operationId: "listTaskDrafts",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "List drafts",
  description:
    "The signed-in user's saved issue drafts in a workspace, newest first. Drafts not updated for 180 days are left out.",
  middleware: [...middleware] as const,
  request: { params: workspaceIdParam },
  responses: { 200: jsonResponse("Drafts", draftListSchema), 403: noAccess },
});

const createRouteDef = createRoute({
  method: "post",
  operationId: "createTaskDraft",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "Save draft",
  description: "Save an unfinished create-issue form as a private draft.",
  middleware: [...middleware] as const,
  request: { params: workspaceIdParam, body },
  responses: { 200: jsonResponse("Draft saved", draftSchema), 403: noAccess },
});

const updateRoute = createRoute({
  method: "put",
  operationId: "updateTaskDraft",
  path: "/workspace/{workspaceId}/{id}",
  tags,
  summary: "Update draft",
  description: "Replace one of your drafts. Other users' drafts return 404.",
  middleware: [...middleware] as const,
  request: { params: draftParam, body },
  responses: {
    200: jsonResponse("Draft updated", draftSchema),
    403: noAccess,
    404: notFound,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  operationId: "deleteTaskDraft",
  path: "/workspace/{workspaceId}/{id}",
  tags,
  summary: "Delete draft",
  description: "Delete one of your drafts. Other users' drafts return 404.",
  middleware: [...middleware] as const,
  request: { params: draftParam },
  responses: {
    200: jsonResponse("Draft deleted", deletedDraftSchema),
    403: noAccess,
    404: notFound,
  },
});

const taskDraft = apiRouter()
  .openapi(listRoute, async (c) =>
    c.json(
      await listDrafts(c.req.valid("param").workspaceId, c.get("userId")),
      200,
    ),
  )
  .openapi(createRouteDef, async (c) =>
    c.json(
      await createDraft(
        c.req.valid("param").workspaceId,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(updateRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(
      await updateDraft(workspaceId, id, c.get("userId"), c.req.valid("json")),
      200,
    );
  })
  .openapi(deleteRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await deleteDraft(workspaceId, id, c.get("userId")), 200);
  });

export default taskDraft;
