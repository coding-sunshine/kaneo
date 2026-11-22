import { and, eq, sql } from "drizzle-orm";
import db, { schema } from "../database";
import { subscribeToEvent } from "../events";
import {
  type ResolvedWebhookEvent,
  resolveCommentEvent,
  resolveCycleEvent,
  resolveLabelEvent,
  resolveProjectEvent,
  resolveTaskEvent,
} from "./payload";

// Queue one delivery per matching webhook: same workspace, enabled, subscribed
// to the resource type, and (when it lists teams) the record's team.
export async function enqueueWorkspaceWebhooks(event: ResolvedWebhookEvent) {
  const webhook = schema.workspaceWebhookTable;
  const rows = await db
    .select({ id: webhook.id, url: webhook.url })
    .from(webhook)
    .where(
      and(
        eq(webhook.workspaceId, event.workspaceId),
        eq(webhook.enabled, true),
        sql`${event.type} = ANY(${webhook.resourceTypes})`,
        event.projectId
          ? sql`(cardinality(${webhook.projectIds}) = 0 OR ${event.projectId} = ANY(${webhook.projectIds}))`
          : sql`cardinality(${webhook.projectIds}) = 0`,
      ),
    );
  if (rows.length === 0) return;
  const createdAt = new Date().toISOString();
  await db.insert(schema.workspaceWebhookDeliveryTable).values(
    rows.map((row) => ({
      webhookId: row.id,
      payload: {
        action: event.action,
        type: event.type,
        data: event.data,
        createdAt,
        webhookId: row.id,
        url: row.url,
      },
    })),
  );
}

type Resolver<T> = (data: T) => Promise<ResolvedWebhookEvent | null>;
function on<T>(name: string, resolve: Resolver<T>) {
  subscribeToEvent<T>(name, async (data) => {
    const event = await resolve(data);
    if (event) await enqueueWorkspaceWebhooks(event);
  });
}

on("task.created", (d: never) => resolveTaskEvent("create", d));
on("task.updated", (d: never) => resolveTaskEvent("update", d));
on("task.deleted", (d: never) => resolveTaskEvent("remove", d));
on("comment.created", (d: never) => resolveCommentEvent("create", d));
on("comment.updated", (d: never) => resolveCommentEvent("update", d));
on("comment.deleted", (d: never) => resolveCommentEvent("remove", d));
on("project.created", (d: never) => resolveProjectEvent("create", d));
on("project.updated", (d: never) => resolveProjectEvent("update", d));
on("project.deleted", (d: never) => resolveProjectEvent("remove", d));
on("label.created", (d: never) => resolveLabelEvent("create", d));
on("label.updated", (d: never) => resolveLabelEvent("update", d));
on("label.deleted", (d: never) => resolveLabelEvent("remove", d));
on("cycle.updated", (d: never) => resolveCycleEvent("update", d));
