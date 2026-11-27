import { eq } from "drizzle-orm";
import db from "../../database";
import { chatMessageTable, userTable } from "../../database/schema";

export const selectMessages = () =>
  db
    .select({
      id: chatMessageTable.id,
      channelId: chatMessageTable.channelId,
      userId: chatMessageTable.userId,
      authorName: userTable.name,
      authorImage: userTable.image,
      body: chatMessageTable.body,
      linkPreview: chatMessageTable.linkPreview,
      createdAt: chatMessageTable.createdAt,
    })
    .from(chatMessageTable)
    .leftJoin(userTable, eq(userTable.id, chatMessageTable.userId));
