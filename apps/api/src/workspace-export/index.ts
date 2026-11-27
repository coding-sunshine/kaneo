import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { workspaceTable } from "../database/schema";
import { fileSlug } from "../export/file-slug";
import { isWorkspaceGuest } from "../guest/is-workspace-guest";
import { apiRouter, createRoute, errorResponse, z } from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { takeExportLease } from "./export-lease";
import { toReadableStream } from "./to-readable-stream";
import { workspaceExportEntries } from "./workspace-export-entries";
import { zipChunks } from "./zip-chunks";

const exportRoute = createRoute({
  method: "get",
  operationId: "exportWorkspace",
  path: "/{workspaceId}",
  tags: ["Workspaces"],
  summary: "Export workspace",
  description:
    "Download a zip of the workspace's tickets, documents, channel messages and members, each as JSON and as Markdown, with a manifest of the counts. Holds what the caller can open in the app. Admins and owners only, from a signed-in session (not an API key). The zip is streamed. One export runs at a time per workspace, at most one a minute; others get 429 with Retry-After.",
  middleware: [
    requireUserSession,
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: z.object({ workspaceId: z.string() }) },
  responses: {
    200: {
      description: "The export as a zip file, streamed",
      content: {
        "application/zip": { schema: z.string().openapi({ format: "binary" }) },
      },
    },
    401: errorResponse("Authentication required"),
    403: errorResponse(
      "Missing workspace:manage_settings, a guest, or an API key",
    ),
    404: errorResponse("Workspace not found"),
    429: errorResponse("An export of this workspace is running or just ran"),
  },
});

const workspaceExport = apiRouter().openapi(exportRoute, async (c) => {
  const { workspaceId } = c.req.valid("param");
  const userId = c.get("userId");
  const [workspace] = await db
    .select({ id: workspaceTable.id, name: workspaceTable.name })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId));
  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }
  const guest = await isWorkspaceGuest(workspaceId, userId);
  const release = await takeExportLease(workspaceId);
  const exportedAt = new Date();
  const entries = workspaceExportEntries(
    { workspaceId, userId, guest },
    workspace,
    exportedAt,
  );
  c.header("Content-Type", "application/zip");
  c.header(
    "Content-Disposition",
    `attachment; filename="${fileSlug(workspace.name, "workspace")}-export.zip"`,
  );
  c.header("Cache-Control", "private, no-store");
  c.header("X-Content-Type-Options", "nosniff");
  return c.body(toReadableStream(zipChunks(entries, exportedAt), release), 200);
});

export default workspaceExport;
