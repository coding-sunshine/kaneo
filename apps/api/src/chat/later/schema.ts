import { z } from "../../openapi";

export const remindMessageBody = z.object({
  remindAt: z.iso.datetime({ offset: true }).openapi({
    description:
      "When to remind you, as an absolute time in the future, up to a year ahead.",
  }),
});

export const messageReminderSchema = z
  .object({
    id: z.string(),
    messageId: z.string(),
    remindAt: z.string().openapi({
      description: "When the reminder reaches your Inbox.",
    }),
  })
  .openapi("ChatMessageReminder");

export const saveMessageBody = z.object({
  saved: z.boolean().openapi({
    description:
      "True adds the message to your saved list; false removes it from the list, leaving the message itself in its channel.",
  }),
});

export const savedMessageSchema = z
  .object({ messageId: z.string(), saved: z.boolean() })
  .openapi("ChatSavedMessage");
