import { resolveFileSecret } from "../utils/file-secret";
import type { CalendarProviderId, OAuthClient } from "./providers/types";

const ENV_PREFIX: Record<CalendarProviderId, string> = {
  google: "GOOGLE_CALENDAR",
  microsoft: "MICROSOFT_CALENDAR",
};

// Read per call so a deployment can add the keys without code changes.
// Separate from GOOGLE_CLIENT_ID, which turns on Google sign-in.
export function getCalendarOAuthClient(
  provider: CalendarProviderId,
): OAuthClient | null {
  const prefix = ENV_PREFIX[provider];
  const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim();
  const clientSecret = resolveFileSecret(`${prefix}_CLIENT_SECRET`)?.trim();
  if (!clientId || !clientSecret) return null;
  const tenant = process.env[`${prefix}_TENANT`]?.trim() || "common";
  return { clientId, clientSecret, tenant };
}

export function isAnyCalendarConfigured() {
  return (
    getCalendarOAuthClient("google") !== null ||
    getCalendarOAuthClient("microsoft") !== null
  );
}

export function getCalendarCallbackUrl(provider: CalendarProviderId) {
  const apiUrl = (process.env.KANEO_API_URL || "http://localhost:1337")
    .replace(/\/api\/?$/, "")
    .replace(/\/+$/, "");
  return `${apiUrl}/api/calendar-sync/callback/${provider}`;
}

export function getClientUrl() {
  return (process.env.KANEO_CLIENT_URL || "http://localhost:5173").replace(
    /\/+$/,
    "",
  );
}

/** Only app-relative paths, so the callback cannot redirect off the web app. */
export function safeReturnPath(path: string | undefined) {
  return path && /^\/(?![/\\])/.test(path)
    ? path
    : "/dashboard/settings/account/calendar";
}

export function logMissingCalendarKeys() {
  const missing = (["google", "microsoft"] as const).filter(
    (provider) => !getCalendarOAuthClient(provider),
  );
  if (missing.length === 0) return;
  console.info(
    `Calendar sync is off for ${missing.join(" and ")}: set ${missing
      .map(
        (provider) =>
          `${ENV_PREFIX[provider]}_CLIENT_ID and ${ENV_PREFIX[provider]}_CLIENT_SECRET`,
      )
      .join(", ")} to turn it on.`,
  );
}
