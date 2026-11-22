import { randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import db, { schema } from "../database";

// Process-local credential for background runs (loops). It is never stored or
// sent anywhere: only code in this process can build these headers, so a run
// acts as exactly the user it names, through the normal auth middleware.
const SECRET = randomBytes(32);
const SECRET_HEADER = "x-kaneo-internal-secret";
const USER_HEADER = "x-kaneo-internal-user";

export function internalAuthHeaders(userId: string): Headers {
  return new Headers({
    [SECRET_HEADER]: SECRET.toString("hex"),
    [USER_HEADER]: userId,
  });
}

// Resolves the user an internal request acts as, or null if the headers are
// absent. A wrong secret is rejected rather than falling through.
export async function resolveInternalUser(
  headers: Headers,
): Promise<string | null | "invalid"> {
  const secret = headers.get(SECRET_HEADER);
  if (secret === null) return null;
  const given = Buffer.from(secret, "hex");
  const userId = headers.get(USER_HEADER);
  if (
    given.length !== SECRET.length ||
    !timingSafeEqual(given, SECRET) ||
    !userId
  ) {
    return "invalid";
  }
  const [user] = await db
    .select({ banned: schema.userTable.banned })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  return user && !user.banned ? userId : "invalid";
}
