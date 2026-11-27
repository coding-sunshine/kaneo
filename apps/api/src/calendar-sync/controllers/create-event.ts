import { ApiError } from "../../errors/api-error";
import { getCalendarOAuthClient } from "../config";
import { findConnection, withCalendarToken } from "../connection";
import { calendarProviders } from "../providers";
import { CalendarApiError } from "../providers/http";
import type { CalendarProviderId, EventInput } from "../providers/types";
import { notConfigured } from "./connect";

const reconnect = (message: string, code: string) =>
  new ApiError(409, { message, code });

export async function createEvent(
  userId: string,
  input: EventInput & { provider: CalendarProviderId },
) {
  if (!getCalendarOAuthClient(input.provider)) throw notConfigured();
  const connection = await findConnection(userId, input.provider);
  if (!connection) {
    throw reconnect("Connect this calendar first", "CALENDAR_NOT_CONNECTED");
  }
  try {
    const result = await withCalendarToken(connection, (token) =>
      calendarProviders[input.provider].createEvent(token, input),
    );
    if (!result.ok) {
      throw reconnect("Reconnect this calendar", "CALENDAR_RECONNECT_REQUIRED");
    }
    return {
      ...result.value,
      meetingUrl: result.value.meetingUrl ?? input.meetingUrl ?? null,
    };
  } catch (error) {
    if (!(error instanceof CalendarApiError)) throw error;
    throw new ApiError(502, {
      message: "The calendar provider did not accept the event",
      code: "CALENDAR_REQUEST_FAILED",
    });
  }
}
