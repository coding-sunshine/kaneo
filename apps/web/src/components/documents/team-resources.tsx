import { useTranslation } from "react-i18next";
import { SectionAddButton } from "@/components/task/sections/section-add-button";
import { useDocuments } from "@/hooks/queries/document/use-documents";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { DocumentResourceRow } from "./document-resource-row";
import { useNewDocument } from "./use-new-document";

type Props = { workspaceId: string; projectId: string };

/** Team home's "Team resources": the team's documents, newest first. */
export function TeamResources({ workspaceId, projectId }: Props) {
  const { t } = useTranslation();
  const { canUpdateTasks } = useWorkspacePermission();
  const { data: documents = [], isLoading } = useDocuments(workspaceId, {
    projectId,
  });
  const newDocument = useNewDocument(workspaceId);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("navigation:teamHome.resources")}
        </h2>
        {canUpdateTasks() && (
          <SectionAddButton
            aria-label={t("navigation:documents.newDocument")}
            title={t("navigation:documents.newDocument")}
            disabled={newDocument.isPending}
            onClick={() => newDocument.create({ projectId })}
          />
        )}
      </div>
      {isLoading ? null : documents.length > 0 ? (
        <div className="flex flex-col">
          {documents.map((document) => (
            <DocumentResourceRow
              key={document.id}
              workspaceId={workspaceId}
              document={document}
            />
          ))}
        </div>
      ) : (
        <p className="px-2 text-muted-foreground text-xs">
          {t("navigation:teamHome.resourcesEmpty")}
        </p>
      )}
    </section>
  );
}
