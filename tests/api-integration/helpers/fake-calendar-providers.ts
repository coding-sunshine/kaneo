// An in-memory stand-in for the Google Calendar and Microsoft Graph endpoints
// the calendar sync calls. It rejects requests that the real services would
// reject or answer differently, so tests prove the wire format, not a mock.

type Json = Record<string, unknown>;
type Provider = "google" | "microsoft";

const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_EVENTS =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const MICROSOFT_TOKEN =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH = "https://graph.microsoft.com/v1.0";

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type Account = {
  email: string;
  accessTokens: Set<string>;
  refreshToken: string;
  events: Map<string, Json>;
};

export function createFakeCalendarProviders() {
  let counter = 0;
  const next = (prefix: string) => `${prefix}-${++counter}`;
  const accounts: Record<Provider, Map<string, Account>> = {
    google: new Map(),
    microsoft: new Map(),
  };
  const requests: { method: string; url: URL; body: unknown }[] = [];
  const pageSize = { google: 250, microsoft: 50 };

  function account(provider: Provider, email: string) {
    let found = accounts[provider].get(email);
    if (!found) {
      found = {
        email,
        accessTokens: new Set(),
        refreshToken: next(`${provider}-refresh`),
        events: new Map(),
      };
      accounts[provider].set(email, found);
    }
    return found;
  }

  function bearer(provider: Provider, headers: Headers) {
    const token = headers.get("authorization")?.replace(/^Bearer /, "");
    for (const candidate of accounts[provider].values()) {
      if (token && candidate.accessTokens.has(token)) return candidate;
    }
    return null;
  }

  function issue(provider: Provider, owner: Account) {
    const accessToken = next(`${provider}-access`);
    owner.accessTokens.add(accessToken);
    return accessToken;
  }

  function token(provider: Provider, form: URLSearchParams) {
    const client = `${provider}-client`;
    if (
      form.get("client_id") !== client ||
      form.get("client_secret") !== `${provider}-secret`
    ) {
      return json(401, { error: "invalid_client" });
    }
    if (provider === "microsoft" && !form.get("scope")) {
      return json(400, { error: "invalid_request" });
    }
    const grant = form.get("grant_type");
    if (grant === "authorization_code") {
      const code = form.get("code") ?? "";
      if (!code.startsWith("code:") || !form.get("redirect_uri")) {
        return json(400, { error: "invalid_grant" });
      }
      const owner = account(provider, code.slice(5));
      return json(200, {
        access_token: issue(provider, owner),
        refresh_token: owner.refreshToken,
        expires_in: 3599,
        token_type: "Bearer",
      });
    }
    if (grant === "refresh_token") {
      const owner = [...accounts[provider].values()].find(
        (candidate) => candidate.refreshToken === form.get("refresh_token"),
      );
      if (!owner) return json(400, { error: "invalid_grant" });
      // Google keeps the refresh token; Microsoft rotates it.
      if (provider === "microsoft") owner.refreshToken = next("ms-refresh");
      return json(200, {
        access_token: issue(provider, owner),
        expires_in: 3599,
        token_type: "Bearer",
        ...(provider === "microsoft"
          ? { refresh_token: owner.refreshToken }
          : {}),
      });
    }
    return json(400, { error: "unsupported_grant_type" });
  }

  const googleRange = (event: Json) => {
    const start = event.start as { date?: string; dateTime?: string };
    const end = event.end as { date?: string; dateTime?: string };
    return [
      new Date(start.dateTime ?? `${start.date}T00:00:00Z`).getTime(),
      new Date(end.dateTime ?? `${end.date}T00:00:00Z`).getTime(),
    ];
  };

  function google(method: string, url: URL, body: Json | null, owner: Account) {
    const path = url.href.split("?")[0];
    if (path === GOOGLE_USERINFO && method === "GET") {
      return json(200, { sub: `sub-${owner.email}`, email: owner.email });
    }
    if (path === GOOGLE_EVENTS && method === "GET") {
      const min = url.searchParams.get("timeMin");
      const max = url.searchParams.get("timeMax");
      // Without singleEvents a recurring series comes back as one item.
      if (!min || !max || url.searchParams.get("singleEvents") !== "true") {
        return json(400, { error: { message: "bad list request" } });
      }
      const items = [...owner.events.values()].filter((event) => {
        const [start, end] = googleRange(event);
        return start < Date.parse(max) && end > Date.parse(min);
      });
      const offset = Number(url.searchParams.get("pageToken") ?? 0);
      const page = items.slice(offset, offset + pageSize.google);
      const more = offset + pageSize.google < items.length;
      return json(200, {
        items: page,
        ...(more ? { nextPageToken: String(offset + pageSize.google) } : {}),
      });
    }
    if (path === GOOGLE_EVENTS && method === "POST") {
      const event = body ?? {};
      for (const edge of ["start", "end"] as const) {
        const value = event[edge] as Json | undefined;
        if (!value || (!value.date && !value.dateTime)) {
          return json(400, { error: { message: `missing ${edge}` } });
        }
      }
      const id = next("gcal");
      const saved: Json = {
        ...event,
        id,
        status: "confirmed",
        htmlLink: `https://calendar.google.com/event?eid=${id}`,
      };
      const create = (event.conferenceData as Json | undefined)?.createRequest;
      // Google ignores conference requests unless this version is sent.
      if (create && url.searchParams.get("conferenceDataVersion") === "1") {
        const link = `https://meet.google.com/${id}`;
        saved.hangoutLink = link;
        saved.conferenceData = {
          entryPoints: [{ entryPointType: "video", uri: link }],
        };
      } else {
        delete saved.conferenceData;
      }
      owner.events.set(id, saved);
      return json(200, saved);
    }
    const id = decodeURIComponent(path.slice(GOOGLE_EVENTS.length + 1));
    const existing = owner.events.get(id);
    if (!existing) return json(404, { error: { message: "Not Found" } });
    if (method === "PATCH") {
      const saved = { ...existing, ...body };
      owner.events.set(id, saved);
      return json(200, saved);
    }
    if (method === "DELETE") {
      owner.events.delete(id);
      return new Response(null, { status: 204 });
    }
    return json(405, {});
  }

  function microsoft(
    method: string,
    url: URL,
    body: Json | null,
    headers: Headers,
    owner: Account,
  ) {
    const path = url.href.split("?")[0];
    if (path === `${GRAPH}/me` && method === "GET") {
      return json(200, { id: `id-${owner.email}`, mail: owner.email });
    }
    if (path === `${GRAPH}/me/calendarView` && method === "GET") {
      const min = url.searchParams.get("startDateTime");
      const max = url.searchParams.get("endDateTime");
      // Times come back without an offset, in the zone this header names.
      if (!min || !max || headers.get("prefer") !== 'outlook.timezone="UTC"') {
        return json(400, { error: { message: "bad calendarView request" } });
      }
      const items = [...owner.events.values()].filter((event) => {
        const start = Date.parse(`${(event.start as Json).dateTime}Z`);
        const end = Date.parse(`${(event.end as Json).dateTime}Z`);
        return start < Date.parse(max) && end > Date.parse(min);
      });
      const skip = Number(url.searchParams.get("$skip") ?? 0);
      const page = items.slice(skip, skip + pageSize.microsoft);
      const more = skip + pageSize.microsoft < items.length;
      const nextLink = new URL(url);
      nextLink.searchParams.set("$skip", String(skip + pageSize.microsoft));
      return json(200, {
        value: page,
        ...(more ? { "@odata.nextLink": nextLink.toString() } : {}),
      });
    }
    if (path === `${GRAPH}/me/events` && method === "POST") {
      const event = body ?? {};
      for (const edge of ["start", "end"] as const) {
        const value = event[edge] as Json | undefined;
        if (!value?.dateTime || !value.timeZone) {
          return json(400, { error: { message: `missing ${edge}` } });
        }
      }
      if (event.isAllDay) {
        const midnight = (value: Json) =>
          String(value.dateTime).endsWith("T00:00:00");
        if (
          !midnight(event.start as Json) ||
          !midnight(event.end as Json) ||
          event.start === event.end
        ) {
          return json(400, { error: { message: "all-day must be midnight" } });
        }
      }
      const id = next("mscal");
      const saved: Json = {
        ...event,
        id,
        isCancelled: false,
        webLink: `https://outlook.office.com/calendar/item/${id}`,
        onlineMeeting: event.isOnlineMeeting
          ? { joinUrl: `https://teams.microsoft.com/l/meetup-join/${id}` }
          : null,
      };
      owner.events.set(id, saved);
      return json(201, saved);
    }
    const id = decodeURIComponent(path.slice(`${GRAPH}/me/events/`.length));
    const existing = owner.events.get(id);
    if (!existing) return json(404, { error: { code: "ErrorItemNotFound" } });
    if (method === "PATCH") {
      const saved = { ...existing, ...body };
      owner.events.set(id, saved);
      return json(200, saved);
    }
    if (method === "DELETE") {
      owner.events.delete(id);
      return new Response(null, { status: 204 });
    }
    return json(405, {});
  }

  async function fetchFake(
    input: string | URL | Request,
    init: RequestInit = {},
  ): Promise<Response> {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);
    const raw = typeof init.body === "string" ? init.body : null;
    const form =
      init.body instanceof URLSearchParams
        ? init.body
        : new URLSearchParams(raw ?? "");
    const body =
      raw && headers.get("content-type")?.includes("json")
        ? (JSON.parse(raw) as Json)
        : null;
    requests.push({
      method,
      url,
      body: body ?? Object.fromEntries(form),
    });

    if (url.href === GOOGLE_TOKEN) return token("google", form);
    if (url.href === MICROSOFT_TOKEN) return token("microsoft", form);
    if (
      url.href.startsWith(GOOGLE_EVENTS) ||
      url.href.startsWith(GOOGLE_USERINFO)
    ) {
      const owner = bearer("google", headers);
      return owner
        ? google(method, url, body, owner)
        : json(401, { error: { message: "Invalid Credentials" } });
    }
    if (url.href.startsWith(GRAPH)) {
      const owner = bearer("microsoft", headers);
      return owner
        ? microsoft(method, url, body, headers, owner)
        : json(401, { error: { code: "InvalidAuthenticationToken" } });
    }
    throw new Error(`Unexpected outbound request: ${method} ${url.origin}`);
  }

  return {
    fetch: fetchFake,
    requests,
    pageSize,
    events(provider: Provider, email: string) {
      return [...account(provider, email).events.values()];
    },
    seed(provider: Provider, email: string, event: Json) {
      const id = next(provider === "google" ? "gseed" : "msseed");
      account(provider, email).events.set(id, { id, ...event });
      return id;
    },
    /** Every issued access token stops working, as after a revocation. */
    revoke(provider: Provider, email: string) {
      account(provider, email).accessTokens.clear();
    },
    refreshToken(provider: Provider, email: string) {
      return account(provider, email).refreshToken;
    },
  };
}
