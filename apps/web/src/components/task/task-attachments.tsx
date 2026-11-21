import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import {
  deleteTaskAttachment,
  listTaskAttachments,
} from "@/fetchers/task/task-attachments";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { formatFileSize, uploadTaskImage } from "@/lib/upload-task-image";
import { SectionAddButton } from "./sections/section-add-button";
import { SectionHeader } from "./sections/section-header";

type Upload = { key: string; name: string; percent: number };

function iconFor(mimeType: string, filename: string) {
  const type = mimeType.toLowerCase();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (type.startsWith("image/")) return FileImageIcon;
  if (type.startsWith("video/")) return FileVideoIcon;
  if (type.startsWith("audio/")) return FileAudioIcon;
  if (type === "application/pdf" || type.startsWith("text/"))
    return FileTextIcon;
  if (/zip|tar|gzip|compressed|rar|7z/.test(type)) return FileArchiveIcon;
  if (/sheet|excel|csv/.test(type) || ["csv", "xls", "xlsx"].includes(ext))
    return FileSpreadsheetIcon;
  if (/json|xml|javascript|html/.test(type)) return FileCodeIcon;
  return FileIcon;
}

export default function TaskAttachments({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const queryKey = ["task-attachments", taskId];

  const { data: attachments = [] } = useQuery({
    queryKey,
    queryFn: () => listTaskAttachments(taskId),
    refetchOnMount: "always",
  });

  const remove = useMutation({
    mutationFn: (assetId: string) => deleteTaskAttachment(taskId, assetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error(t("tasks:detail.attachments.deleteFailed")),
  });

  const uploadFiles = (files: File[]) => {
    for (const file of files) {
      const key = `${file.name}-${Date.now()}-${Math.random()}`;
      const setPercent = (percent: number) =>
        setUploads((current) =>
          current.map((u) => (u.key === key ? { ...u, percent } : u)),
        );
      setUploads((current) => [
        ...current,
        { key, name: file.name, percent: 0 },
      ]);
      uploadTaskImage({
        taskId,
        surface: "attachment",
        file,
        onProgress: setPercent,
      })
        .catch((error) =>
          toast.error(
            error instanceof Error
              ? error.message
              : t("tasks:detail.editor.upload.failed"),
          ),
        )
        .finally(() => {
          setUploads((current) => current.filter((u) => u.key !== key));
          void queryClient.invalidateQueries({ queryKey });
        });
    }
  };

  // Files dropped anywhere on the page become attachments, unless an editor
  // already took the drop (it calls preventDefault) to embed the file inline.
  const uploadRef = useRef(uploadFiles);
  uploadRef.current = uploadFiles;
  useEffect(() => {
    if (!canEdit) return;
    const isFileDrag = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const onOver = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      setDragging(true);
    };
    const onLeave = (event: DragEvent) => {
      if (!event.relatedTarget) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      setDragging(false);
      if (event.defaultPrevented || !isFileDrag(event)) return;
      event.preventDefault();
      uploadRef.current(Array.from(event.dataTransfer?.files ?? []));
    };
    document.addEventListener("dragover", onOver);
    document.addEventListener("dragleave", onLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onOver);
      document.removeEventListener("dragleave", onLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, [canEdit]);

  if (!canEdit && attachments.length === 0) return null;

  return (
    <section
      aria-label={t("tasks:detail.attachments.title")}
      data-testid="task-attachments"
      className={cn(
        "rounded-md transition-colors",
        dragging && "bg-accent/50 ring-1 ring-ring",
      )}
    >
      <SectionHeader
        title={t("tasks:detail.attachments.title")}
        meta={
          attachments.length > 0 ? (
            <span className="text-muted-foreground text-xs">
              {attachments.length}
            </span>
          ) : undefined
        }
        action={
          canEdit ? (
            <>
              <SectionAddButton
                aria-label={t("tasks:detail.attachments.add")}
                title={t("tasks:detail.attachments.add")}
                onClick={() => inputRef.current?.click()}
              />
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                data-testid="attachment-input"
                onChange={(event) => {
                  uploadFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </>
          ) : undefined
        }
      />
      <ul className="mt-1 flex flex-col gap-1">
        {attachments.map((file) => {
          const Icon = iconFor(file.mimeType, file.filename);
          return (
            <li
              key={file.id}
              className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent/50"
            >
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-2 outline-none"
                title={file.filename}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-[13px]">{file.filename}</span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {formatFileSize(file.size)}
                </span>
              </a>
              {canEdit && (
                <button
                  type="button"
                  aria-label={t("tasks:detail.attachments.delete")}
                  title={t("tasks:detail.attachments.delete")}
                  className="rounded p-1 text-muted-foreground opacity-0 outline-none transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(file.id)}
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              )}
            </li>
          );
        })}
        {uploads.map((upload) => (
          <li key={upload.key} className="flex flex-col gap-1 px-1.5 py-1">
            <div className="flex justify-between text-xs">
              <span className="truncate">{upload.name}</span>
              <span className="text-muted-foreground">{upload.percent}%</span>
            </div>
            <Progress value={upload.percent} />
          </li>
        ))}
      </ul>
    </section>
  );
}
