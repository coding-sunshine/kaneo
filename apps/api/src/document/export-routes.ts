import { createRoute, errorResponse, z } from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { documentParam } from "./schema";

export const exportDocumentQuery = z.object({
  format: z.enum(["markdown", "pdf"]).openapi({
    description: "markdown for a .md file, pdf for a printable file.",
  }),
});

export const exportDocumentRoute = createRoute({
  method: "get",
  operationId: "exportDocument",
  path: "/workspace/{workspaceId}/{id}/export",
  tags: ["Documents"],
  summary: "Export document",
  description:
    "Download a document you can open as Markdown or PDF. The title comes first, as the top heading.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: documentParam, query: exportDocumentQuery },
  responses: {
    200: {
      description: "The document file",
      content: {
        "text/markdown": { schema: z.string() },
        "application/pdf": { schema: z.string().openapi({ format: "binary" }) },
      },
    },
    403: errorResponse("Missing permission for this workspace or document"),
    404: errorResponse("Document not found"),
  },
});
