import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import { DocumentCommentComposer } from "@/components/documents/document-comment-composer";
import { DocumentCommentThread } from "@/components/documents/document-comment-thread";
import { groupDocumentThreads } from "@/components/documents/group-document-threads";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateDocumentComment } from "@/hooks/mutations/document/use-document-mutations";
import {
  useDocument,
  useDocumentComments,
} from "@/hooks/queries/document/use-documents";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { InboxDocumentQuestions } from "./inbox-document-questions";

type InboxDocumentProps = { workspaceId: string; documentId: string };

// The document a notification points at: its body and open threads, so a
// reply doesn't need a trip to the document.
export function InboxDocument({ workspaceId, documentId }: InboxDocumentProps) {
  const { t } = useTranslation();
  const { data: document, isLoading } = useDocument(workspaceId, documentId);
  const { data: comments = [] } = useDocumentComments(workspaceId, documentId);
  const create = useCreateDocumentComment(workspaceId, documentId);
  const navigate = useNavigate();
  const params = { workspaceId, documentId };
  useShortcut(
    "openFocusedTask",
    () =>
      navigate({
        to: "/dashboard/workspace/$workspaceId/document/$documentId",
        params,
      }),
    { enabled: Boolean(document) },
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!document) {
    return (
      <p role="alert" className="text-muted-foreground text-sm">
        {t("notifications:inbox.documentUnavailable")}
      </p>
    );
  }

  const { roots, replies } = groupDocumentThreads(comments);
  const open = roots.filter((root) => !root.resolvedAt);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="min-w-0 flex-1 font-semibold text-2xl text-foreground tracking-tight">
          {document.title || t("navigation:documents.untitled")}
        </h2>
        <Button
          variant="outline"
          size="xs"
          render={
            <Link
              to="/dashboard/workspace/$workspaceId/document/$documentId"
              params={params}
            />
          }
        >
          {t("notifications:inbox.openDocument")}
          <ArrowUpRight />
        </Button>
      </div>

      {document.content && (
        <CommentEditor
          value={document.content}
          readOnly
          className="kaneo-comment-viewer [&_.kaneo-comment-editor-content_.ProseMirror]:max-h-80 [&_.kaneo-comment-editor-content_.ProseMirror]:overflow-y-auto [&_.kaneo-comment-editor-content_.ProseMirror]:px-0 [&_.kaneo-comment-editor-content_.ProseMirror]:text-[13px]"
        />
      )}

      <InboxDocumentQuestions document={document} />

      <div className="flex flex-col gap-3 border-border/60 border-t pt-5">
        <h3 className="font-medium text-muted-foreground text-xs">
          {t("navigation:documents.comments.title")}
        </h3>
        {open.map((root) => (
          <DocumentCommentThread
            key={root.id}
            document={document}
            root={root}
            replies={replies.get(root.id) ?? []}
          />
        ))}
        {document.role !== "view" && (
          <DocumentCommentComposer
            placeholder={t("navigation:documents.comments.placeholder")}
            onSubmit={(content) => create.mutateAsync({ content })}
            className="rounded-lg border border-border/70 bg-card px-3 py-1.5"
          />
        )}
      </div>
    </div>
  );
}
