export const CALENDAR_PROVIDERS = ["google", "microsoft"] as const;
export type CalendarProviderId = (typeof CALENDAR_PROVIDERS)[number];

export type OAuthClient = {
  clientId: string;
  clientSecret: string;
  /** Microsoft only: the Entra tenant, or "common" for any account. */
  tenant: string;
};

export type TokenSet = {
  accessToken: string;
  /** Null when the provider kept the previous one (Google on refresh). */
  refreshToken: string | null;
  expiresAt: Date | null;
};

/** All-day `start` and `end` are inclusive YYYY-MM-DD; timed ones are ISO instants. */
export type ExternalEvent = {
  id: string;
  provider: CalendarProviderId;
  title: string | null;
  start: string;
  end: string;
  allDay: boolean;
  meetingUrl: string | null;
  url: string | null;
};

export type EventInput = {
  title: string;
  description?: string;
  allDay: boolean;
  start: string;
  end: string;
  /** Ask the provider for its own meeting (Google Meet, Microsoft Teams). */
  addMeeting?: boolean;
  /** A meeting link the person already has. */
  meetingUrl?: string;
};

export type CalendarProvider = {
  authorizeUrl(client: OAuthClient, redirectUri: string, state: string): string;
  exchangeCode(
    client: OAuthClient,
    code: string,
    redirectUri: string,
  ): Promise<TokenSet>;
  refresh(client: OAuthClient, refreshToken: string): Promise<TokenSet>;
  accountEmail(token: string): Promise<string | null>;
  listEvents(token: string, from: Date, to: Date): Promise<ExternalEvent[]>;
  createEvent(token: string, input: EventInput): Promise<ExternalEvent>;
  updateEvent(token: string, id: string, input: EventInput): Promise<void>;
  /** Succeeds when the event is already gone. */
  deleteEvent(token: string, id: string): Promise<void>;
};
