import { useTranslation } from "react-i18next";
import type {
  DocumentComment,
  DocumentDetail,
} from "@/fetchers/document/documents";
import { useCreateDocumentComment } from "@/hooks/mutations/document/use-document-mutations";
import { cn } from "@/lib/cn";
import { DocumentCommentComposer } from "./document-comment-composer";
import { DocumentCommentItem } from "./document-comment-item";

type DocumentCommentThreadProps = {
  document: DocumentDetail;
  root: DocumentComment;
  replies: DocumentComment[];
};

/** A thread card: quoted text, the comments, then a Reply box. */
export function DocumentCommentThread({
  document,
  root,
  replies,
}: DocumentCommentThreadProps) {
  const { t } = useTranslation();
  const create = useCreateDocumentComment(document.workspaceId, document.id);
  const resolved = Boolean(root.resolvedAt);
  const canComment = document.role !== "view";

  return (
    <article
      className={cn(
        "rounded-lg border border-border/70 bg-card p-3 shadow-xs",
        resolved && "opacity-70",
      )}
    >
      {resolved && (
        <p className="mb-2 text-muted-foreground text-xs">
          {t("navigation:documents.comments.resolved")}
        </p>
      )}
      {root.quotedText && (
        <blockquote className="mb-2 line-clamp-3 border-amber-400/80 border-l-2 ps-2 text-muted-foreground text-xs">
          {root.quotedText}
        </blockquote>
      )}
      <div className="flex flex-col gap-3">
        <DocumentCommentItem document={document} comment={root} isRoot />
        {replies.map((reply) => (
          <DocumentCommentItem
            key={reply.id}
            document={document}
            comment={reply}
            isRoot={false}
          />
        ))}
      </div>
      {canComment && !resolved && (
        <DocumentCommentComposer
          placeholder={t("navigation:documents.comments.reply")}
          onSubmit={(content) =>
            create.mutateAsync({ content, parentId: root.id })
          }
          className="mt-2 border-border/60 border-t pt-2"
        />
      )}
    </article>
  );
}
