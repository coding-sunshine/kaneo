import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { DocumentSummary } from "@/fetchers/document/documents";
import { cn } from "@/lib/cn";
import { formatDateShort, formatDateTime } from "@/lib/format";
import { DocumentAccessLabel } from "./document-access-label";
import { STATUS_TONE } from "./document-status-tone";

/** Name, Visibility, Last activity: shared by the header and every row. */
export const TABLE_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,18rem)_8rem] gap-4";

type DocumentTableRowProps = {
  workspaceId: string;
  document: DocumentSummary;
  selected: boolean;
  /** Once one row is ticked, every row shows its box. */
  selecting: boolean;
  onSelect: () => void;
};

/** One document: a box that shows on hover, then the row that opens it. */
export function DocumentTableRow({
  workspaceId,
  document,
  selected,
  selecting,
  onSelect,
}: DocumentTableRowProps) {
  const { t } = useTranslation();
  const title = document.title || t("navigation:documents.untitled");
  return (
    <li
      className={cn(
        "group/row flex h-10 items-center rounded-md hover:bg-accent/50",
        selected && "bg-accent/60",
      )}
    >
      <span className="flex w-9 shrink-0 justify-center">
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          aria-label={t("navigation:documents.pins.selectRow", { title })}
          className={cn(
            "opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100",
            (selected || selecting) && "opacity-100",
          )}
        />
      </span>
      <Link
        to="/dashboard/workspace/$workspaceId/document/$documentId"
        params={{ workspaceId, documentId: document.id }}
        className={cn(
          TABLE_COLUMNS,
          "h-full min-w-0 flex-1 items-center pe-2 text-[13px] outline-none focus-visible:underline",
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <FileText
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="truncate">{title}</span>
          {document.status !== "current" && (
            <Badge
              variant={STATUS_TONE[document.status]}
              size="sm"
              className="shrink-0"
            >
              {t(`navigation:documents.status.${document.status}`)}
            </Badge>
          )}
        </span>
        <DocumentAccessLabel
          scope={document.scope}
          parentName={document.parentName}
          className="text-[13px] text-foreground/80"
        />
        <time
          dateTime={String(document.updatedAt)}
          title={formatDateTime(document.updatedAt)}
          className="truncate text-muted-foreground"
        >
          {t("navigation:documents.editedOn", {
            date: formatDateShort(document.updatedAt),
          })}
        </time>
      </Link>
    </li>
  );
}
