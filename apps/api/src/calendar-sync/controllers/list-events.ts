import { getCalendarOAuthClient } from "../config";
import { listConnections, withCalendarToken } from "../connection";
import { calendarProviders } from "../providers";
import type { CalendarProviderId, ExternalEvent } from "../providers/types";
import { linkedEventKeys } from "../task-events";

const startTime = (event: ExternalEvent) =>
  Date.parse(event.allDay ? `${event.start}T00:00:00Z` : event.start);

/** Events from the person's connected calendars, without their task copies. */
export async function listEvents(userId: string, from: Date, to: Date) {
  const connections = (await listConnections(userId)).filter(
    (row) => row.accessToken && getCalendarOAuthClient(row.provider),
  );
  const linked = await linkedEventKeys(connections.map((row) => row.id));
  const events: ExternalEvent[] = [];
  const unavailable: CalendarProviderId[] = [];
  await Promise.all(
    connections.map(async (connection) => {
      try {
        const result = await withCalendarToken(connection, (token) =>
          calendarProviders[connection.provider].listEvents(token, from, to),
        );
        if (!result.ok) {
          unavailable.push(connection.provider);
          return;
        }
        for (const event of result.value) {
          if (!linked.has(`${connection.id}:${event.id}`)) events.push(event);
        }
      } catch (error) {
        console.error("Calendar sync could not read a calendar", error);
        unavailable.push(connection.provider);
      }
    }),
  );
  events.sort((a, b) => startTime(a) - startTime(b));
  return { events, unavailable: unavailable.sort() };
}
