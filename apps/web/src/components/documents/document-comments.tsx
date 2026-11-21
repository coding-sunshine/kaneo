import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DocumentComment,
  DocumentDetail,
} from "@/fetchers/document/documents";
import { useCreateDocumentComment } from "@/hooks/mutations/document/use-document-mutations";
import { useDocumentComments } from "@/hooks/queries/document/use-documents";
import { DocumentCommentComposer } from "./document-comment-composer";
import { DocumentCommentThread } from "./document-comment-thread";

type DocumentCommentsProps = {
  document: DocumentDetail;
  onClose: () => void;
};

/** Linear's Comments column beside a document. */
export function DocumentComments({ document, onClose }: DocumentCommentsProps) {
  const { t } = useTranslation();
  const { workspaceId, id } = document;
  const { data: comments = [], isLoading } = useDocumentComments(
    workspaceId,
    id,
  );
  const create = useCreateDocumentComment(workspaceId, id);
  const [showResolved, setShowResolved] = useState(false);
  const canComment = document.role !== "view";

  const replies = new Map<string, DocumentComment[]>();
  for (const comment of comments) {
    if (!comment.parentId) continue;
    replies.set(comment.parentId, [
      ...(replies.get(comment.parentId) ?? []),
      comment,
    ]);
  }
  const roots = comments.filter((comment) => !comment.parentId);
  const resolvedCount = roots.filter((root) => root.resolvedAt).length;
  const visible = roots.filter((root) => showResolved || !root.resolvedAt);

  return (
    <aside
      aria-label={t("navigation:documents.comments.title")}
      className="flex w-full max-w-[380px] shrink-0 flex-col border-border/60 border-l"
    >
      <div className="flex h-11 shrink-0 items-center gap-1 px-4">
        <h2 className="font-medium text-[13px]">
          {t("navigation:documents.comments.title")}
        </h2>
        {resolvedCount > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowResolved((value) => !value)}
            className="ms-auto text-muted-foreground"
          >
            {showResolved
              ? t("navigation:documents.comments.hideResolved")
              : t("navigation:documents.comments.showResolved")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("navigation:documents.closeComments")}
          onClick={onClose}
          className={resolvedCount > 0 ? undefined : "ms-auto"}
        >
          <X aria-hidden />
        </Button>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : visible.length === 0 ? (
          <p className="px-1 py-2 text-muted-foreground text-xs">
            {t("navigation:documents.comments.empty")}
          </p>
        ) : (
          visible.map((root) => (
            <DocumentCommentThread
              key={root.id}
              document={document}
              root={root}
              replies={replies.get(root.id) ?? []}
            />
          ))
        )}
      </div>
      {canComment && (
        <DocumentCommentComposer
          placeholder={t("navigation:documents.comments.placeholder")}
          onSubmit={(content) => create.mutateAsync({ content })}
          className="m-3 mt-0 rounded-lg border border-border/70 bg-card px-3 py-1.5"
        />
      )}
    </aside>
  );
}
