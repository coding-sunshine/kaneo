import {
  FileText,
  FolderKanban,
  MessageSquare,
  MessagesSquare,
  User,
  Users,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  searchResultDetail,
  searchResultTitle,
} from "@/components/search-page/search-result-title";
import type { SearchResult } from "@/components/search-page/types";
import { getPriorityIcon } from "@/lib/priority";

const ICONS: Record<string, typeof FileText> = {
  message: MessagesSquare,
  document: FileText,
  project: FolderKanban,
  person: User,
  comment: MessageSquare,
  activity: Zap,
  workspace: Users,
};

/** One search hit: what it is, where it lives, and a click to open it. */
export function SearchResultRow({
  result,
  onOpen,
}: {
  result: SearchResult;
  onOpen: (result: SearchResult) => void;
}) {
  const { t } = useTranslation();
  const Icon = ICONS[result.type] ?? FileText;
  const detail = searchResultDetail(result);
  const where =
    result.type === "message" ? result.userName : result.projectName;

  return (
    <button
      type="button"
      onClick={() => onOpen(result)}
      className="w-full flex items-center gap-2.5 px-3 py-3 sm:gap-3 sm:px-4 rounded-lg border border-border bg-background hover:bg-accent/60 transition-colors text-left"
    >
      <div className="flex-shrink-0 text-muted-foreground first:[&_svg]:h-4 first:[&_svg]:w-4">
        {result.type === "task" ? (
          getPriorityIcon(result.priority ?? "")
        ) : (
          <Icon aria-hidden="true" />
        )}
      </div>

      {result.type === "task" && result.projectSlug && result.taskNumber && (
        <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
          {result.projectSlug}-{result.taskNumber}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground truncate block">
          {searchResultTitle(result, t("workspace:search.directMessage"))}
        </span>
        {detail && (
          <span className="text-xs text-muted-foreground truncate block">
            {detail}
          </span>
        )}
      </div>

      {where && (
        <span className="hidden text-xs text-muted-foreground flex-shrink-0 sm:inline">
          {where}
        </span>
      )}

      {result.type === "task" && result.status && (
        <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-border bg-muted/55 text-muted-foreground flex-shrink-0">
          {result.status}
        </span>
      )}
    </button>
  );
}
