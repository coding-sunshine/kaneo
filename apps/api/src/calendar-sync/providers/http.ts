import type { TokenSet } from "./types";

// Event bus handlers await these calls, so a stalled provider must not hang them.
const TIMEOUT_MS = 10_000;

export class CalendarApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function describeError(body: unknown, status: number) {
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error === "string") return error;
  const message = (error as { message?: unknown } | undefined)?.message;
  return typeof message === "string"
    ? message
    : `Calendar request failed (${status})`;
}

export async function calendarRequest<T>(
  url: string,
  options: {
    token: string;
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  },
): Promise<T | null> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${options.token}`,
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new CalendarApiError(
      response.status,
      describeError(body, response.status),
    );
  }
  return body as T;
}

type TokenBody = {
  error?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

export async function requestToken(
  url: string,
  params: Record<string, string>,
): Promise<TokenSet> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => null)) as TokenBody | null;
  if (!response.ok || !body?.access_token) {
    // Only invalid_grant means the person's grant is gone. A rotated client
    // secret, a rate limit or an outage must not make everyone reconnect.
    throw new CalendarApiError(
      body?.error === "invalid_grant" ? 401 : 502,
      describeError(body, response.status),
    );
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: body.expires_in
      ? new Date(Date.now() + body.expires_in * 1000)
      : null,
  };
}
