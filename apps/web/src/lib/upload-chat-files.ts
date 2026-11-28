import { uploadChatFile } from "./upload-chat-file";

/**
 * Sends several files as one message: the first posts it with the text, the
 * rest are added to it. Stops at the first file that fails.
 */
export async function uploadChatFiles({
  workspaceId,
  channelId,
  files,
  body,
}: {
  workspaceId: string;
  channelId: string;
  files: File[];
  body?: string;
}) {
  let messageId: string | undefined;
  for (const file of files) {
    const message = await uploadChatFile(
      messageId
        ? { workspaceId, channelId, file, messageId }
        : { workspaceId, channelId, file, body },
    );
    messageId = message.id;
  }
}
