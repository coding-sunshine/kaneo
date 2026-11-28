import { useTranslation } from "react-i18next";
import { useDocumentEditors } from "@/hooks/use-document-editors";

/** "Grace is editing" while someone else types in the document. */
export function DocumentEditingIndicator({
  documentId,
}: {
  documentId: string;
}) {
  const { t } = useTranslation();
  const names = useDocumentEditors(documentId);
  return (
    <span role="status" className="ml-1 text-muted-foreground">
      {names.length === 1
        ? t("navigation:documents.editing.one", { name: names[0] })
        : names.length > 1
          ? t("navigation:documents.editing.many", { names: names.join(", ") })
          : null}
    </span>
  );
}
