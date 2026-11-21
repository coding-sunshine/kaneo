import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { DocumentFilter } from "@/fetchers/document/documents";
import { DocumentsIllustration } from "./documents-illustration";

type DocumentsEmptyProps = {
  filter: DocumentFilter;
  onCreate: () => void;
  creating: boolean;
};

/** Linear's per-tab empty state; Shared with me has nothing to create. */
export function DocumentsEmpty({
  filter,
  onCreate,
  creating,
}: DocumentsEmptyProps) {
  const { t } = useTranslation();
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
        {filter !== "shared" && (
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
