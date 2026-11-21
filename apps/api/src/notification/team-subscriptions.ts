import { and, eq, or } from "drizzle-orm";
import db from "../database";
import {
  columnTable,
  projectMemberPreferenceTable,
  projectTable,
  taskTable,
} from "../database/schema";
import { subscribeToEvent } from "../events";
import createNotification from "./controllers/create-notification";

export type TeamEvent = "issue_added" | "issue_closed" | "issue_triage";

const FLAG = {
  issue_added: projectMemberPreferenceTable.notifyIssueAdded,
  issue_closed: projectMemberPreferenceTable.notifyIssueClosed,
  issue_triage: projectMemberPreferenceTable.notifyIssueTriage,
} as const;

/**
 * Linear's team "Subscribe" menu: one inbox row per subscriber and event.
 * People the event already notifies (the actor, the assignee) are skipped so
 * nobody gets the same change twice; project access is enforced on insert.
 */
export async function notifyTeamSubscribers(input: {
  projectId: string;
  taskId: string;
  title: string;
  events: TeamEvent[];
  skipUserIds: Array<string | null | undefined>;
  newStatus?: string;
}) {
  if (input.events.length === 0) return;
  const rows = await db
    .select({
      userId: projectMemberPreferenceTable.userId,
      issueAdded: projectMemberPreferenceTable.notifyIssueAdded,
      issueClosed: projectMemberPreferenceTable.notifyIssueClosed,
      issueTriage: projectMemberPreferenceTable.notifyIssueTriage,
      teamName: projectTable.name,
      workspaceId: projectTable.workspaceId,
    })
    .from(projectMemberPreferenceTable)
    .innerJoin(
      projectTable,
      eq(projectTable.id, projectMemberPreferenceTable.projectId),
    )
    .where(
      and(
        eq(projectMemberPreferenceTable.projectId, input.projectId),
        or(...input.events.map((event) => eq(FLAG[event], true))),
      ),
    );
  const skip = new Set(input.skipUserIds.filter(Boolean));
  for (const row of rows) {
    if (skip.has(row.userId)) continue;
    const subscribed = {
      issue_added: row.issueAdded,
      issue_closed: row.issueClosed,
      issue_triage: row.issueTriage,
    };
    // The most specific event wins: an issue created in triage is a triage row.
    const event = [...input.events]
      .reverse()
      .find((candidate) => subscribed[candidate]);
    if (!event) continue;
    await createNotification({
      userId: row.userId,
      type: `team_${event}`,
      eventData: {
        taskTitle: input.title,
        teamName: row.teamName,
        projectId: input.projectId,
        workspaceId: row.workspaceId,
        ...(input.newStatus ? { newStatus: input.newStatus } : {}),
      },
      resourceId: input.taskId,
      resourceType: "task",
    });
  }
}

const CANCELED = ["canceled", "cancelled"];

async function isClosedStatus(projectId: string, status: string) {
  if (CANCELED.includes(status)) return true;
  const [column] = await db
    .select({ isFinal: columnTable.isFinal })
    .from(columnTable)
    .where(
      and(eq(columnTable.projectId, projectId), eq(columnTable.slug, status)),
    )
    .limit(1);
  return column?.isFinal ?? false;
}

subscribeToEvent<{
  taskId: string;
  projectId: string;
  title: string;
  status?: string;
  userId?: string;
  currentUserId?: string;
  source?: string;
}>("task.created", async (data) => {
  // Bulk imports publish per task; subscribers aren't told about each one.
  if (data.source || !data.projectId) return;
  await notifyTeamSubscribers({
    projectId: data.projectId,
    taskId: data.taskId,
    title: data.title,
    events:
      data.status === "triage"
        ? ["issue_added", "issue_triage"]
        : ["issue_added"],
    skipUserIds: [data.currentUserId, data.userId],
  });
});

subscribeToEvent<{
  taskId: string;
  projectId?: string;
  title: string;
  oldStatus: string;
  newStatus: string;
  userId?: string | null;
  assigneeId?: string | null;
}>("task.status_changed", async (data) => {
  if (!data.projectId) return;
  const events: TeamEvent[] = [];
  if (data.newStatus === "triage" && data.oldStatus !== "triage")
    events.push("issue_triage");
  else if (
    (await isClosedStatus(data.projectId, data.newStatus)) &&
    !(await isClosedStatus(data.projectId, data.oldStatus))
  )
    events.push("issue_closed");
  await notifyTeamSubscribers({
    projectId: data.projectId,
    taskId: data.taskId,
    title: data.title,
    events,
    skipUserIds: [data.userId, data.assigneeId],
    newStatus: data.newStatus,
  });
});

subscribeToEvent<{
  taskId: string;
  userId?: string;
  fromProjectId: string;
  toProjectId: string;
  newStatus: string;
}>("task.moved", async (data) => {
  // Moving an issue into a team adds it to that team.
  if (data.fromProjectId === data.toProjectId) return;
  const [task] = await db
    .select({ title: taskTable.title, assigneeId: taskTable.userId })
    .from(taskTable)
    .where(eq(taskTable.id, data.taskId))
    .limit(1);
  if (!task) return;
  await notifyTeamSubscribers({
    projectId: data.toProjectId,
    taskId: data.taskId,
    title: task.title,
    events:
      data.newStatus === "triage"
        ? ["issue_added", "issue_triage"]
        : ["issue_added"],
    skipUserIds: [data.userId, task.assigneeId],
  });
});
