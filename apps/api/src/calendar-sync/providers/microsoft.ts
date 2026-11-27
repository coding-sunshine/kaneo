import { shiftDate } from "./calendar-dates";
import { CalendarApiError, calendarRequest, requestToken } from "./http";
import type { CalendarProvider, EventInput, ExternalEvent } from "./types";

const LOGIN_URL = "https://login.microsoftonline.com";
const GRAPH_URL = "https://graph.microsoft.com/v1.0";
// offline_access is what makes Microsoft issue a refresh token.
const SCOPES = "offline_access openid email User.Read Calendars.ReadWrite";
const MAX_PAGES = 20;

type GraphTime = { dateTime: string; timeZone?: string };
type GraphEvent = {
  id: string;
  subject?: string;
  start: GraphTime;
  end: GraphTime;
  isAllDay?: boolean;
  isCancelled?: boolean;
  webLink?: string;
  location?: { displayName?: string };
  onlineMeeting?: { joinUrl?: string } | null;
};

// calendarView is asked for UTC, which Graph writes without an offset.
const utc = (value: string) => new Date(`${value.slice(0, 19)}Z`).toISOString();

function toEvent(event: GraphEvent): ExternalEvent {
  const allDay = Boolean(event.isAllDay);
  const location = event.location?.displayName;
  return {
    id: event.id,
    provider: "microsoft",
    title: event.subject ?? null,
    start: allDay
      ? event.start.dateTime.slice(0, 10)
      : utc(event.start.dateTime),
    // An all-day event ends at midnight of the following day.
    end: allDay
      ? shiftDate(event.end.dateTime.slice(0, 10), -1)
      : utc(event.end.dateTime),
    allDay,
    meetingUrl:
      event.onlineMeeting?.joinUrl ??
      (location?.startsWith("https://") ? location : null),
    url: event.webLink ?? null,
  };
}

const graphTime = (value: string) => ({
  dateTime: new Date(value).toISOString().replace(/Z$/, ""),
  timeZone: "UTC",
});

function toBody(input: EventInput) {
  return {
    subject: input.title,
    body: { contentType: "text", content: input.description ?? "" },
    isAllDay: input.allDay,
    start: input.allDay
      ? { dateTime: `${input.start}T00:00:00`, timeZone: "UTC" }
      : graphTime(input.start),
    end: input.allDay
      ? { dateTime: `${shiftDate(input.end, 1)}T00:00:00`, timeZone: "UTC" }
      : graphTime(input.end),
    ...(input.meetingUrl
      ? { location: { displayName: input.meetingUrl } }
      : {}),
  };
}

const tokenUrl = (tenant: string) =>
  `${LOGIN_URL}/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
const eventUrl = (id: string) =>
  `${GRAPH_URL}/me/events/${encodeURIComponent(id)}`;

export const microsoftCalendar: CalendarProvider = {
  authorizeUrl(client, redirectUri, state) {
    const url = new URL(
      `${LOGIN_URL}/${encodeURIComponent(client.tenant)}/oauth2/v2.0/authorize`,
    );
    url.searchParams.set("client_id", client.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    return url.toString();
  },

  exchangeCode(client, code, redirectUri) {
    return requestToken(tokenUrl(client.tenant), {
      client_id: client.clientId,
      client_secret: client.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: SCOPES,
    });
  },

  refresh(client, refreshToken) {
    return requestToken(tokenUrl(client.tenant), {
      client_id: client.clientId,
      client_secret: client.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: SCOPES,
    });
  },

  async accountEmail(token) {
    const me = await calendarRequest<{
      mail?: string | null;
      userPrincipalName?: string;
    }>(`${GRAPH_URL}/me`, { token });
    return me?.mail ?? me?.userPrincipalName ?? null;
  },

  async listEvents(token, from, to) {
    const url = new URL(`${GRAPH_URL}/me/calendarView`);
    url.searchParams.set("startDateTime", from.toISOString());
    url.searchParams.set("endDateTime", to.toISOString());
    url.searchParams.set("$top", "50");
    url.searchParams.set(
      "$select",
      "id,subject,start,end,isAllDay,isCancelled,webLink,location,onlineMeeting",
    );
    const events: ExternalEvent[] = [];
    let next: string | undefined = url.toString();
    for (let page = 0; next && page < MAX_PAGES; page++) {
      const body: {
        value?: GraphEvent[];
        "@odata.nextLink"?: string;
      } | null = await calendarRequest(next, {
        token,
        headers: { Prefer: 'outlook.timezone="UTC"' },
      });
      for (const item of body?.value ?? []) {
        if (!item.isCancelled) events.push(toEvent(item));
      }
      next = body?.["@odata.nextLink"];
    }
    return events;
  },

  async createEvent(token, input) {
    const created = await calendarRequest<GraphEvent>(
      `${GRAPH_URL}/me/events`,
      {
        token,
        method: "POST",
        body: {
          ...toBody(input),
          ...(input.addMeeting
            ? {
                isOnlineMeeting: true,
                onlineMeetingProvider: "teamsForBusiness",
              }
            : {}),
        },
      },
    );
    if (!created)
      throw new CalendarApiError(502, "Microsoft returned no event");
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
      if (!(error instanceof CalendarApiError) || error.status !== 404) {
        throw error;
      }
    }
  },
};
