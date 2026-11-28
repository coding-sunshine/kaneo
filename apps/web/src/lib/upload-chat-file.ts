import { createChatFileUpload, finalizeChatFile } from "@/fetchers/chat/files";
import { formatFileSize, MAX_UPLOAD_BYTES } from "./upload-task-image";

/** Uploads a file to storage, then posts it to the channel as a message. */
export async function uploadChatFile({
  workspaceId,
  channelId,
  file,
  body,
}: {
  workspaceId: string;
  channelId: string;
  file: File;
  body?: string;
}) {
  if (file.size <= 0) {
    throw new Error("Only non-empty file uploads are supported.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `${file.name || "File"} is ${formatFileSize(file.size)}. The limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB per file.`,
    );
  }

  const param = { workspaceId, channelId };
  const name = file.name || "file";
  const upload = await createChatFileUpload(param, {
    filename: name,
    size: file.size,
  });
  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.headers,
    body: file,
  });
  if (!response.ok) {
    throw new Error("Failed to upload file to storage.");
  }
  return finalizeChatFile(param, {
    key: upload.key,
    filename: name,
    size: file.size,
    body,
  });
}
