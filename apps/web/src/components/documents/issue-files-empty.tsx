import { useTranslation } from "react-i18next";
import { DocumentsIllustration } from "./documents-illustration";

/** The Issue files tab when no issue you can open has a file. */
export function IssueFilesEmpty() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="flex max-w-80 flex-col items-start">
        <DocumentsIllustration />
        <h2 className="mt-8 font-semibold text-[15px]">
          {t("navigation:documents.issueFiles.emptyTitle")}
        </h2>
        <p className="mt-2 text-[13px] text-muted-foreground leading-[18px]">
          {t("navigation:documents.issueFiles.emptyText")}
        </p>
      </div>
    </div>
  );
}
