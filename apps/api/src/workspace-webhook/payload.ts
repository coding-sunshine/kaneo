import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import getProject from "../project/controllers/get-project";
import getTask from "../task/controllers/get-task";
import type {
  WorkspaceWebhookAction,
  WorkspaceWebhookResourceType,
} from "./types";

export type ResolvedWebhookEvent = {
  type: WorkspaceWebhookResourceType;
  action: WorkspaceWebhookAction;
  workspaceId: string;
  projectId: string | null;
  data: Record<string, unknown>;
};

async function workspaceOfProject(projectId: string) {
  const [row] = await db
    .select({ workspaceId: schema.projectTable.workspaceId })
    .from(schema.projectTable)
    .where(eq(schema.projectTable.id, projectId));
  return row?.workspaceId ?? null;
}

// `data` is the object the matching API route returns; removed records fall
// back to what the event carries.
export async function resolveTaskEvent(
  action: WorkspaceWebhookAction,
  e: { taskId?: string; projectId?: string; title?: string },
): Promise<ResolvedWebhookEvent | null> {
  if (!e.taskId || !e.projectId) return null;
  const workspaceId = await workspaceOfProject(e.projectId);
  if (!workspaceId) return null;
  let data: Record<string, unknown> | null = null;
  if (action !== "remove") {
    data = (await getTask(e.taskId).catch(() => null)) as Record<
      string,
      unknown
    > | null;
  }
  data ??= { id: e.taskId, projectId: e.projectId, title: e.title ?? null };
  return {
    type: "task",
    action,
    workspaceId,
    projectId: e.projectId,
    data,
  };
}

export async function resolveCommentEvent(
  action: WorkspaceWebhookAction,
  e: { id?: string; taskId?: string; projectId?: string },
): Promise<ResolvedWebhookEvent | null> {
  if (!e.id || !e.projectId) return null;
  const workspaceId = await workspaceOfProject(e.projectId);
  if (!workspaceId) return null;
  let data: Record<string, unknown> | null = null;
  if (action !== "remove") {
    const [row] = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.id, e.id));
    data = row ?? null;
  }
  data ??= { id: e.id, taskId: e.taskId ?? null };
  return {
    type: "comment",
    action,
    workspaceId,
    projectId: e.projectId,
    data,
  };
}

export async function resolveProjectEvent(
  action: WorkspaceWebhookAction,
  e: {
    projectId?: string;
    workspaceId?: string;
    name?: string;
    isPrivate?: boolean;
  },
): Promise<ResolvedWebhookEvent | null> {
  if (!e.projectId) return null;
  // A deleted team has no row left for the dispatcher to read, so the event
  // says whether it was private. A private team sends nothing to a webhook.
  if (e.isPrivate) return null;
  const workspaceId = e.workspaceId ?? (await workspaceOfProject(e.projectId));
  if (!workspaceId) return null;
  let data: Record<string, unknown> | null = null;
  if (action !== "remove")
    data = await getProject(e.projectId, workspaceId).catch(() => null);
  data ??= { id: e.projectId, name: e.name ?? null };
  return {
    type: "project",
    action,
    workspaceId,
    projectId: e.projectId,
    data,
  };
}

export async function resolveLabelEvent(
  action: WorkspaceWebhookAction,
  e: {
    labelId?: string;
    workspaceId?: string;
    projectId?: string | null;
    name?: string;
  },
): Promise<ResolvedWebhookEvent | null> {
  if (!e.labelId || !e.workspaceId) return null;
  let data: Record<string, unknown> | null = null;
  if (action !== "remove") {
    const [row] = await db
      .select()
      .from(schema.labelTable)
      .where(
        and(
          eq(schema.labelTable.id, e.labelId),
          eq(schema.labelTable.workspaceId, e.workspaceId),
        ),
      );
    data = row ?? null;
  }
  data ??= { id: e.labelId, name: e.name ?? null };
  return {
    type: "label",
    action,
    workspaceId: e.workspaceId,
    projectId: e.projectId ?? null,
    data,
  };
}

export async function resolveCycleEvent(
  action: WorkspaceWebhookAction,
  e: { cycleId?: string },
): Promise<ResolvedWebhookEvent | null> {
  if (!e.cycleId) return null;
  const [row] = await db
    .select({
      cycle: schema.cycleTable,
      workspaceId: schema.projectTable.workspaceId,
    })
    .from(schema.cycleTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.cycleTable.projectId, schema.projectTable.id),
    )
    .where(eq(schema.cycleTable.id, e.cycleId));
  if (!row) return null;
  return {
    type: "cycle",
    action,
    workspaceId: row.workspaceId,
    projectId: row.cycle.projectId,
    data: row.cycle,
  };
}
