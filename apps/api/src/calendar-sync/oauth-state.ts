import { oauthStateCookie } from "../utils/oauth-state-cookie";

export const calendarOAuthState = oauthStateCookie<{
  provider: string;
  returnTo: string;
  timeZone: string;
}>("kaneo_calendar_sync_oauth", "/api/calendar-sync");
