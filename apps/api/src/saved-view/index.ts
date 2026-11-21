import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  createView,
  deleteView,
  getView,
  listViews,
  updateView,
} from "./controllers";
import {
  createViewBody,
  deletedViewSchema,
  savedViewListSchema,
  savedViewSchema,
  updateViewBody,
  viewParam,
  workspaceIdParam,
} from "./schema";

const body = <T extends import("zod").ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const noAccess = errorResponse("Missing permission for this workspace");
const tags = ["Views"];
const read = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ project: ["read"] }),
] as const;

const listRoute = createRoute({
  method: "get",
  operationId: "listViews",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "List views",
  description: "List a workspace's saved views, team and workspace scoped.",
  middleware: [...read] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Saved views", savedViewListSchema),
    403: noAccess,
  },
});

const getRoute = createRoute({
  method: "get",
  operationId: "getView",
  path: "/workspace/{workspaceId}/{id}",
  tags,
  summary: "Get view",
  description: "Get one saved view.",
  middleware: [...read] as const,
  request: { params: viewParam },
  responses: {
    200: jsonResponse("Saved view", savedViewSchema),
    403: noAccess,
    404: errorResponse("View not found"),
  },
});

const createRouteDef = createRoute({
  method: "post",
  operationId: "createView",
  path: "/",
  tags,
  summary: "Create view",
  description: "Save the current filters and display options as a view.",
  middleware: [
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { body: body(createViewBody) },
  responses: {
    200: jsonResponse("View created", savedViewSchema),
    400: errorResponse("Team not found"),
    403: noAccess,
  },
});

const updateRoute = createRoute({
  method: "put",
  operationId: "updateView",
  path: "/workspace/{workspaceId}/{id}",
  tags,
  summary: "Update view",
  description: "Rename a view or replace its filters and display options.",
  middleware: [...read] as const,
  request: { params: viewParam, body: body(updateViewBody) },
  responses: {
    200: jsonResponse("View updated", savedViewSchema),
    403: noAccess,
    404: errorResponse("View not found"),
  },
});

const deleteRoute = createRoute({
  method: "delete",
  operationId: "deleteView",
  path: "/workspace/{workspaceId}/{id}",
  tags,
  summary: "Delete view",
  description: "Delete a view you own.",
  middleware: [...read] as const,
  request: { params: viewParam },
  responses: {
    200: jsonResponse("View deleted", deletedViewSchema),
    403: noAccess,
    404: errorResponse("View not found"),
  },
});

const savedView = apiRouter()
  .openapi(listRoute, async (c) =>
    c.json(await listViews(c.req.valid("param").workspaceId), 200),
  )
  .openapi(getRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await getView(workspaceId, id), 200);
  })
  .openapi(createRouteDef, async (c) =>
    c.json(await createView(c.get("userId"), c.req.valid("json")), 200),
  )
  .openapi(updateRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(
      await updateView(workspaceId, id, c.get("userId"), c.req.valid("json")),
      200,
    );
  })
  .openapi(deleteRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await deleteView(workspaceId, id, c.get("userId")), 200);
  });

export default savedView;
