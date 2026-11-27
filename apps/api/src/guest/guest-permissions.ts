import type { PermissionMap } from "../utils/role-permissions";
import { satisfies } from "../utils/role-permissions";

// The most a guest may do, whatever role they hold: work on tasks in their
// projects and read. No creating projects, inviting, or managing anything.
export const GUEST_PERMISSIONS = {
  project: ["read"],
  task: ["create", "read", "update"],
  label: ["read"],
  workspace: ["read"],
} as const satisfies Record<string, readonly string[]>;

export function guestAllows(permissions: PermissionMap) {
  return satisfies(GUEST_PERMISSIONS, permissions);
}
