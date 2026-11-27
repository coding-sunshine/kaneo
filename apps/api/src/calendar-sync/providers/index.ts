import { googleCalendar } from "./google";
import { microsoftCalendar } from "./microsoft";
import type { CalendarProvider, CalendarProviderId } from "./types";

export const calendarProviders: Record<CalendarProviderId, CalendarProvider> = {
  google: googleCalendar,
  microsoft: microsoftCalendar,
};
