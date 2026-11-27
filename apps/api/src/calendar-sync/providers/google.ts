import { randomUUID } from "node:crypto";
import { shiftDate } from "./calendar-dates";
import { CalendarApiError, calendarRequest, requestToken } from "./http";
import type { CalendarProvider, EventInput, ExternalEvent } from "./types";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
];
const MAX_PAGES = 10;

type GoogleTime = { date?: string; dateTime?: string };
type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  start: GoogleTime;
  end: GoogleTime;
  htmlLink?: string;
  hangoutLink?: string;
  location?: string;
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
};

function toEvent(event: GoogleEvent): ExternalEvent {
  const allDay = Boolean(event.start.date);
  const video = event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === "video",
  )?.uri;
  return {
    id: event.id,
    provider: "google",
    title: event.summary ?? null,
    start: allDay
      ? (event.start.date as string)
      : new Date(event.start.dateTime as string).toISOString(),
    // Google's all-day end date is exclusive.
    end: allDay
      ? shiftDate(event.end.date as string, -1)
      : new Date(event.end.dateTime as string).toISOString(),
    allDay,
    meetingUrl:
      event.hangoutLink ??
      video ??
      (event.location?.startsWith("https://") ? event.location : null),
    url: event.htmlLink ?? null,
  };
}

function toBody(input: EventInput) {
  return {
    summary: input.title,
    description: input.description ?? "",
    ...(input.meetingUrl ? { location: input.meetingUrl } : {}),
    start: input.allDay ? { date: input.start } : { dateTime: input.start },
    end: input.allDay
      ? { date: shiftDate(input.end, 1) }
      : { dateTime: input.end },
  };
}

const eventUrl = (id: string) => `${EVENTS_URL}/${encodeURIComponent(id)}`;

export const googleCalendar: CalendarProvider = {
  authorizeUrl(client, redirectUri, state) {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", client.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES.join(" "));
    // Without both, Google issues no refresh token after the first consent.
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);
    return url.toString();
  },

  exchangeCode(client, code, redirectUri) {
    return requestToken(TOKEN_URL, {
      client_id: client.clientId,
      client_secret: client.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
  },

  refresh(client, refreshToken) {
    return requestToken(TOKEN_URL, {
      client_id: client.clientId,
      client_secret: client.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
  },

  async accountEmail(token) {
    const profile = await calendarRequest<{ email?: string }>(USERINFO_URL, {
      token,
    });
    return profile?.email ?? null;
  },

  async listEvents(token, from, to) {
    const events: ExternalEvent[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(EVENTS_URL);
      url.searchParams.set("timeMin", from.toISOString());
      url.searchParams.set("timeMax", to.toISOString());
      // Expands recurring series into their occurrences.
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", "250");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const body = await calendarRequest<{
        items?: GoogleEvent[];
        nextPageToken?: string;
      }>(url.toString(), { token });
      for (const item of body?.items ?? []) {
        if (item.status !== "cancelled") events.push(toEvent(item));
      }
      pageToken = body?.nextPageToken;
      if (!pageToken) break;
    }
    return events;
  },

  async createEvent(token, input) {
    const url = new URL(EVENTS_URL);
    const body: Record<string, unknown> = toBody(input);
    if (input.addMeeting) {
      // Google ignores conferenceData unless this version is sent.
      url.searchParams.set("conferenceDataVersion", "1");
      body.conferenceData = {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }
    const created = await calendarRequest<GoogleEvent>(url.toString(), {
      token,
      method: "POST",
      body,
    });
    if (!created) throw new CalendarApiError(502, "Google returned no event");
    return toEvent(created);
  },

  async updateEvent(token, id, input) {
    await calendarRequest(eventUrl(id), {
      token,
      method: "PATCH",
      body: toBody(input),
    });
  },

  async deleteEvent(token, id) {
    try {
      await calendarRequest(eventUrl(id), { token, method: "DELETE" });
    } catch (error) {
      // 410: already deleted; 404: never existed or removed by the person.
      if (
        !(error instanceof CalendarApiError) ||
        (error.status !== 404 && error.status !== 410)
      ) {
        throw error;
      }
    }
  },
};
