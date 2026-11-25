import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ShortcutTooltipLabel } from "@/components/shortcuts/shortcut-tooltip-label";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { DOCUMENT_TABS, type DocumentTabKey } from "./document-tab";

type DocumentsTabsProps = {
  workspaceId: string;
  value: DocumentTabKey;
};

/** One pill per Documents tab; 1 to 6 switch them. */
export function DocumentsTabs({ workspaceId, value }: DocumentsTabsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const open = (slug: string | null) =>
    slug
      ? navigate({
          to: "/dashboard/workspace/$workspaceId/documents/$tab",
          params: { workspaceId, tab: slug },
        })
      : navigate({
          to: "/dashboard/workspace/$workspaceId/documents",
          params: { workspaceId },
        });

  useShortcut("documentsRecent", () => open(DOCUMENT_TABS[0].slug));
  useShortcut("documentsMine", () => open(DOCUMENT_TABS[1].slug));
  useShortcut("documentsShared", () => open(DOCUMENT_TABS[2].slug));
  useShortcut("documentsUnfiled", () => open(DOCUMENT_TABS[3].slug));
  useShortcut("documentsInbox", () => open(DOCUMENT_TABS[4].slug));
  useShortcut("documentsIssueFiles", () => open(DOCUMENT_TABS[5].slug));

  return (
    <div role="tablist" className="inline-flex items-center gap-1.5">
      {DOCUMENT_TABS.map((tab) => {
        const name = t(`navigation:documents.tabs.${tab.filter}`);
        return (
          <Tooltip key={tab.filter}>
            <TooltipTrigger
              render={
                <Button
                  role="tab"
                  aria-selected={value === tab.filter}
                  variant="outline"
                  size="xs"
                  onClick={() => open(tab.slug)}
                  className={cn(
                    "rounded-full",
                    value === tab.filter
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground",
                  )}
                />
              }
            >
              {name}
            </TooltipTrigger>
            <TooltipContent className="max-w-72">
              <ShortcutTooltipLabel
                label={t("navigation:documents.viewTab", { name })}
                shortcutId={tab.shortcut}
              />
              <p className="mt-1 text-muted-foreground">
                {t(`navigation:documents.tabHints.${tab.filter}`)}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
