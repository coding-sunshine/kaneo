import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { DocumentSummary } from "@/fetchers/document/documents";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import {
  type ActivityGroupKey,
  activityGroups,
} from "./document-activity-groups";
import { DocumentTableRow, TABLE_COLUMNS } from "./document-table-row";
import { useDocumentPins } from "./use-document-pins";

type DocumentTableProps = {
  workspaceId: string;
  documents: DocumentSummary[];
};

/**
 * Linear's Documents table: Name, Visibility and Last activity, rows grouped
 * by when they last changed. Ticking rows offers to pin them.
 */
export function DocumentTable({ workspaceId, documents }: DocumentTableProps) {
  const { t } = useTranslation();
  const pins = useDocumentPins(workspaceId);
  const [folded, setFolded] = useState<Set<ActivityGroupKey>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (!next.delete(value)) next.add(value);
    return next;
  };
  const pinSelected = () =>
    pins
      .pin([...selected])
      .then(() => {
        toast.success(t("navigation:documents.pins.pinned"));
        setSelected(new Set());
      })
      .catch((error: Error) => toast.error(error.message));

  return (
    <div className="relative flex min-h-0 flex-col px-4 pt-4 pb-16">
      <div
        className={cn(
          TABLE_COLUMNS,
          "h-8 items-center ps-9 pe-2 text-muted-foreground text-xs",
        )}
      >
        <span>{t("navigation:documents.columns.name")}</span>
        <span>{t("navigation:documents.columns.visibility")}</span>
        <span>{t("navigation:documents.columns.lastActivity")}</span>
      </div>
      {activityGroups(documents).map((group) => {
        const open = !folded.has(group.key);
        return (
          <section key={group.key} className="flex flex-col">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setFolded((set) => toggle(set, group.key))}
              className="flex h-9 items-center gap-2 rounded-md bg-muted/60 px-2.5 text-[13px] outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-3.5 text-muted-foreground transition-transform",
                  !open && "-rotate-90",
                )}
              />
              <span className="font-medium">
                {t(`navigation:documents.groups.${group.key}`)}
              </span>
              <span className="text-muted-foreground">
                {group.documents.length}
              </span>
            </button>
            {open && (
              <ul className="flex flex-col py-1">
                {group.documents.map((document) => (
                  <DocumentTableRow
                    key={document.id}
                    workspaceId={workspaceId}
                    document={document}
                    selected={selected.has(document.id)}
                    selecting={selected.size > 0}
                    onSelect={() =>
                      setSelected((set) => toggle(set, document.id))
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {selected.size > 0 && (
        <div className="-translate-x-1/2 fixed bottom-6 left-1/2 z-20 flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-1.5 text-[13px] shadow-lg">
          <span className="text-muted-foreground">
            {t("navigation:documents.pins.selected", { count: selected.size })}
          </span>
          <Button
            size="xs"
            variant="outline"
            disabled={pins.isPending}
            onClick={pinSelected}
          >
            {t("navigation:documents.pins.pin")}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setSelected(new Set())}
          >
            {t("navigation:documents.pins.clearSelection")}
          </Button>
        </div>
      )}
    </div>
  );
}
