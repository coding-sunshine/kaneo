import { useTranslation } from "react-i18next";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { toast } from "@/lib/toast";

/** Copy a document's URL and confirm it, as Linear's link button does. */
export function useCopyDocumentLink(workspaceId: string, documentId: string) {
  const { t } = useTranslation();
  return async () => {
    const url = `${window.location.origin}/dashboard/workspace/${workspaceId}/document/${documentId}`;
    if (await copyToClipboard(url)) {
      toast.success(t("navigation:documents.linkCopied"));
    }
  };
}
