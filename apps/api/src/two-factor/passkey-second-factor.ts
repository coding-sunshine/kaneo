import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import db from "../database";
import { passkeyTable, userTable } from "../database/schema";
import { requiresTwoFactor } from "./requires-two-factor";

/**
 * A passkey sign-in skips the two-factor step only because the passkey is
 * both factors: the device, and the PIN or biometric check that unlocked it.
 * A passkey that did not verify the person is one factor, so it is refused
 * for anyone who has two-factor on or is required to.
 */
export async function assertPasskeyIsSecondFactor({
  verification,
  clientData,
}: {
  verification: { authenticationInfo: { userVerified: boolean } };
  clientData: { id?: unknown };
}) {
  if (verification.authenticationInfo.userVerified) return;
  if (typeof clientData.id !== "string") return;
  const [owner] = await db
    .select({ id: userTable.id, enabled: userTable.twoFactorEnabled })
    .from(passkeyTable)
    .innerJoin(userTable, eq(userTable.id, passkeyTable.userId))
    .where(eq(passkeyTable.credentialID, clientData.id))
    .limit(1);
  if (!owner) return;
  if (owner.enabled || (await requiresTwoFactor(owner.id))) {
    throw new APIError("UNAUTHORIZED", {
      code: "PASSKEY_USER_VERIFICATION_REQUIRED",
      message:
        "This passkey didn't check your PIN or fingerprint, so it can't replace your two-factor code. Sign in with your password instead.",
    });
  }
}
