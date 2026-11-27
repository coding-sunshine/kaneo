import { z } from "../openapi";
import { CALENDAR_PROVIDERS } from "./providers/types";

const provider = z.enum(CALENDAR_PROVIDERS);

export const statusSchema = z.object({
  providers: z.array(
    z.object({
      provider,
      state: z.enum([
        "not_configured",
        "not_connected",
        "needs_reconnect",
        "connected",
      ]),
      email: z.string().nullable(),
    }),
  ),
});

export const externalEventSchema = z.object({
  id: z.string(),
  provider,
  title: z.string().nullable(),
  start: z.string().openapi({
    description: "YYYY-MM-DD for all-day events, else an ISO 8601 instant.",
  }),
  end: z.string().openapi({
    description:
      "Inclusive last day (YYYY-MM-DD) for all-day events, else an ISO 8601 instant.",
  }),
  allDay: z.boolean(),
  meetingUrl: z.string().nullable(),
  url: z.string().nullable(),
});

export const eventListSchema = z.object({
  events: z.array(externalEventSchema),
  unavailable: z.array(provider).openapi({
    description:
      "Connected calendars that could not be read and need reconnecting or a retry.",
  }),
});

export const syncedSchema = z.object({ synced: z.number().int() });
export const disconnectedSchema = z.object({ success: z.boolean() });
