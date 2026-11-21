import { z } from "../openapi";

export const cycleParam = z.object({ id: z.string() });
export const projectIdParam = z.object({ projectId: z.string() });

export const updateCycleBody = z.object({
  name: z.string().trim().max(255).nullable().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export const cycleSettingsBody = z.object({
  cyclesEnabled: z.boolean().optional(),
  cycleDurationWeeks: z.number().int().min(1).max(8).optional(),
  cycleCooldownWeeks: z.number().int().min(0).max(8).optional(),
  cycleStartDay: z.number().int().min(0).max(6).optional().openapi({
    description: "0 = Sunday ... 6 = Saturday.",
  }),
  cycleUpcomingCount: z.number().int().min(1).max(12).optional(),
  cycleAutoAddStarted: z.boolean().optional(),
  cycleAutoAddCompleted: z.boolean().optional(),
  cycleAutoRollover: z.boolean().optional(),
});

export const updateTaskCycleBody = z.object({
  cycleId: z.string().nullable().openapi({
    description:
      "Cycle of the task's team; null removes the task from its cycle.",
  }),
});
