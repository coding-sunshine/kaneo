import { FileDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  MenuItem,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "@/components/ui/menu";
import {
  type DocumentExportFormat,
  exportDocument,
} from "@/fetchers/document/export-document";
import { downloadBlob } from "@/lib/download-blob";
import { safeFileName } from "@/lib/safe-file-name";
import { toast } from "@/lib/toast";

const EXTENSIONS: Record<DocumentExportFormat, string> = {
  markdown: "md",
  pdf: "pdf",
};

type DocumentExportMenuProps = {
  workspaceId: string;
  id: string;
  title: string;
};

/** Export submenu of a document's ··· menu: Markdown or PDF. */
export function DocumentExportMenu({
  workspaceId,
  id,
  title,
}: DocumentExportMenuProps) {
  const { t } = useTranslation();
  const download = (format: DocumentExportFormat) =>
    exportDocument(workspaceId, id, format)
      .then((file) =>
        downloadBlob(file, safeFileName(title, EXTENSIONS[format])),
      )
      .catch((error: Error) =>
        toast.error(error.message || t("navigation:documents.export.failed")),
      );

  return (
    <MenuSub>
      <MenuSubTrigger>
        <FileDown aria-hidden />
        {t("navigation:documents.export.label")}
      </MenuSubTrigger>
      <MenuSubPopup className="min-w-40">
        <MenuItem onClick={() => download("markdown")}>
          {t("navigation:documents.export.markdown")}
        </MenuItem>
        <MenuItem onClick={() => download("pdf")}>
          {t("navigation:documents.export.pdf")}
        </MenuItem>
      </MenuSubPopup>
    </MenuSub>
  );
}
