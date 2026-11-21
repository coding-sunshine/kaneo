import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentFilter } from "@/fetchers/document/documents";
import { useDocuments } from "@/hooks/queries/document/use-documents";
import { DocumentList } from "./document-list";
import { DocumentsEmpty } from "./documents-empty";
import { DocumentsTabs } from "./documents-tabs";
import { useNewDocument } from "./use-new-document";

type DocumentsPageProps = { workspaceId: string; filter: DocumentFilter };

/** Linear's workspace Documents page. */
export function DocumentsPage({ workspaceId, filter }: DocumentsPageProps) {
  const { t } = useTranslation();
  const { data: documents, isLoading } = useDocuments(workspaceId, { filter });
  const { create, isPending } = useNewDocument(workspaceId);

  return (
    <>
      <PageTitle title={t("navigation:documents.pageTitle")} />
      <WorkspaceLayout
        title={t("navigation:documents.title")}
        headerActions={
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
        }
      >
        <div className="flex h-11 shrink-0 items-center border-border/50 border-b px-4">
          <DocumentsTabs workspaceId={workspaceId} value={filter} />
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : documents?.length ? (
          <DocumentList workspaceId={workspaceId} documents={documents} />
        ) : (
          <DocumentsEmpty
            filter={filter}
            onCreate={() => create()}
            creating={isPending}
          />
        )}
      </WorkspaceLayout>
    </>
  );
}
