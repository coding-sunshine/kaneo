import { HTTPException } from "hono/http-exception";
import { requireWorkspaceEntitlement } from "../../billing/controllers/require-entitlement";
import db from "../../database";
import { chatReminderTable } from "../../database/schema";
import createTask from "../../task/controllers/create-task";
import updateOwnProfile from "../../user/controllers/update-own-profile";
import { updateProfileBody } from "../../user/profile/profile-schema";
import { loadChannel } from "../controllers/load-channel";
import { postMessage } from "../controllers/post-message";
import { deleteDraft } from "../controllers/save-draft";
import { parseCommand } from "./parse-command";
import { pickTicketTeam } from "./pick-ticket-team";

const USAGE = {
  remind:
    "Use /remind in <number> <minutes|hours|days|weeks> [note], up to a year ahead",
  status: "Use /status <text> of up to 100 characters, or /status clear",
  ticket: "Use /ticket <title> of up to 200 characters",
  unknown: "Unknown command. Try /remind, /status or /ticket",
} as const;

/**
 * Runs a slash command typed in a channel the caller may post to. /remind and
 * /status answer the caller only and post nothing; /ticket files a ticket and
 * posts its key, which readers see as its card.
 */
export async function runChatCommand({
  workspaceId,
  channelId,
  userId,
  text,
  canCreateTickets,
  hasUserSession,
}: {
  workspaceId: string;
  channelId: string;
  userId: string;
  text: string;
  canCreateTickets: boolean;
  hasUserSession: boolean;
}) {
  await loadChannel(workspaceId, channelId, userId, "post");
  const command = parseCommand(text);
  if ("error" in command)
    throw new HTTPException(400, { message: USAGE[command.error] });

  switch (command.name) {
    case "remind": {
      const remindAt = new Date(Date.now() + command.delayMs);
      await db.insert(chatReminderTable).values({
        userId,
        workspaceId,
        channelId,
        note: command.note,
        remindAt,
      });
      await deleteDraft(channelId, userId);
      return { command: "remind" as const, remindAt: remindAt.toISOString() };
    }
    case "status": {
      if (!hasUserSession)
        throw new HTTPException(403, {
          message: "A user session is required",
        });
      await updateOwnProfile(
        userId,
        updateProfileBody.parse({
          status: command.text ? { text: command.text } : null,
        }),
      );
      await deleteDraft(channelId, userId);
      return { command: "status" as const, status: command.text };
    }
    case "ticket": {
      if (!canCreateTickets)
        throw new HTTPException(403, {
          message: "Missing permission to create tickets",
        });
      const team = await pickTicketTeam(workspaceId, userId);
      if (!team)
        throw new HTTPException(409, {
          message: "There is no team you can add tickets to",
        });
      await requireWorkspaceEntitlement(workspaceId);
      const task = await createTask({
        projectId: team.id,
        currentUserId: userId,
        title: command.title,
        status: team.status,
      });
      const key = `${team.slug.toUpperCase()}-${task.number}`;
      const message = await postMessage(workspaceId, channelId, userId, key);
      return {
        command: "ticket" as const,
        taskId: task.id,
        key,
        messageId: message.id,
      };
    }
  }
}
