import { eq } from "drizzle-orm";
import type { z } from "zod";
import db from "../../database";
import { chatChannelTable } from "../../database/schema";
import type { updateChannelBody } from "../schema";
import { forgetAiCopies } from "./forget-ai-copies";
import { getChannel } from "./get-channel";
import { loadChannel } from "./load-channel";

export async function updateChannel(
  workspaceId: string,
  channelId: string,
  userId: string,
  { archived, ...fields }: z.infer<typeof updateChannelBody>,
) {
  // AI on or off is the one change open to members of a direct message.
  const onlyAi =
    archived === undefined &&
    Object.entries(fields).every(
      ([key, value]) => key === "aiDisabled" || value === undefined,
    );
  const channel = await loadChannel(
    workspaceId,
    channelId,
    userId,
    onlyAi ? "ai" : "manage",
  );
  const archivedAt =
    archived === undefined
      ? undefined
      : archived
        ? (channel.archivedAt ?? new Date())
        : null;
  const changes = { ...fields, archivedAt };
  if (Object.values(changes).some((value) => value !== undefined))
    await db
      .update(chatChannelTable)
      .set(changes)
      .where(eq(chatChannelTable.id, channelId));
  if (fields.aiDisabled) await forgetAiCopies(workspaceId, channelId);
  return getChannel(workspaceId, channelId, userId);
}
