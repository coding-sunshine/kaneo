import { and, eq, inArray, isNull } from "drizzle-orm";
import { aiEnabledChannel } from "../assist/ai-allowed-channel";
import { readableChannel } from "../chat/readable-channel";
import db from "../database";
import { chatChannelTable, projectTable, taskTable } from "../database/schema";
import { isWorkspaceGuest } from "../guest/is-workspace-guest";
import { projectAccessCondition } from "../project-access/project-access-condition";
import type { DailyBriefContent } from "./brief-type";

/**
 * A stored brief, cut to what its owner may open now: lines from a channel
 * they left or that turned AI off, and tickets in a team they lost, go.
 */
export async function stillOpen(
  workspaceId: string,
  userId: string,
  content: DailyBriefContent,
): Promise<DailyBriefContent> {
  const channelIds = [...new Set(content.mentions.map((m) => m.channelId))];
  const taskIds = [
    ...new Set([...content.dueToday, ...content.moved].map((t) => t.id)),
  ];
  const guest = await isWorkspaceGuest(workspaceId, userId);
  const channels = channelIds.length
    ? await db
        .select({ id: chatChannelTable.id })
        .from(chatChannelTable)
        .where(
          and(
            inArray(chatChannelTable.id, channelIds),
            eq(chatChannelTable.workspaceId, workspaceId),
            isNull(chatChannelTable.directKey),
            aiEnabledChannel(),
            readableChannel(userId, workspaceId, guest),
          ),
        )
    : [];
  const tasks = taskIds.length
    ? await db
        .select({ id: taskTable.id })
        .from(taskTable)
        .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
        .where(
          and(
            inArray(taskTable.id, taskIds),
            eq(projectTable.workspaceId, workspaceId),
            projectAccessCondition(userId, projectTable.id),
          ),
        )
    : [];
  const openChannels = new Set(channels.map((row) => row.id));
  const openTasks = new Set(tasks.map((row) => row.id));
  return {
    dueToday: content.dueToday.filter((task) => openTasks.has(task.id)),
    mentions: content.mentions.filter((m) => openChannels.has(m.channelId)),
    moved: content.moved.filter((task) => openTasks.has(task.id)),
  };
}
