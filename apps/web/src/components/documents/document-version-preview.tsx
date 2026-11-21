import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import { Button } from "@/components/ui/button";
import type { DocumentVersion } from "@/fetchers/document/documents";
import { formatDateTime } from "@/lib/format";

type DocumentVersionPreviewProps = {
  version: DocumentVersion;
  canRestore: boolean;
  restoring: boolean;
  onRestore: () => void;
};

/** A past version, read-only, with a Restore button for editors. */
export function DocumentVersionPreview({
  version,
  canRestore,
  restoring,
  onRestore,
}: DocumentVersionPreviewProps) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto w-full max-w-[55rem] px-6 pt-6 sm:px-10">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs">
        <span className="text-muted-foreground">
          {t("navigation:documents.history.viewing", {
            time: formatDateTime(version.updatedAt),
            name: version.authorName ?? "",
          })}
        </span>
        {canRestore && (
          <Button size="xs" onClick={onRestore} disabled={restoring}>
            {t("navigation:documents.history.restore")}
          </Button>
        )}
      </div>
      <h1 className="mt-14 font-semibold text-2xl leading-8">
        {version.title || t("navigation:documents.untitled")}
      </h1>
      <div className="kaneo-document-body mt-8">
        <CommentEditor
          value={version.content}
          readOnly
          className="kaneo-comment-viewer [&_.kaneo-comment-editor-content_.ProseMirror]:px-0 [&_.kaneo-comment-editor-content_.ProseMirror]:text-[15px] [&_.kaneo-comment-editor-content_.ProseMirror]:leading-6"
        />
      </div>
    </div>
  );
}
