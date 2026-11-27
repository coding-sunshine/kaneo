import { APIError } from "better-auth/api";

/** Routes that hand out the authenticator secret or new recovery codes. */
export const FRESH_CODE_PATHS = new Set([
  "/two-factor/get-totp-uri",
  "/two-factor/generate-backup-codes",
]);

/**
 * Once two-factor is on, the password alone must not reveal its secret or
 * mint new recovery codes: the request also carries a current authenticator
 * code, checked by `verify`. Codes are not accepted from recovery codes, so
 * a lost device goes through an instance administrator's reset.
 */
export async function requireFreshCode(
  code: unknown,
  verify: (code: string) => Promise<unknown>,
) {
  if (typeof code !== "string" || !code.trim()) {
    throw new APIError("FORBIDDEN", {
      code: "TWO_FACTOR_CODE_REQUIRED",
      message: "Enter a code from your authenticator app.",
    });
  }
  try {
    await verify(code.trim());
  } catch {
    throw new APIError("FORBIDDEN", {
      code: "INVALID_TWO_FACTOR_CODE",
      message: "That code is not valid. Try the current one.",
    });
  }
}
