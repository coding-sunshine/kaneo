import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments } from "@/hooks/queries/document/use-documents";
import type { DocumentScope } from "@/fetchers/document/documents";
import { useIssueFiles } from "@/hooks/queries/document/use-issue-files";
import { ChoosePinnedDialog } from "./choose-pinned-dialog";
import type { DocumentTabKey } from "./document-tab";
import { DocumentTable } from "./document-table";
import { DocumentUsageButton } from "./document-usage-button";
import { DocumentsEmpty } from "./documents-empty";
import { DocumentsFilterMenu } from "./documents-filter-menu";
import { DocumentsPageMenu } from "./documents-page-menu";
import { DocumentsTabs } from "./documents-tabs";
import { IssueFileList } from "./issue-file-list";
import { NeedsReviewList } from "./needs-review-list";
import { IssueFilesEmpty } from "./issue-files-empty";
import { InboxList } from "./inbox-list";
import { NewDocuments } from "./new-documents";
import { PinnedDocuments } from "./pinned-documents";
import { TopicsStrip } from "./topics-strip";
import { useNewDocument } from "./use-new-document";

type DocumentsPageProps = { workspaceId: string; filter: DocumentTabKey };

/** Linear's workspace Documents page. */
export function DocumentsPage({ workspaceId, filter }: DocumentsPageProps) {
  const { t } = useTranslation();
  // Two tabs are not documents filters: the documents API rejects them.
  const onFiles = filter === "issueFiles";
  const onReview = filter === "needsReview";
  const docs = useDocuments(
    workspaceId,
    onFiles || onReview ? {} : { filter },
    !onFiles && !onReview,
  );
  const files = useIssueFiles(workspaceId, undefined, onFiles);
  const documents = docs.data;
  const isLoading = onFiles ? files.isLoading : docs.isLoading;
  const { create, isPending } = useNewDocument(workspaceId);
  const [scopes, setScopes] = useState<DocumentScope[]>([]);
  const [choosing, setChoosing] = useState(false);
  // The tabs Linear has a table for; the others keep their own lists.
  const onTable = !onFiles && !onReview && filter !== "inbox";
  const shown = documents?.filter(
    (document) => !scopes.length || scopes.includes(document.scope),
  );

  return (
    <>
      <PageTitle title={t("navigation:documents.pageTitle")} />
      <WorkspaceLayout
        title={t("navigation:documents.title")}
        crumbs={
          <div className="flex min-w-0 items-center gap-1">
            <h1 className="truncate px-1 font-medium text-[13px]">
              {t("navigation:documents.title")}
            </h1>
            <DocumentsPageMenu onChoosePins={() => setChoosing(true)} />
          </div>
        }
        headerActions={
          <>
            <DocumentUsageButton workspaceId={workspaceId} />
            <Button
              variant="ghost"
              size="xs"
              onClick={() => create()}
              disabled={isPending}
              className="text-muted-foreground hover:text-foreground"
            >
              <Plus aria-hidden />
              {t("navigation:documents.newDocument")}
            </Button>
          </>
        }
      >
        <div className="flex h-11 shrink-0 items-center gap-2 overflow-x-auto border-border/50 border-b px-4">
          <DocumentsTabs workspaceId={workspaceId} value={filter} />
          {onTable && (
            <div className="ms-auto shrink-0">
              <DocumentsFilterMenu value={scopes} onChange={setScopes} />
            </div>
          )}
        </div>
        <TopicsStrip workspaceId={workspaceId} />
        <NewDocuments workspaceId={workspaceId} />
        {filter === "recent" && !isLoading && (
          <PinnedDocuments
            workspaceId={workspaceId}
            documents={documents ?? []}
            onChoose={() => setChoosing(true)}
          />
        )}
        {filter === "needsReview" ? (
          <NeedsReviewList workspaceId={workspaceId} />
        ) : isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : filter === "issueFiles" ? (
          files.data?.length ? (
            <IssueFileList workspaceId={workspaceId} files={files.data} />
          ) : (
            <IssueFilesEmpty />
          )
        ) : !documents?.length ? (
          <DocumentsEmpty
            workspaceId={workspaceId}
            filter={filter}
            onCreate={() => create()}
            creating={isPending}
          />
        ) : filter === "inbox" ? (
          <InboxList workspaceId={workspaceId} documents={documents} />
        ) : shown?.length ? (
          <DocumentTable
            // Ticked rows belong to the tab they were ticked on.
            key={filter}
            workspaceId={workspaceId}
            documents={shown}
          />
        ) : (
          <p className="px-4 py-10 text-center text-muted-foreground text-xs">
            {t("navigation:documents.filter.noMatch")}
          </p>
        )}
        {choosing && (
          <ChoosePinnedDialog
            workspaceId={workspaceId}
            documents={documents ?? []}
            onClose={() => setChoosing(false)}
          />
        )}
      </WorkspaceLayout>
    </>
  );
}
