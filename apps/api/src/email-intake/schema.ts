import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });
export const taskIdParam = z.object({ taskId: z.string() });

export const emailIntakeSchema = z
  .object({
    available: z.boolean().openapi({
      description:
        "Whether this instance has an intake mailbox. When false, intake cannot be turned on.",
    }),
    repliesAvailable: z.boolean().openapi({
      description: "Whether this instance can send email (SMTP) for replies.",
    }),
    address: z.string().nullable().openapi({
      description:
        "The team's intake address, or null when intake is off for the team.",
    }),
  })
  .openapi("EmailIntake");

export const emailThreadSchema = z
  .object({
    address: z.string().openapi({ description: "The requester's address." }),
    name: z.string().nullable(),
    subject: z.string(),
  })
  .nullable()
  .openapi("EmailThread");

export const emailReplyBody = z.object({
  content: z.string().trim().min(1).max(10_000),
});

export const emailReplySchema = z
  .object({
    to: z.string().openapi({ description: "Where the reply was sent." }),
    commentId: z.string().openapi({
      description: "The comment that records the reply on the ticket.",
    }),
  })
  .openapi("EmailReply");
