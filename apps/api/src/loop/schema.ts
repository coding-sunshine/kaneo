import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";
import { chatMessageSchema } from "../agent/schema";
import { WRITE_TOOLS } from "../agent/tools";
import { FREQUENCIES } from "./schedule";

export const workspaceParam = z.object({ workspaceId: z.string() });
export const loopParam = z.object({
  workspaceId: z.string(),
  id: z.string(),
});
export const runParam = z.object({
  workspaceId: z.string(),
  id: z.string(),
  runId: z.string(),
});
export const listQuery = z.object({
  scope: z.enum(["mine", "all"]).default("all"),
});

const frequency = z.enum(FREQUENCIES);
export const TRIGGERS = [
  "schedule",
  "task_created",
  "task_status_changed",
  "comment_created",
] as const;
const trigger = z.enum(TRIGGERS);
// The write tools a run may use; none means it can only read.
const actions = z.array(z.enum(WRITE_TOOLS)).max(WRITE_TOOLS.length);

export const draftBody = z.object({
  workspaceId: z.string(),
  description: z.string().trim().min(1).max(4_000),
});

export const draftSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    instructions: z.string().trim().min(1).max(10_000),
    trigger,
    frequency: frequency.nullish(),
    actions: actions.default([]),
  })
  .openapi("LoopDraft");

export const createLoopBody = z
  .object({
    workspaceId: z.string(),
    name: z.string().trim().min(1).max(255),
    instructions: z.string().trim().min(1).max(10_000),
    trigger: trigger.default("schedule"),
    projectId: z.string().nullish(),
    frequency: frequency.nullish(),
    actions: actions.default([]),
  })
  .refine((body) => body.trigger !== "schedule" || body.frequency, {
    message: "A scheduled loop needs a frequency",
    path: ["frequency"],
  });

export const updateLoopBody = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  instructions: z.string().trim().min(1).max(10_000).optional(),
  trigger: trigger.optional(),
  projectId: z.string().nullish(),
  frequency: frequency.nullish(),
  actions: actions.optional(),
  enabled: z.boolean().optional(),
});

export const loopSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    creatorId: z.string(),
    creatorName: z.string().nullable(),
    name: z.string(),
    instructions: z.string(),
    actions,
    trigger,
    projectId: z.string().nullable(),
    frequency: frequency.nullable(),
    enabled: z.boolean(),
    nextRunAt: nullableResponseTimestamp,
    lastRunAt: nullableResponseTimestamp,
    createdAt: responseTimestamp,
  })
  .openapi("Loop");

export const loopListSchema = z.array(loopSchema);

export const runSummarySchema = z
  .object({
    id: z.string(),
    trigger: z.enum(["schedule", "manual", "event"]),
    status: z.enum(["running", "succeeded", "failed"]),
    error: z.string().nullable(),
    startedAt: responseTimestamp,
    finishedAt: nullableResponseTimestamp,
  })
  .openapi("LoopRunSummary");

export const runListSchema = z.array(runSummarySchema);

export const runDetailSchema = runSummarySchema
  .extend({ messages: z.array(chatMessageSchema) })
  .openapi("LoopRun");

export const deletedLoopSchema = z.object({ id: z.string() });
