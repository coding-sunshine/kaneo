import { z } from "../openapi";
import { isValidTimezone, TIME_PATTERN } from "./schedule";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

// Secrets are write-only: a value sets it, null clears it, omitting leaves it.
export const updatePreferencesBody = z.object({
  emailEnabled: z.boolean().optional(),
  ntfyEnabled: z.boolean().optional(),
  ntfyServerUrl: z.string().nullable().optional(),
  ntfyTopic: z.string().nullable().optional(),
  ntfyToken: z.string().nullable().optional(),
  gotifyEnabled: z.boolean().optional(),
  gotifyServerUrl: z.string().nullable().optional(),
  gotifyToken: z.string().nullable().optional(),
  webhookEnabled: z.boolean().optional(),
  webhookUrl: z.string().nullable().optional(),
  webhookSecret: z.string().nullable().optional(),
  taskAssignmentEnabled: z.boolean().optional(),
  taskCommentEnabled: z.boolean().optional(),
  taskStatusChangeEnabled: z.boolean().optional(),
  dueDateReminderEnabled: z.boolean().optional(),
  dueDateReminderLeadTimeMinutes: z
    .number()
    .int()
    .min(5)
    .max(43_200)
    .optional()
    .openapi({ description: "Between 5 minutes and 30 days." }),
  topicUpdatesEnabled: z.boolean().optional().openapi({
    description:
      "Hear about new proposals, new current documents and approved decisions on followed topics.",
  }),
  staleItemsEnabled: z.boolean().optional().openapi({
    description:
      "A weekly inbox line on weekdays listing your issues that have sat in one started status for over a week.",
  }),
  chatEmailEnabled: z.boolean().optional().openapi({
    description:
      "Only while email is on: one email listing direct messages and mentions you left unread while away, at most one an hour and held through quiet hours.",
  }),
  scheduleEnabled: z.boolean().optional().openapi({
    description:
      "Only send email, ntfy and Gotify notifications inside the schedule. The inbox is never affected.",
  }),
  scheduleTimezone: z
    .string()
    .refine(isValidTimezone, "Unknown timezone")
    .optional()
    .openapi({ description: "IANA timezone, for example `Europe/Berlin`." }),
  scheduleDays: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .max(7)
    .optional()
    .openapi({ description: "Weekdays to deliver on, 0 is Sunday." }),
  scheduleStart: z.string().regex(TIME_PATTERN).optional().openapi({
    description: "Local start of the delivery window, `HH:MM`.",
  }),
  scheduleEnd: z.string().regex(TIME_PATTERN).optional().openapi({
    description: "Local end of the delivery window, `HH:MM`; after the start.",
  }),
});

export const upsertWorkspaceRuleBody = z.object({
  isActive: z.boolean(),
  emailEnabled: z.boolean(),
  ntfyEnabled: z.boolean(),
  gotifyEnabled: z.boolean(),
  webhookEnabled: z.boolean(),
  projectMode: z.enum(["all", "selected"]),
  selectedProjectIds: z.array(z.string()).optional().openapi({
    description: "Required in practice when projectMode is `selected`.",
  }),
});
