import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  createIssueTemplate,
  deleteIssueTemplate,
  listIssueTemplates,
  updateIssueTemplate,
} from "./controllers/issue-template-ctrl";
import { issueTemplateListSchema, issueTemplateSchema } from "./response";
import {
  createIssueTemplateBody,
  projectIdParam,
  templateIdParam,
  updateIssueTemplateBody,
} from "./schema";

const forbidden = errorResponse(
  "No access to the team, or missing project:update permission",
);

const listRoute = createRoute({
  method: "get",
  operationId: "getIssueTemplatesByProject",
  path: "/project/{projectId}",
  tags: ["Issue Templates"],
  summary: "List issue templates",
  description: "List a team's issue templates.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["read"] }),
  ] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("The team's issue templates", issueTemplateListSchema),
    403: errorResponse("No access to the team, or missing read permission"),
    404: errorResponse("Project not found"),
  },
});

const createRouteDef = createRoute({
  method: "post",
  operationId: "createIssueTemplate",
  path: "/",
  tags: ["Issue Templates"],
  summary: "Create issue template",
  description:
    "Create an issue template for a team. Requires project:update permission.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createIssueTemplateBody } },
    },
  },
  responses: {
    200: jsonResponse("The created template", issueTemplateSchema),
    400: errorResponse("Invalid body, or status not in this team"),
    403: forbidden,
    404: errorResponse("Project not found"),
  },
});

const updateRoute = createRoute({
  method: "put",
  operationId: "updateIssueTemplate",
  path: "/{id}",
  tags: ["Issue Templates"],
  summary: "Update issue template",
  description: "Update an issue template. Requires project:update permission.",
  middleware: [
    workspaceAccess.fromIssueTemplate("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: templateIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateIssueTemplateBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated template", issueTemplateSchema),
    400: errorResponse("Invalid body, or status not in this team"),
    403: forbidden,
    404: errorResponse("Template not found"),
  },
});

const deleteRoute = createRoute({
  method: "delete",
  operationId: "deleteIssueTemplate",
  path: "/{id}",
  tags: ["Issue Templates"],
  summary: "Delete issue template",
  description: "Delete an issue template. Requires project:update permission.",
  middleware: [
    workspaceAccess.fromIssueTemplate("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: templateIdParam },
  responses: {
    200: jsonResponse("The deleted template", issueTemplateSchema),
    403: forbidden,
    404: errorResponse("Template not found"),
  },
});

const issueTemplate = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listRoute, async (c) =>
    c.json(await listIssueTemplates(c.req.valid("param").projectId), 200),
  )
  .openapi(createRouteDef, async (c) => {
    const { projectId, ...input } = c.req.valid("json");
    return c.json(
      await createIssueTemplate(c.get("workspaceId"), projectId, input),
      200,
    );
  })
  .openapi(updateRoute, async (c) =>
    c.json(
      await updateIssueTemplate(
        c.get("workspaceId"),
        c.req.valid("param").id,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(deleteRoute, async (c) =>
    c.json(await deleteIssueTemplate(c.req.valid("param").id), 200),
  );

export default issueTemplate;
