type SessionResult = {
  session: { twoFactorSetupRequired?: boolean | null };
  user: { twoFactorEnabled?: boolean | null };
};

/** A session that may only set two-factor up before it can do anything else. */
export function isTwoFactorSetupPending(result: SessionResult | null) {
  return Boolean(
    result?.session.twoFactorSetupRequired && !result.user.twoFactorEnabled,
  );
}

const SETUP_PREFIXES = ["/two-factor/", "/sign-in/", "/sign-up/"];
const SETUP_PATHS = new Set(["/get-session", "/sign-out"]);

/** Auth routes, without `/api/auth`, a setup-only session may still call. */
export function isTwoFactorSetupPath(path: string) {
  return (
    SETUP_PATHS.has(path) ||
    SETUP_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

export const TWO_FACTOR_SETUP_REQUIRED = {
  code: "TWO_FACTOR_SETUP_REQUIRED",
  message: "Set up two-factor sign-in to continue.",
} as const;
