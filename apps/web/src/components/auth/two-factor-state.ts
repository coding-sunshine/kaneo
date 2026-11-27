/** A sign-in answered with a two-factor challenge instead of a session. */
export function isTwoFactorRedirect(data: unknown) {
  return Boolean(
    data &&
    typeof data === "object" &&
    (data as { twoFactorRedirect?: unknown }).twoFactorRedirect === true,
  );
}

type SessionState = {
  session?: { twoFactorSetupRequired?: boolean | null } | null;
  user?: { twoFactorEnabled?: boolean | null } | null;
} | null;

/** The instance requires two-factor and this session has to set it up first. */
export function needsTwoFactorSetup(session: SessionState) {
  return Boolean(
    session?.session?.twoFactorSetupRequired && !session.user?.twoFactorEnabled,
  );
}
