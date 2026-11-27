import type { Context } from "hono";
import { ApiError } from "../../errors/api-error";
import {
  getCalendarCallbackUrl,
  getCalendarOAuthClient,
  safeReturnPath,
} from "../config";
import { calendarOAuthState } from "../oauth-state";
import { calendarProviders } from "../providers";
import type { CalendarProviderId } from "../providers/types";
import { isTimeZone } from "../schema";

export function notConfigured() {
  return new ApiError(404, {
    message: "Calendar sync is not configured on this instance",
    code: "CALENDAR_NOT_CONFIGURED",
  });
}

export function connect(
  c: Context,
  provider: CalendarProviderId,
  query: { returnTo?: string; timeZone?: string },
) {
  const client = getCalendarOAuthClient(provider);
  if (!client) throw notConfigured();
  const state = calendarOAuthState.start(c, c.get("userId"), {
    provider,
    returnTo: safeReturnPath(query.returnTo),
    timeZone:
      query.timeZone && isTimeZone(query.timeZone) ? query.timeZone : "UTC",
  });
  return c.redirect(
    calendarProviders[provider].authorizeUrl(
      client,
      getCalendarCallbackUrl(provider),
      state,
    ),
    302,
  );
}
