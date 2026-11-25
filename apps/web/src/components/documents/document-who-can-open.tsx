import { useTranslation } from "react-i18next";
import { useDocumentAudience } from "@/hooks/queries/document/use-documents";

type DocumentWhoCanOpenProps = { workspaceId: string; id: string };

/** The people who can open the document right now. */
export function DocumentWhoCanOpen({
  workspaceId,
  id,
}: DocumentWhoCanOpenProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useDocumentAudience(workspaceId, id, {});
  return (
    <div className="border-border/60 border-b pb-2">
      <p className="px-3 pt-3 pb-1 font-medium text-[11px] text-muted-foreground">
        {t("navigation:documents.whoCanOpen.title")}
      </p>
      <div className="px-3 text-xs">
        {isLoading && (
          <p className="text-muted-foreground">
            {t("navigation:documents.whoCanOpen.loading")}
          </p>
        )}
        {isError && (
          <p className="text-destructive-foreground">
            {t("navigation:documents.whoCanOpen.failed")}
          </p>
        )}
        {data && (
          <>
            <p className="font-medium">
              {t("navigation:documents.whoCanOpen.count", {
                count: data.current.length,
              })}
            </p>
            <p className="mt-0.5 max-h-20 overflow-y-auto text-muted-foreground">
              {data.current.map((person) => person.name).join(", ")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
