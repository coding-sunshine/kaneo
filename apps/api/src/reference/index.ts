import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { loadDocument } from "../document/controllers/load-document";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { getReferences } from "./controllers/get-references";
import { referenceListSchema } from "./response";
import { documentParam, projectIdParam, taskIdParam } from "./schema";

const tags = ["References"];
const listed = jsonResponse(
  "Tasks and documents whose text names the target, each once",
  referenceListSchema,
);
const sources =
  "Each source is listed once with the places it names the target in. Sources the caller cannot open are left out.";

const taskReferencesRoute = createRoute({
  method: "get",
  operationId: "getTaskReferences",
  path: "/task/{taskId}",
  tags,
  summary: "Get a task's references",
  description: `List the tasks and documents whose text links to the task or types its key. ${sources}`,
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: taskIdParam },
  responses: {
    200: listed,
    403: errorResponse("No access to the project, or missing task:read"),
    404: errorResponse("Task not found"),
  },
});

const projectReferencesRoute = createRoute({
  method: "get",
  operationId: "getProjectReferences",
  path: "/project/{projectId}",
  tags,
  summary: "Get a project's references",
  description: `List the tasks and documents whose text links to the project. ${sources}`,
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: projectIdParam },
  responses: {
    200: listed,
    403: errorResponse("No access to the project, or missing task:read"),
    404: errorResponse("Project not found"),
  },
});

const documentReferencesRoute = createRoute({
  method: "get",
  operationId: "getDocumentReferences",
  path: "/workspace/{workspaceId}/document/{documentId}",
  tags,
  summary: "Get a document's references",
  description: `List the tasks and documents whose text links to the document. ${sources}`,
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: documentParam },
  responses: {
    200: listed,
    403: errorResponse("Missing permission for this workspace"),
    404: errorResponse("Document not found"),
  },
});

const reference = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(taskReferencesRoute, async (c) =>
    c.json(
      await getReferences(
        c.get("workspaceId"),
        { taskId: c.req.valid("param").taskId },
        c.get("userId"),
      ),
      200,
    ),
  )
  .openapi(projectReferencesRoute, async (c) =>
    c.json(
      await getReferences(
        c.get("workspaceId"),
        { projectId: c.req.valid("param").projectId },
        c.get("userId"),
      ),
      200,
    ),
  )
  .openapi(documentReferencesRoute, async (c) => {
    const { workspaceId, documentId } = c.req.valid("param");
    const userId = c.get("userId");
    // 404s when the caller cannot see the document.
    await loadDocument(workspaceId, documentId, userId);
    return c.json(
      await getReferences(workspaceId, { documentId }, userId),
      200,
    );
  });

export default reference;
