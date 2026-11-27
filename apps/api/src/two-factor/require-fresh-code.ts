import { APIError } from "better-auth/api";

/**
 * Routes that hand out the authenticator secret or new recovery codes, or
 * turn two-factor off.
 */
export const FRESH_CODE_PATHS = new Set([
  "/two-factor/get-totp-uri",
  "/two-factor/generate-backup-codes",
  "/two-factor/disable",
]);

export type FreshCodeRefusal = {
  code: "TWO_FACTOR_CODE_REQUIRED" | "INVALID_TWO_FACTOR_CODE";
  message: string;
};

type CodeCheck = (input: {
  body: { code: string };
  headers: Headers;
}) => Promise<unknown>;

/**
 * Checks a code from the caller's own second factor with their session: six
 * digits are an authenticator code, anything else a recovery code, which is
 * used up like at sign-in.
 */
export function verifyOwnCode(
  api: { verifyTOTP: CodeCheck; verifyBackupCode: CodeCheck },
  headers: Headers,
) {
  return (code: string) =>
    /^\d{6}$/.test(code)
      ? api.verifyTOTP({ body: { code }, headers })
      : api.verifyBackupCode({ body: { code }, headers });
}

/**
 * Once two-factor is on, the password or session alone must not reveal its
 * secret, mint recovery codes, turn it off, or reset someone else's: the
 * request also carries a current code, checked by `verify`.
 */
export async function requireFreshCode(
  code: unknown,
  verify: (code: string) => Promise<unknown>,
  refuse: (refusal: FreshCodeRefusal) => Error = (refusal) =>
    new APIError("FORBIDDEN", refusal),
) {
  if (typeof code !== "string" || !code.trim()) {
    throw refuse({
      code: "TWO_FACTOR_CODE_REQUIRED",
      message: "Enter a code from your authenticator app or a recovery code.",
    });
  }
  try {
    await verify(code.trim());
  } catch {
    throw refuse({
      code: "INVALID_TWO_FACTOR_CODE",
      message: "That code is not valid. Try the current one.",
    });
  }
}
