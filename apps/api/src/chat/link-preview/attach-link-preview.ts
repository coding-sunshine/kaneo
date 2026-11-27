import { and, eq } from "drizzle-orm";
import db from "../../database";
import { chatMessageTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { fetchLinkPreview } from "./fetch-link-preview";
import { findPreviewUrl } from "./find-preview-url";

type MessageRef = { workspaceId: string; channelId: string; messageId: string };

export async function attachLinkPreview(ref: MessageRef) {
  const [message] = await db
    .select({ body: chatMessageTable.body })
    .from(chatMessageTable)
    .where(
      and(
        eq(chatMessageTable.id, ref.messageId),
        eq(chatMessageTable.channelId, ref.channelId),
      ),
    );
  const url = message && findPreviewUrl(message.body);
  if (!url) return;
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
