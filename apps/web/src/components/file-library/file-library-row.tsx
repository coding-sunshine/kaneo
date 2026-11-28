import { Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FileSourceLink } from "@/components/file-library/file-source-link";
import type { LibraryFile } from "@/fetchers/file-library/get-files";
import { formatRelativeTime } from "@/lib/format";
import { formatFileSize } from "@/lib/upload-task-image";

/** One file: download it by name, see who added it, and open where it lives. */
export function FileLibraryRow({
  workspaceId,
  file,
}: {
  workspaceId: string;
  file: LibraryFile;
}) {
  const { t, i18n } = useTranslation();

  return (
    <li className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 border-border/60 border-b px-4 py-2 text-[13px]">
      <span className="flex min-w-0 flex-1 basis-56 items-center gap-2">
        <Paperclip
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate font-medium hover:underline"
        >
          {file.filename}
        </a>
        <span className="shrink-0 text-muted-foreground">
          {formatFileSize(file.size)}
        </span>
      </span>
      <span className="flex min-w-0 basis-48">
        <FileSourceLink workspaceId={workspaceId} source={file.source} />
      </span>
      <span className="w-36 truncate text-muted-foreground">
        {file.addedBy?.name ?? t("navigation:files.deletedUser")}
      </span>
      <time
        dateTime={new Date(file.createdAt).toISOString()}
        className="w-32 shrink-0 whitespace-nowrap text-end text-muted-foreground"
      >
        {formatRelativeTime(file.createdAt, i18n.language)}
      </time>
    </li>
  );
}
