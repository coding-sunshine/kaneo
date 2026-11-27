import type { ZodType } from "zod";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { deleteTemplate } from "./controllers/delete-template";
import { listTemplates } from "./controllers/list-templates";
import { saveTemplate } from "./controllers/save-template";
import {
  documentTemplateListSchema,
  documentTemplateSchema,
  saveTemplateBody,
  templateParam,
  workspaceIdParam,
} from "./schema";

const body = <T extends ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const tags = ["Document Templates"];
const noAccess = errorResponse("Missing permission for this workspace");

const listRoute = createRoute({
  method: "get",
  operationId: "listDocumentTemplates",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "List document templates",
  description:
    "List the templates saved in the workspace. Every member sees all of them.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Document templates", documentTemplateListSchema),
    403: noAccess,
  },
});

const saveRoute = createRoute({
  method: "post",
  operationId: "saveDocumentTemplate",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "Save a page as a template",
  description:
    "Copy the title and text of a page open to the whole workspace into a template every member can start a document from. Later edits to the page leave the template as it is.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: { params: workspaceIdParam, body: body(saveTemplateBody) },
  responses: {
    200: jsonResponse("Template saved", documentTemplateSchema),
    403: errorResponse(
      "Missing permission, or the page is not open to the whole workspace",
    ),
    404: errorResponse("Document not found"),
  },
});

const deleteRoute = createRoute({
  method: "delete",
  operationId: "deleteDocumentTemplate",
  path: "/workspace/{workspaceId}/{id}",
  tags,
  summary: "Delete a document template",
  description:
    "Delete a template. Its creator or a workspace owner may. Documents made from it stay.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: templateParam },
  responses: {
    200: jsonResponse("Template deleted", documentTemplateSchema),
    403: errorResponse("Not the creator of the template or a workspace owner"),
    404: errorResponse("Template not found"),
  },
});

const documentTemplate = apiRouter()
  .openapi(listRoute, async (c) =>
    c.json(await listTemplates(c.req.valid("param").workspaceId), 200),
  )
  .openapi(saveRoute, async (c) =>
    c.json(
      await saveTemplate(
        c.req.valid("param").workspaceId,
        c.get("userId"),
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(deleteRoute, async (c) => {
    const { workspaceId, id } = c.req.valid("param");
    return c.json(await deleteTemplate(workspaceId, id, c.get("userId")), 200);
  });

export default documentTemplate;
