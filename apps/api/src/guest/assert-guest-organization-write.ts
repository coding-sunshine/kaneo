import { APIError } from "better-auth/api";
import {
  type OrganizationContext,
  type OrganizationViewer,
  resolveTarget,
} from "../workspace/archive/assert-native-organization-active";
import { isWorkspaceGuest } from "./is-workspace-guest";

// Better Auth checks these against the role alone, and a workspace can edit
// what its member and viewer roles may do. A guest never changes the
// workspace's people, teams, roles or settings, whatever their role says.
const CLOSED_TO_GUESTS = new Set([
  "/organization/update",
  "/organization/delete",
  "/organization/invite-member",
  "/organization/cancel-invitation",
  "/organization/add-member",
  "/organization/remove-member",
  "/organization/update-member-role",
  "/organization/create-team",
  "/organization/update-team",
  "/organization/remove-team",
  "/organization/add-team-member",
  "/organization/remove-team-member",
  "/organization/create-role",
  "/organization/update-role",
  "/organization/delete-role",
]);

export async function assertGuestOrganizationWrite(
  ctx: OrganizationContext,
  viewer: OrganizationViewer,
) {
  if (!viewer || !CLOSED_TO_GUESTS.has(ctx.path ?? "")) return;
  const target = await resolveTarget(ctx, viewer);
  if (target && (await isWorkspaceGuest(target.workspaceId, viewer.user.id))) {
    throw new APIError("FORBIDDEN", {
      code: "GUEST_LIMIT",
      message: "Guests cannot change the workspace's people or settings",
    });
  }
}
