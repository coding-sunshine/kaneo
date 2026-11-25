// An assistant token the person limited to documents carries this value in
// `session.mcp_scope`. Such a session reads what its person can read, on the
// routers listed below, and changes only documents and topics.
export const DOCUMENTS_SCOPE = "docs:write";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const WRITE_PREFIXES = ["/api/document", "/api/topic"];
// The routers the assistant tools read. A read anywhere else is refused,
// because some GET handlers write (cycles, billing, a GitHub connection) or
// return a credential. A new read tool on another router needs its prefix here.
const READ_PREFIXES = [
  ...WRITE_PREFIXES,
  "/api/activity",
  "/api/column",
  "/api/comment",
  "/api/custom-field",
  "/api/label",
  "/api/notification",
  "/api/project",
  "/api/search",
  "/api/task",
  "/api/task-relation",
  "/api/time-entry",
  "/api/user/me",
  "/api/workspace",
];
// Everything else under /api/auth can mint or reveal a full session: a new
// API key, a device approval, the list of the person's other session tokens.
const AUTH_ALLOWED = new Set([
  "GET /api/auth/get-session",
  "GET /api/auth/organization/list",
  "POST /api/auth/sign-out",
]);

function isUnder(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Whether a session limited to documents may send this request. */
export function scopedSessionAllows(method: string, path: string): boolean {
  const verb = method.toUpperCase();
  if (isUnder(path, "/api/auth")) return AUTH_ALLOWED.has(`${verb} ${path}`);
  const prefixes = READ_METHODS.has(verb) ? READ_PREFIXES : WRITE_PREFIXES;
  return prefixes.some((prefix) => isUnder(path, prefix));
}
