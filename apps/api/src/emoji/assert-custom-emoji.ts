import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { workspaceEmojiTable } from "../database/schema";
import { CUSTOM_EMOJI_SHORTCODE } from "./constants";

/** A `:name:` reaction must name a custom emoji of this workspace. */
export async function assertCustomEmojiExists(
  workspaceId: string,
  emoji: string,
) {
  const custom = CUSTOM_EMOJI_SHORTCODE.exec(emoji);
  if (!custom) return;
  const [exists] = await db
    .select({ id: workspaceEmojiTable.id })
    .from(workspaceEmojiTable)
    .where(
      and(
        eq(workspaceEmojiTable.workspaceId, workspaceId),
        eq(workspaceEmojiTable.name, custom[1] as string),
      ),
    )
    .limit(1);
  if (!exists)
    throw new HTTPException(400, {
      message: `Custom emoji ${emoji} does not exist in this workspace`,
    });
}
