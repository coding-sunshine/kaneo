import { and, eq, like } from "drizzle-orm";
import db, { schema } from "../../database";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { findAdminTargetUser } from "../find-admin-target-user";

/**
 * Turn off a user's two-factor so a lost device is not a permanent lock-out:
 * the authenticator secret, recovery codes and remembered devices go. If the
 * instance requires two-factor, their next sign-in asks them to set it up.
 */
async function resetUserTwoFactor(userId: string, audit: AdminAuditRequest) {
  await db.transaction(async (tx) => {
    const user = await findAdminTargetUser(tx, userId);
    const secrets = await tx
      .delete(schema.twoFactorTable)
      .where(eq(schema.twoFactorTable.userId, userId))
      .returning({ id: schema.twoFactorTable.id });
    const [turnedOff] = await tx
      .update(schema.userTable)
      .set({ twoFactorEnabled: false })
      .where(
        and(
          eq(schema.userTable.id, userId),
          eq(schema.userTable.twoFactorEnabled, true),
        ),
      )
      .returning({ id: schema.userTable.id });
    // Better Auth stores each remembered device as `trust-device-<random>`.
    await tx
      .delete(schema.verificationTable)
      .where(
        and(
          like(schema.verificationTable.identifier, "trust-device-%"),
          eq(schema.verificationTable.value, userId),
        ),
      );
    if (!turnedOff && secrets.length === 0) return;

    await recordAdminAction(
      {
        ...audit,
        action: "user.two_factor_reset",
        targetType: "user",
        targetId: user.id,
        targetLabel: user.email,
      },
      tx,
    );
  });
  return { twoFactorEnabled: false as const };
}

export default resetUserTwoFactor;
