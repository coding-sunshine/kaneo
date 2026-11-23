import { FilePen, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { TaskDraft } from "@/fetchers/task-draft/task-drafts";
import { formatRelativeTime } from "@/lib/format";

type TaskDraftRowProps = {
  draft: TaskDraft;
  onOpen: (draft: TaskDraft) => void;
  onDelete: (draft: TaskDraft) => void;
};

/** One saved draft: click to continue it, trash to delete it. */
export function TaskDraftRow({ draft, onOpen, onDelete }: TaskDraftRowProps) {
  const { t, i18n } = useTranslation();

  return (
    <li className="group/row flex h-11 items-center border-border/60 border-b text-[13px] hover:bg-accent/50">
      <button
        type="button"
        onClick={() => onOpen(draft)}
        className="flex h-full min-w-0 flex-1 items-center gap-3 px-4 text-left"
      >
        <FilePen aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">
          {draft.title || t("navigation:drafts.untitled")}
        </span>
        <span className="text-muted-foreground">
          {formatRelativeTime(draft.updatedAt, i18n.language)}
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="me-2"
        aria-label={t("navigation:drafts.delete")}
        onClick={() => onDelete(draft)}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </li>
  );
}
