import type { Context } from "hono";
import { ApiError } from "../../errors/api-error";
import { publishEvent } from "../../events";
import {
  getCalendarCallbackUrl,
  getCalendarOAuthClient,
  getClientUrl,
} from "../config";
import { saveConnection } from "../connection";
import { calendarOAuthState } from "../oauth-state";
import { calendarProviders } from "../providers";
import { CalendarApiError } from "../providers/http";
import type { CalendarProviderId } from "../providers/types";
import { notConfigured } from "./connect";

export async function callback(
  c: Context,
  provider: CalendarProviderId,
  query: { code?: string; state?: string },
) {
  const userId = c.get("userId");
  const saved = calendarOAuthState.consume(c, userId, query.state);
  if (!saved || saved.provider !== provider) {
    throw new ApiError(400, {
      message: "The calendar sign-in expired or did not start here. Try again.",
      code: "CALENDAR_OAUTH_STATE_INVALID",
    });
  }
  const client = getCalendarOAuthClient(provider);
  if (!client) throw notConfigured();
  const back = c.redirect(`${getClientUrl()}${saved.returnTo}`, 302);
  // The person declined at the provider: nothing to store.
  if (!query.code) return back;

  try {
    const api = calendarProviders[provider];
    const token = await api.exchangeCode(
      client,
      query.code,
      getCalendarCallbackUrl(provider),
    );
    const email = await api.accountEmail(token.accessToken);
    await saveConnection(userId, provider, token, email, saved.timeZone);
  } catch (error) {
    if (!(error instanceof CalendarApiError)) throw error;
    throw new ApiError(502, {
      message: "The calendar provider did not accept the sign-in. Try again.",
      code: "CALENDAR_OAUTH_FAILED",
    });
  }
  // Writes the person's existing due dates without holding up the redirect.
  await publishEvent("calendar-sync.connected", { userId });
  return back;
}
