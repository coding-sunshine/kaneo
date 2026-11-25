import { Link } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DocumentAccessLabel } from "@/components/documents/document-access-label";
import { useNewDocument } from "@/components/documents/use-new-document";
import { useDocuments } from "@/hooks/queries/document/use-documents";

type Props = { workspaceId: string; workProjectId: string; editable: boolean };

/** Linear's overview Resources row: the project's documents as chips, then "+". */
export function WorkProjectResources({
  workspaceId,
  workProjectId,
  editable,
}: Props) {
  const { t } = useTranslation();
  const { data: documents = [] } = useDocuments(workspaceId, { workProjectId });
  const newDocument = useNewDocument(workspaceId);
  const add = () => newDocument.create({ workProjectId });
  if (!editable && documents.length === 0) return null;

  return (
    <section className="flex min-h-7 flex-wrap items-center gap-x-1 gap-y-1 text-[13px]">
      <h2 className="mr-5 text-muted-foreground">
        {t("workspace:workProject.detail.resources")}
      </h2>
      {documents.map((document) => (
        <Link
          key={document.id}
          to="/dashboard/workspace/$workspaceId/document/$documentId"
          params={{ workspaceId, documentId: document.id }}
          className="flex h-6 max-w-74 items-center gap-1.5 rounded-full px-1.5 outline-none hover:bg-accent focus-visible:bg-accent"
        >
          <FileText
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <span className="truncate">
            {document.title || t("navigation:documents.untitled")}
          </span>
          <DocumentAccessLabel
            scope={document.scope}
            className="shrink-0 text-xs"
          />
        </Link>
      ))}
      {editable && (
        <button
          type="button"
          disabled={newDocument.isPending}
          onClick={add}
          aria-label={t("workspace:workProject.detail.addDocument")}
          title={t("workspace:workProject.detail.addDocument")}
          className="flex h-6 items-center gap-1.5 rounded-md px-1.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent disabled:opacity-50"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          {documents.length === 0 &&
            t("workspace:workProject.detail.addDocument")}
        </button>
      )}
    </section>
  );
}
