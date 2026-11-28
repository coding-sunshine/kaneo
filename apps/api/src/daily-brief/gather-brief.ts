import {
  and,
  desc,
  eq,
  gt,
  gte,
  isNull,
  like,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { readableChannel } from "../chat/readable-channel";
import db from "../database";
import {
  activityTable,
  chatChannelTable,
  chatMessageTable,
  dailyBriefChannelTable,
  projectTable,
  taskTable,
} from "../database/schema";
import { isWorkspaceGuest } from "../guest/is-workspace-guest";
import { projectAccessCondition } from "../project-access/project-access-condition";
import { taskIsUnfinished } from "../task/task-is-unfinished";
import { commentPreview } from "../utils/comment-preview";
import { parseMentionIds } from "../utils/parse-mentions";
import type { DailyBriefContent } from "./brief-type";
import { zoneMidnight } from "./local-time";

const DAY_MS = 86_400_000;
const LIMIT = 50;

const ticketColumns = {
  id: taskTable.id,
  title: taskTable.title,
  projectId: taskTable.projectId,
  slug: projectTable.slug,
  number: taskTable.number,
};
const ticketOf = (row: {
  id: string;
  title: string;
  projectId: string;
  slug: string;
  number: number | null;
}) => ({
  id: row.id,
  title: row.title,
  ticket: `${row.slug.toUpperCase()}-${row.number}`,
  projectId: row.projectId,
});

/**
 * The person's brief for `day`: their open tickets due that day, mentions of
 * them in the channels they chose, and their tickets someone else moved in
 * the last day. Everything is read as them, so nothing they cannot open
 * appears. It lists tickets and messages and never who did what.
 */
export async function gatherBrief(
  workspaceId: string,
  userId: string,
  day: string,
  timeZone: string | null,
  now: Date,
): Promise<DailyBriefContent> {
  const dayStart = zoneMidnight(day, timeZone);
  const next = new Date(`${day}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const dayEnd = zoneMidnight(next.toISOString().slice(0, 10), timeZone);
  const since = new Date(now.getTime() - DAY_MS);
  const mine = and(
    eq(projectTable.workspaceId, workspaceId),
    eq(taskTable.userId, userId),
    ne(taskTable.status, "archived"),
    projectAccessCondition(userId, projectTable.id),
  );

  const due = await db
    .select(ticketColumns)
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        mine,
        taskIsUnfinished,
        gte(taskTable.dueDate, dayStart),
        lt(taskTable.dueDate, dayEnd),
      ),
    )
    .orderBy(taskTable.number)
    .limit(LIMIT);

  const guest = await isWorkspaceGuest(workspaceId, userId);
  const messages = await db
    .select({
      id: chatMessageTable.id,
      body: chatMessageTable.body,
      channelId: chatChannelTable.id,
      channelName: chatChannelTable.name,
      createdAt: chatMessageTable.createdAt,
    })
    .from(chatMessageTable)
    .innerJoin(
      chatChannelTable,
      eq(chatChannelTable.id, chatMessageTable.channelId),
    )
    .innerJoin(
      dailyBriefChannelTable,
      and(
        eq(dailyBriefChannelTable.channelId, chatChannelTable.id),
        eq(dailyBriefChannelTable.userId, userId),
      ),
    )
    .where(
      and(
        eq(chatChannelTable.workspaceId, workspaceId),
        isNull(chatChannelTable.directKey),
        readableChannel(userId, workspaceId, guest),
        or(
          isNull(chatMessageTable.userId),
          ne(chatMessageTable.userId, userId),
        ),
        gt(chatMessageTable.createdAt, since),
        lte(chatMessageTable.createdAt, now),
        like(chatMessageTable.body, `%id="${userId}"%`),
      ),
    )
    .orderBy(desc(chatMessageTable.createdAt))
    .limit(LIMIT);

  const changes = await db
    .select({
      ...ticketColumns,
      status: sql<string>`${activityTable.eventData}->>'newStatus'`,
    })
    .from(activityTable)
    .innerJoin(taskTable, eq(taskTable.id, activityTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        mine,
        eq(activityTable.type, "status_changed"),
        or(isNull(activityTable.userId), ne(activityTable.userId, userId)),
        gt(activityTable.createdAt, since),
        lte(activityTable.createdAt, now),
      ),
    )
    .orderBy(desc(activityTable.createdAt))
    .limit(LIMIT * 4);
  const moved = new Map<string, DailyBriefContent["moved"][number]>();
  for (const change of changes)
    if (!moved.has(change.id))
      moved.set(change.id, {
        ...ticketOf(change),
        status: change.status ?? "",
      });

  return {
    dueToday: due.map(ticketOf),
    mentions: messages
      .filter((message) => parseMentionIds(message.body).includes(userId))
      .map((message) => ({
        messageId: message.id,
        channelId: message.channelId,
        channelName: message.channelName,
        preview: commentPreview(message.body),
        createdAt: message.createdAt.toISOString(),
      })),
    moved: [...moved.values()].slice(0, LIMIT),
  };
}
