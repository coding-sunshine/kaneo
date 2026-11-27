import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { auth } from "../auth";
import db, { schema } from "../database";
import { ApiError } from "../errors/api-error";
import {
  requireFreshCode,
  verifyOwnCode,
} from "../two-factor/require-fresh-code";

/**
 * Taking away someone else's second factor needs the caller's own: a valid
 * admin session alone is not enough, so the caller must have two-factor on
 * and send a current authenticator or recovery code.
 */
export async function requireOwnTwoFactorCode(c: Context, code: string) {
  const actorId: string = c.get("user").id;
  const [actor] = await db
    .select({ twoFactorEnabled: schema.userTable.twoFactorEnabled })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, actorId));
  if (!actor?.twoFactorEnabled) {
    throw new ApiError(403, {
      code: "OWN_TWO_FACTOR_REQUIRED",
      message:
        "Turn on two-factor sign-in for your own account before resetting someone else's.",
    });
  }
  await requireFreshCode(
    actorId,
    code,
    verifyOwnCode(auth.api, c.req.raw.headers),
    ({ status, ...body }) => new ApiError(status, body),
  );
}
