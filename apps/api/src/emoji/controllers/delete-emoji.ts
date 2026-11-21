import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceEmojiTable } from "../../database/schema";
import { deleteS3Object } from "../../storage/s3";

/** Reactions keep their `:name:` text; the picker falls back to it. */
async function deleteEmoji(workspaceId: string, emojiId: string) {
  const [emoji] = await db
    .delete(workspaceEmojiTable)
    .where(
      and(
        eq(workspaceEmojiTable.workspaceId, workspaceId),
        eq(workspaceEmojiTable.id, emojiId),
      ),
    )
    .returning({ objectKey: workspaceEmojiTable.objectKey });
  if (!emoji) throw new HTTPException(404, { message: "Emoji not found" });
  deleteS3Object(emoji.objectKey).catch((error) => {
    console.warn(`S3 cleanup error: ${error}`);
  });
}

export default deleteEmoji;
