import { apiRouter, createRoute, errorResponse, z } from "../openapi";
import { fileSlug } from "../export/file-slug";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { buildWorkspaceZip } from "./build-workspace-zip";
import { collectWorkspaceExport } from "./collect-workspace-export";

const exportRoute = createRoute({
  method: "get",
  operationId: "exportWorkspace",
  path: "/{workspaceId}",
  tags: ["Workspaces"],
  summary: "Export workspace",
  description:
    "Download a zip of the workspace's tickets, documents, channel messages and members, each as JSON and as Markdown, with a manifest of the counts. Holds what the caller can open in the app. Admins and owners only.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: z.object({ workspaceId: z.string() }) },
  responses: {
    200: {
      description: "The export as a zip file",
      content: {
        "application/zip": { schema: z.string().openapi({ format: "binary" }) },
      },
    },
    401: errorResponse("Authentication required"),
    403: errorResponse("Missing workspace:manage_settings"),
    404: errorResponse("Workspace not found"),
  },
});

const workspaceExport = apiRouter().openapi(exportRoute, async (c) => {
  const data = await collectWorkspaceExport(
    c.req.valid("param").workspaceId,
    c.get("userId"),
  );
  const zip = buildWorkspaceZip(data, new Date());
  c.header("Content-Type", "application/zip");
  c.header(
    "Content-Disposition",
    `attachment; filename="${fileSlug(data.workspace.name, "workspace")}-export.zip"`,
  );
  c.header("Cache-Control", "private, no-store");
  c.header("X-Content-Type-Options", "nosniff");
  return c.body(zip, 200);
});

export default workspaceExport;
