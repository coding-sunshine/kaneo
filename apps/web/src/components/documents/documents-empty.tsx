import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { DocumentFilter } from "@/fetchers/document/documents";
import { DOCUMENT_TABS } from "./document-tab";
import { DocumentsIllustration } from "./documents-illustration";

type DocumentsEmptyProps = {
  workspaceId: string;
  filter: DocumentFilter;
  onCreate: () => void;
  creating: boolean;
};

/**
 * Linear's per-tab empty state. Shared with me and the Inbox have nothing to
 * create: a new document is a private draft.
 */
export function DocumentsEmpty({
  workspaceId,
  filter,
  onCreate,
  creating,
}: DocumentsEmptyProps) {
  const { t } = useTranslation();
  // Tabs with nothing to create point at the tab where the work is.
  const next =
    filter === "shared" ? "mine" : filter === "inbox" ? "unfiled" : null;
  const slug = DOCUMENT_TABS.find((tab) => tab.filter === next)?.slug ?? "";
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="flex max-w-80 flex-col items-start">
        <DocumentsIllustration />
        <h2 className="mt-8 font-semibold text-[15px]">
          {t(`navigation:documents.tabs.${filter}`)}
        </h2>
        <p className="mt-2 text-[13px] text-muted-foreground leading-[18px]">
          {t(`navigation:documents.empty.${filter}`)}
        </p>
        {next ? (
          <Button
            size="xs"
            className="mt-6 rounded-full"
            render={
              <Link
                to="/dashboard/workspace/$workspaceId/documents/$tab"
                params={{ workspaceId, tab: slug }}
              />
            }
          >
            {t("navigation:documents.empty.openTab", {
              tab: t(`navigation:documents.tabs.${next}`),
            })}
          </Button>
        ) : (
          <Button
            size="xs"
            className="mt-6 rounded-full"
            onClick={onCreate}
            disabled={creating}
          >
            {t("navigation:documents.newDocument")}
          </Button>
        )}
      </div>
    </div>
  );
}
