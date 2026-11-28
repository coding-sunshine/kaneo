import { resolveApiBaseUrl } from "@kaneo/libs";
import { Paperclip } from "lucide-react";
import { isInlineImage } from "@/components/chat/inline-image-types";
import { MessageImage } from "@/components/chat/message-image";
import type { ChatMessage } from "@/components/chat/types";
import { formatFileSize } from "@/lib/upload-task-image";

const apiBase = resolveApiBaseUrl(import.meta.env.VITE_API_URL);

/** The files sent with a message: images in place, the rest download links. */
export function MessageFiles({
  workspaceId,
  channelId,
  files,
}: {
  workspaceId: string;
  channelId: string;
  files: ChatMessage["files"];
}) {
  if (files.length === 0) return null;
  const urlOf = (fileId: string) =>
    `${apiBase}/chat/workspace/${workspaceId}/channels/${channelId}/files/${fileId}`;
  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((file) => (
        <li key={file.id}>
          {isInlineImage(file.mimeType) ? (
            <MessageImage url={urlOf(file.id)} filename={file.filename} />
          ) : (
            <a
              href={urlOf(file.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-72 items-center gap-1.5 rounded-md border px-2 py-1 text-sm hover:bg-accent/60"
            >
              <Paperclip
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              <span className="truncate">{file.filename}</span>
              <span className="shrink-0 text-muted-foreground text-xs">
                {formatFileSize(file.size)}
              </span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
