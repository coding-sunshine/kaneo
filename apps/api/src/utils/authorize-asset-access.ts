import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { loadChannel } from "../chat/controllers/load-channel";
import { loadDocument } from "../document/controllers/load-document";
import { findInaccessibleProjectIds } from "../project-access/find-inaccessible-project-ids";
import { resolveAssetBearerOrCookie } from "./authenticate-api-request";
import type { PermissionMap } from "./role-permissions";
import { validateWorkspaceAccess } from "./validate-workspace-access";
import { workspacePermissionGrants } from "./workspace-permission-grants";

type AssetAccessTarget = {
  workspaceId: string;
  /** The team of an issue's file. */
  projectId: string | null;
  /** The document a file belongs to, when it belongs to one. */
  documentId: string | null;
  /** The channel of the chat message a file was sent with. */
  chatChannelId?: string | null;
  isPublic: boolean | null;
  /** Archived workspaces keep members out and stop sharing public assets. */
  workspaceArchived?: boolean;
  surface: string;
  createdBy?: string | null;
};

/** Only description assets belong to the public project representation. */
export function isPublicAsset(asset: AssetAccessTarget): boolean {
  return asset.isPublic === true && asset.surface === "description";
}

// A document's file opens for whoever can open the document, and a chat file
// for whoever can read its channel. To everyone else it looks like a file that
// does not exist, so a refusal never tells them the document or the private
// channel is there. Neither is ever public or has a team to check.
async function authorizeOwnedFileAccess(
  c: Context,
  workspaceId: string,
  permissions: PermissionMap,
  canOpen: (userId: string) => Promise<unknown>,
): Promise<void> {
  try {
    const { userId, apiKeyId, apiKeyPermissions } =
      await resolveAssetBearerOrCookie(c);
    await validateWorkspaceAccess(userId, workspaceId, apiKeyId);
    const grants = await workspacePermissionGrants(userId, {
      apiKeyPermissions,
      workspaceIds: [workspaceId],
    });
    if (!grants.allows(workspaceId, permissions)) {
      throw new HTTPException(403, { message: "Forbidden" });
    }
    await canOpen(userId);
  } catch (error) {
    if (
      error instanceof HTTPException &&
      [401, 403, 404].includes(error.status)
    ) {
      throw new HTTPException(404, { message: "Asset not found" });
    }
    throw error;
  }
}

export async function authorizeAssetAccess(
  c: Context,
  asset: AssetAccessTarget,
): Promise<void> {
  const { workspaceId, documentId, chatChannelId } = asset;
  if (documentId) {
    return authorizeOwnedFileAccess(c, workspaceId, { task: ["read"] }, (id) =>
      loadDocument(workspaceId, documentId, id),
    );
  }
  if (chatChannelId) {
    return authorizeOwnedFileAccess(
      c,
      workspaceId,
      { workspace: ["read"] },
      (id) => loadChannel(workspaceId, chatChannelId, id, "read"),
    );
  }
  if (!asset.projectId) {
    throw new HTTPException(404, { message: "Asset not found" });
  }
  if (isPublicAsset(asset)) {
    if (!asset.workspaceArchived) return;
    throw new HTTPException(404, { message: "Asset not found" });
  }

  const { userId, apiKeyId, apiKeyPermissions } =
    await resolveAssetBearerOrCookie(c);
  await validateWorkspaceAccess(userId, asset.workspaceId, apiKeyId, {
    notFoundMessage: "Asset not found",
  });
  // A file in a team the caller cannot open looks like one that does not
  // exist, so its id never confirms the team or the issue is there.
  if ((await findInaccessibleProjectIds(userId, [asset.projectId])).length) {
    throw new HTTPException(404, { message: "Asset not found" });
  }
  if (asset.surface.startsWith("draft") && asset.createdBy !== userId)
    throw new HTTPException(403, {
      message: "Staged uploads are private to their owner",
    });
  const grants = await workspacePermissionGrants(userId, {
    apiKeyPermissions,
    workspaceIds: [asset.workspaceId],
  });
  // Drafts are the uploader's task-creation preview, before a task exists.
  const permissions = {
    task: [asset.surface.startsWith("draft") ? "create" : "read"],
  };
  if (!grants.allows(asset.workspaceId, permissions)) {
    throw new HTTPException(403, { message: "Insufficient asset permissions" });
  }
}
