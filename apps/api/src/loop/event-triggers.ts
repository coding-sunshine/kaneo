import { and, eq, gt, sql } from "drizzle-orm";
import db from "../database";
import { loopRunTable, loopTable, projectTable } from "../database/schema";
import { isAgentEnabled } from "../agent/openrouter";
import { subscribeToEvent } from "../events";
import { projectAccessCondition } from "../project-access/project-access-condition";
import { executeLoop, loopRunContext } from "./run-loop";

const EVENT_TRIGGERS = {
  "task.created": "task_created",
  "task.status_changed": "task_status_changed",
  "comment.created": "comment_created",
} as const;

// Caps so one burst of events cannot become a burst of model calls.
const MAX_RUNS_PER_LOOP_PER_HOUR = 20;
const MAX_CONCURRENT_RUNS = 3;
const DEDUPE_MS = 60_000;

let inFlight = 0;
const recent = new Map<string, number>();

type EventData = {
  projectId?: string;
  taskId?: string;
  id?: string;
  newStatus?: string;
};

function seenRecently(key: string, now: number) {
  for (const [k, at] of recent) if (now - at > DEDUPE_MS) recent.delete(k);
  if (recent.has(key)) return true;
  recent.set(key, now);
  return false;
}

export async function fireEventLoops(
  eventType: keyof typeof EVENT_TRIGGERS,
  data: EventData,
) {
  if (!isAgentEnabled() || loopRunContext.getStore()) return;
  if (!data.projectId || !data.taskId) return;
  const [project] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(projectTable)
    .where(eq(projectTable.id, data.projectId));
  if (!project) return;

  const loops = await db
    .select()
    .from(loopTable)
    .where(
      and(
        eq(loopTable.workspaceId, project.workspaceId),
        eq(loopTable.enabled, true),
        eq(loopTable.trigger, EVENT_TRIGGERS[eventType]),
        sql`(${loopTable.projectId} is null or ${loopTable.projectId} = ${data.projectId})`,
        // A loop runs as the person who made it, and the event's text goes into
        // its prompt: it hears only teams that person can open.
        projectAccessCondition(loopTable.creatorId, data.projectId),
      ),
    );

  const note = `Triggered by ${eventType}: task ${data.taskId} in project ${data.projectId}.`;
  for (const loop of loops) {
    const key = `${loop.id}:${eventType}:${data.taskId}:${data.id ?? data.newStatus ?? ""}`;
    if (seenRecently(key, Date.now())) continue;
    if (inFlight >= MAX_CONCURRENT_RUNS) {
      console.warn(`loops: ${loop.id} skipped, too many runs in flight`);
      continue;
    }
    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loopRunTable)
      .where(
        and(
          eq(loopRunTable.loopId, loop.id),
          eq(loopRunTable.trigger, "event"),
          gt(loopRunTable.startedAt, new Date(Date.now() - 3_600_000)),
        ),
      );
    if (count >= MAX_RUNS_PER_LOOP_PER_HOUR) continue;
    inFlight++;
    // Not awaited: the publisher must not wait on a model round trip.
    executeLoop(loop, "event", note)
      .catch((error) =>
        console.error(`loops: run for ${loop.id} failed`, error),
      )
      .finally(() => inFlight--);
  }
}

for (const type of Object.keys(
  EVENT_TRIGGERS,
) as (keyof typeof EVENT_TRIGGERS)[])
  subscribeToEvent<EventData>(type, (data) => fireEventLoops(type, data));
