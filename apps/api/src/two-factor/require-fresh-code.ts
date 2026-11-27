import { APIError } from "better-auth/api";
import {
  clearWrongCodes,
  isCodeEntryLocked,
  recordWrongCode,
} from "./fresh-code-lockout";

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
  status: 403 | 429;
  code:
    | "TWO_FACTOR_CODE_REQUIRED"
    | "INVALID_TWO_FACTOR_CODE"
    | "TWO_FACTOR_CODE_LOCKED";
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

const refuseForAuth = ({ status, ...body }: FreshCodeRefusal) =>
  new APIError(status === 429 ? "TOO_MANY_REQUESTS" : "FORBIDDEN", body);

/**
 * Once two-factor is on, the password or session alone must not reveal its
 * secret, mint recovery codes, turn it off, or reset someone else's: the
 * request also carries a current code of `userId`, checked by `verify`.
 * Wrong codes count toward the same lockout as sign-in codes.
 */
export async function requireFreshCode(
  userId: string,
  code: unknown,
  verify: (code: string) => Promise<unknown>,
  refuse: (refusal: FreshCodeRefusal) => Error = refuseForAuth,
) {
  if (typeof code !== "string" || !code.trim()) {
    throw refuse({
      status: 403,
      code: "TWO_FACTOR_CODE_REQUIRED",
      message: "Enter a code from your authenticator app or a recovery code.",
    });
  }
  if (await isCodeEntryLocked(userId)) {
    throw refuse({
      status: 429,
      code: "TWO_FACTOR_CODE_LOCKED",
      message: "Too many wrong codes. Try again in 15 minutes.",
    });
  }
  try {
    await verify(code.trim());
  } catch {
    await recordWrongCode(userId);
    throw refuse({
      status: 403,
      code: "INVALID_TWO_FACTOR_CODE",
      message: "That code is not valid. Try the current one.",
    });
  }
  await clearWrongCodes(userId);
}
