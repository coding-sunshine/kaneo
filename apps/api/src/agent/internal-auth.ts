import { eq } from "drizzle-orm";
import db, { schema } from "../database";

// Background runs (loops) act as their creator without any credential on the
// wire: the Request object itself is marked here, in process memory. A request
// that arrives over the network is a different object, so no header, cookie or
// key an outside caller sends can ever reach this path.
const internalRequests = new WeakMap<Request, string>();

export function markInternalRequest(request: Request, userId: string) {
  internalRequests.set(request, userId);
}

// Middleware that rebuilds the Request (client IP, bounded body) passes the mark
// on to the copy, so it is still there when authentication looks it up.
export function carryInternalMark(from: Request, to: Request): Request {
  const userId = internalRequests.get(from);
  if (userId) internalRequests.set(to, userId);
  return to;
}

// Resolves the user an internal request acts as, or null when the request is
// not internal. A banned or deleted user is rejected rather than falling through.
export async function resolveInternalUser(
  request: Request,
): Promise<string | null | "invalid"> {
  const userId = internalRequests.get(request);
  if (!userId) return null;
  const [user] = await db
    .select({ banned: schema.userTable.banned })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  return user && !user.banned ? userId : "invalid";
}
