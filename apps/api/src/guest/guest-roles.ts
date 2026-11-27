// The roles a guest may hold. Anything that manages the workspace is out.
const GUEST_ROLES = new Set(["member", "viewer"]);

export function isGuestRole(role: string | null | undefined) {
  return typeof role === "string" && GUEST_ROLES.has(role);
}
