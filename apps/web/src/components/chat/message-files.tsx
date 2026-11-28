import { resolveApiBaseUrl } from "@kaneo/libs";
import { Paperclip } from "lucide-react";
import type { ChatMessage } from "@/components/chat/types";
import { formatFileSize } from "@/lib/upload-task-image";

const apiBase = resolveApiBaseUrl(import.meta.env.VITE_API_URL);

/** The files sent with a message, each a download link. */
export function MessageFiles({ files }: { files: ChatMessage["files"] }) {
  if (files.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((file) => (
        <li key={file.id}>
          <a
            href={`${apiBase}/asset/${file.id}`}
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
        </li>
      ))}
    </ul>
  );
}
