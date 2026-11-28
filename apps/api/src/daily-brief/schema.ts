import { z } from "../openapi";

export const workspaceParam = z.object({ workspaceId: z.string().min(1) });
export const briefParam = workspaceParam.extend({ briefId: z.string().min(1) });

export const briefPreferenceSchema = z
  .object({
    enabled: z.boolean(),
    channelIds: z.array(z.string().min(1)).max(50),
  })
  .openapi("DailyBriefPreference");

const ticket = z.object({
  id: z.string(),
  title: z.string(),
  ticket: z.string(),
  projectId: z.string(),
});

export const briefSchema = z
  .object({
    id: z.string(),
    day: z.string(),
    dueToday: z.array(ticket),
    mentions: z.array(
      z.object({
        messageId: z.string(),
        channelId: z.string(),
        channelName: z.string(),
        preview: z.string(),
        createdAt: z.string(),
      }),
    ),
    moved: z.array(ticket.extend({ status: z.string() })),
    createdAt: z.string(),
  })
  .openapi("DailyBrief");
