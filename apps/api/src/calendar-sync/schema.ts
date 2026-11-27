import { z } from "../openapi";
import { isHttpUrl } from "../utils/is-http-url";
import { CALENDAR_PROVIDERS } from "./providers/types";

const MAX_RANGE_DAYS = 62;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const providerParam = z.object({
  provider: z.enum(CALENDAR_PROVIDERS),
});

export const connectQuery = z.object({
  returnTo: z.string().optional().openapi({
    description: "App-relative path to return to after connecting.",
  }),
  timeZone: z.string().optional().openapi({
    description:
      "IANA time zone that decides which calendar day a task's due date falls on. Defaults to UTC.",
  }),
});

export const callbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export const eventsQuery = z
  .object({
    from: z
      .string()
      .regex(INSTANT)
      .openapi({ description: "Range start (ISO 8601)." }),
    to: z
      .string()
      .regex(INSTANT)
      .openapi({ description: "Range end (ISO 8601)." }),
  })
  .refine(
    ({ from, to }) => {
      const span = Date.parse(to) - Date.parse(from);
      return span > 0 && span <= MAX_RANGE_DAYS * 86_400_000;
    },
    {
      message: `The range must be positive and at most ${MAX_RANGE_DAYS} days`,
    },
  );

export const createEventBody = z
  .object({
    provider: z.enum(CALENDAR_PROVIDERS),
    title: z.string().trim().min(1).max(1024),
    description: z.string().max(8000).optional(),
    allDay: z.boolean(),
    start: z.string().openapi({
      description: "YYYY-MM-DD for an all-day event, else an ISO 8601 instant.",
    }),
    end: z.string().openapi({
      description:
        "Inclusive last day (YYYY-MM-DD) for an all-day event, else an ISO 8601 instant after start.",
    }),
    addMeeting: z.boolean().optional().openapi({
      description:
        "Create a Google Meet or Microsoft Teams meeting with the event.",
    }),
    meetingUrl: z
      .string()
      .max(2048)
      .refine(isHttpUrl, "Use an http or https link")
      .optional()
      .openapi({ description: "A meeting link to put on the event." }),
  })
  .refine(
    ({ allDay, start, end }) =>
      allDay
        ? DAY.test(start) && DAY.test(end) && end >= start
        : INSTANT.test(start) &&
          INSTANT.test(end) &&
          Date.parse(end) > Date.parse(start),
    { message: "The event must end after it starts", path: ["end"] },
  );
