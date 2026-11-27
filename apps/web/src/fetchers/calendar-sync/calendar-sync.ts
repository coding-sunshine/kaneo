import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";
import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";

const api = client["calendar-sync"];

export type CalendarSyncStatus = InferResponseType<
  (typeof api)["status"]["$get"],
  200
>;
export type CalendarProviderStatus = CalendarSyncStatus["providers"][number];
export type CalendarProviderId = CalendarProviderStatus["provider"];
export type CalendarEventList = InferResponseType<
  (typeof api)["events"]["$get"],
  200
>;
export type ExternalCalendarEvent = CalendarEventList["events"][number];
export type CreateCalendarEventBody = InferRequestType<
  (typeof api)["events"]["$post"]
>["json"];

export async function getCalendarSyncStatus(): Promise<CalendarSyncStatus> {
  const response = await api.status.$get();
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getCalendarEvents(
  from: Date,
  to: Date,
): Promise<CalendarEventList> {
  const response = await api.events.$get({
    query: { from: from.toISOString(), to: to.toISOString() },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function createCalendarEvent(json: CreateCalendarEventBody) {
  const response = await api.events.$post({ json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function disconnectCalendar(provider: CalendarProviderId) {
  const response = await api.connection[":provider"].$delete({
    param: { provider },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
}

export async function syncCalendarTasks() {
  const response = await api.sync.$post();
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

// The OAuth round trip is a browser navigation: the session cookie must reach
// the API and the provider redirects back, so the fetch client cannot be used.
export function getCalendarConnectUrl(
  provider: CalendarProviderId,
  returnTo: string,
) {
  const query = new URLSearchParams({
    returnTo,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return getApiUrl(`calendar-sync/connect/${provider}?${query}`);
}
