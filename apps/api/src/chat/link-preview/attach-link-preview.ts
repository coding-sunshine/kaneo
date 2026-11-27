import { and, eq } from "drizzle-orm";
import db from "../../database";
import { chatMessageTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { createUserRateLimit } from "../../utils/user-rate-limit";
import { fetchLinkPreview } from "./fetch-link-preview";
import { findPreviewUrl } from "./find-preview-url";

// Every preview is a fetch the server makes for the author, so one person
// cannot use chat to make it fetch pages on a loop.
const fetchLimit = createUserRateLimit({ limit: 30, windowMs: 60_000 });

type MessageRef = { workspaceId: string; channelId: string; messageId: string };

export async function attachLinkPreview(ref: MessageRef) {
  const [message] = await db
    .select({ body: chatMessageTable.body, userId: chatMessageTable.userId })
    .from(chatMessageTable)
    .where(
      and(
        eq(chatMessageTable.id, ref.messageId),
        eq(chatMessageTable.channelId, ref.channelId),
      ),
    );
  const url = message && findPreviewUrl(message.body);
  if (!url || !message.userId) return;
  if (!fetchLimit.take(message.userId).ok) {
    console.warn(
      `Link preview skipped: too many previews for the author of chat message ${ref.messageId}`,
    );
    return;
  }
  const result = await fetchLinkPreview(url);
  if (result.status === "blocked") {
    // The link itself may be private workspace data, so log only the message.
    console.warn(
      `Link preview blocked a fetch to a non-routable address for chat message ${ref.messageId}`,
    );
    return;
  }
  if (result.status !== "ok") return;
  await db
    .update(chatMessageTable)
    .set({ linkPreview: result.preview })
    .where(eq(chatMessageTable.id, ref.messageId));
  await publishEvent("chat.message_updated", ref);
}
