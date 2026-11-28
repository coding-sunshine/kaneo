import { z } from "zod";
import { createRoute, errorResponse, jsonResponse } from "../../openapi";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { documentParam } from "../schema";

export const announceEditingRoute = createRoute({
  method: "post",
  operationId: "announceDocumentEditing",
  path: "/workspace/{workspaceId}/{id}/editing",
  tags: ["Documents"],
  summary: "Say you are editing",
  description:
    "Tells the document's other readers, over their live connection, that you are typing in it. Send it every few seconds while typing; a burst counts once.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: documentParam },
  responses: {
    200: jsonResponse(
      "Announced",
      z.object({ announced: z.boolean() }).openapi("DocumentEditingAnnounced"),
    ),
    403: errorResponse("Missing permission for this workspace or document"),
    404: errorResponse("Document not found"),
  },
});
