import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentVersion } from "@/fetchers/document/documents";
import { useRestoreDocumentVersion } from "@/hooks/mutations/document/use-document-mutations";
import { useDocument } from "@/hooks/queries/document/use-documents";
import { useTopic } from "@/hooks/queries/topic/use-topics";
import { descriptionSaveQueue } from "@/lib/description-save-queue";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { DocumentComments } from "./document-comments";
import { DocumentCrumbs } from "./document-crumbs";
import { DocumentEditor } from "./document-editor";
import { DocumentHeaderActions } from "./document-header-actions";
import { DocumentHistory } from "./document-history";
import { DocumentOutline } from "./document-outline";
import { DocumentRevisionHint } from "./document-revision-hint";
import { DocumentCitedBy } from "./document-cited-by";
import { DocumentFacts } from "./document-facts";
import { DocumentFactsHint } from "./document-facts-hint";
import { DocumentReplaceIntent } from "./document-replace-intent";
import { DocumentStatusBanner } from "./document-status-banner";
import { DocumentTopicActions } from "./document-topic-actions";
import { DOCUMENT_SAVE_OWNER } from "./document-save";
import { DocumentVersionPreview } from "./document-version-preview";

type Panel = "comments" | "facts" | "history" | null;

/** A Linear document: header crumbs and actions, the editor, side panels. */
export function DocumentPage({
  workspaceId,
  documentId,
}: {
  workspaceId: string;
  documentId: string;
}) {
  const { t } = useTranslation();
  const { data: document, isLoading } = useDocument(workspaceId, documentId);
  // Null for a reader who holds only a share: the topic is not theirs to open.
  const { data: topic } = useTopic(workspaceId, document?.topicId ?? null);
  // A proposal filed to replace a document names it; that one may be gone.
  const replaces =
    document?.status === "in_review" ? document.supersedesDocumentId : null;
  const { data: replaced } = useDocument(workspaceId, replaces ?? "");
  const restore = useRestoreDocumentVersion(workspaceId, documentId);
  const [panel, setPanel] = useState<Panel>(null);
  const [version, setVersion] = useState<DocumentVersion | null>(null);
  // Bumped after a restore so the editor reloads the restored content.
  const [loadCount, setLoadCount] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggle = (next: Exclude<Panel, null>) => {
    setPanel((current) => (current === next ? null : next));
    if (next === "history") setVersion(null);
  };

  if (!document) {
    return (
      <WorkspaceLayout title={t("navigation:documents.title")}>
        {isLoading ? (
          <div className="mx-auto flex w-full max-w-[55rem] flex-col gap-3 px-10 pt-20">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-6 h-40 w-full" />
          </div>
        ) : (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
            <h1 className="font-medium text-sm">
              {t("navigation:documents.notFound")}
            </h1>
            <p className="max-w-72 text-muted-foreground text-xs">
              {t("navigation:documents.notFoundHint")}
            </p>
            <Link
              to="/dashboard/workspace/$workspaceId/documents"
              params={{ workspaceId }}
              className="mt-2 text-xs underline underline-offset-2"
            >
              {t("navigation:documents.title")}
            </Link>
          </div>
        )}
      </WorkspaceLayout>
    );
  }

  // A replaced document stays as it was when it was replaced.
  const canEdit =
    (document.role === "owner" || document.role === "edit") &&
    document.status !== "superseded";

  const onRestore = async () => {
    if (!version) return;
    // Pending typing would otherwise land on top of the restored version.
    if (!(await descriptionSaveQueue.drain(DOCUMENT_SAVE_OWNER))) {
      toast.error(t("navigation:documents.saveFailed"));
      return;
    }
    restore.mutate(version.id, {
      onSuccess: () => {
        setVersion(null);
        setLoadCount((count) => count + 1);
        toast.success(t("navigation:documents.history.restored"));
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <>
      <PageTitle title={document.title || t("navigation:documents.untitled")} />
      <WorkspaceLayout
        title={document.title}
        crumbs={
          <DocumentCrumbs
            document={document}
            historyOpen={panel === "history"}
            onRename={() => titleRef.current?.focus()}
            onShare={() => setShareOpen(true)}
            onToggleHistory={() => toggle("history")}
          />
        }
        headerActions={
          <DocumentHeaderActions
            document={document}
            commentsOpen={panel === "comments"}
            onToggleComments={() => toggle("comments")}
            factsOpen={panel === "facts"}
            onToggleFacts={() => toggle("facts")}
            shareOpen={shareOpen}
            onShareOpenChange={setShareOpen}
          />
        }
      >
        <div className="flex h-full min-h-0">
          {/* On a phone a side panel takes the whole width, and a picked version takes it back. */}
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col",
              panel && !version && "max-md:hidden",
            )}
          >
            <DocumentStatusBanner
              document={document}
              currentDocumentId={topic?.currentDocumentId}
              replaceIntent={
                replaces && (
                  <DocumentReplaceIntent
                    workspaceId={workspaceId}
                    targetId={replaces}
                    title={replaced?.title ?? null}
                    stale={
                      Boolean(topic) && replaces !== topic?.currentDocumentId
                    }
                  />
                )
              }
              actions={
                <DocumentTopicActions
                  document={document}
                  topic={topic}
                  canEdit={canEdit}
                />
              }
            />
            <DocumentRevisionHint document={document} canEdit={canEdit} />
            {panel !== "facts" && (
              <DocumentFactsHint
                document={document}
                canConfirm={
                  canEdit &&
                  (document.status !== "current" || Boolean(topic?.canDecide))
                }
                onOpen={() => setPanel("facts")}
              />
            )}
            <DocumentCitedBy document={document} />
            <div className="relative min-h-0 flex-1">
              <div ref={scrollRef} className="h-full overflow-y-auto">
                {version ? (
                  <DocumentVersionPreview
                    version={version}
                    canRestore={canEdit}
                    restoring={restore.isPending}
                    onRestore={onRestore}
                    onBack={() => setVersion(null)}
                  />
                ) : (
                  <DocumentEditor
                    key={`${document.id}:${loadCount}`}
                    document={document}
                    readOnly={!canEdit}
                    titleRef={titleRef}
                  />
                )}
              </div>
              {/* Re-keyed with the editor so it reads the headings of what shows. */}
              {!version && (
                <DocumentOutline
                  key={`${document.id}:${loadCount}`}
                  scrollRef={scrollRef}
                />
              )}
            </div>
          </div>
          {panel === "comments" && (
            <DocumentComments
              document={document}
              onClose={() => setPanel(null)}
            />
          )}
          {panel === "facts" && (
            <DocumentFacts
              document={document}
              topic={topic}
              canEdit={canEdit}
              onClose={() => setPanel(null)}
            />
          )}
          {panel === "history" && (
            <div className={cn("contents", version && "max-md:hidden")}>
              <DocumentHistory
                workspaceId={workspaceId}
                documentId={document.id}
                selectedId={version?.id ?? null}
                onSelect={setVersion}
                onClose={() => {
                  setPanel(null);
                  setVersion(null);
                }}
              />
            </div>
          )}
        </div>
      </WorkspaceLayout>
    </>
  );
}
