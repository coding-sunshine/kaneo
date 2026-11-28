import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { apiBaseUrl } from "../utils/api-base-url";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { listFiles } from "./controllers/list-files";
import { fileListSchema, listFilesQuery, workspaceIdParam } from "./schema";

const listFilesRoute = createRoute({
  method: "get",
  operationId: "listLibraryFiles",
  path: "/workspace/{workspaceId}/files",
  tags: ["Files"],
  summary: "List files",
  description:
    "Files uploaded in the workspace that you can open, newest first: ticket attachments in teams you can enter, files of documents you can open, and files sent in channels and direct messages you can read. Each comes with who added it and where. Pictures pasted into a ticket's text and uploads not yet saved are left out. At most 200.",
  middleware: [
    workspaceAccess.fromParam(),
    // Ticket and document files need issue read access, chat files the
    // workspace read access every chat route asks for.
    requireWorkspacePermission({ task: ["read"], workspace: ["read"] }),
  ] as const,
  request: { params: workspaceIdParam, query: listFilesQuery },
  responses: {
    200: jsonResponse("Files", fileListSchema),
    403: errorResponse("Missing permission for this workspace"),
    404: errorResponse("Workspace not found"),
  },
});

const fileLibrary = apiRouter().openapi(listFilesRoute, async (c) => {
  const { workspaceId } = c.req.valid("param");
  return c.json(
    await listFiles(
      workspaceId,
      c.get("userId"),
      c.req.valid("query").q,
      apiBaseUrl(c.req.url),
    ),
    200,
  );
});

export default fileLibrary;
