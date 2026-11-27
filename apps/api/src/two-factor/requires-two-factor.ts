import { and, eq } from "drizzle-orm";
import db from "../database";
import { accountTable, userTable } from "../database/schema";
import { getInstanceSettings } from "../instance-settings/get-instance-settings";

/**
 * Whether the instance requires two-factor of this user: only people with a
 * password can set it up, so users of email codes or a provider are not held.
 */
export async function requiresTwoFactor(userId: string) {
  if (!(await getInstanceSettings()).requireTwoFactor) return false;
  const [row] = await db
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.userId, userId),
        eq(accountTable.providerId, "credential"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Stamped on each new session of a required user who has no two-factor yet. */
export async function needsTwoFactorSetup(userId: string) {
  if (!(await requiresTwoFactor(userId))) return false;
  const [user] = await db
    .select({ enabled: userTable.twoFactorEnabled })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return !user?.enabled;
}
