import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { useDecideDocumentLineage } from "@/hooks/mutations/document/use-document-mutations";
import { toast } from "@/lib/toast";

type DocumentRevisionHintProps = {
  document: Pick<DocumentDetail, "workspaceId" | "id" | "revisionOf">;
  canEdit: boolean;
};

/**
 * One line under the status: the older document this text looks like a
 * revision of. A hint only, so somebody who can edit says whether it is true.
 */
export function DocumentRevisionHint({
  document,
  canEdit,
}: DocumentRevisionHintProps) {
  const { t } = useTranslation();
  const { workspaceId, id, revisionOf } = document;
  const decide = useDecideDocumentLineage(workspaceId, id);
  if (!revisionOf || revisionOf.status === "dismissed") return null;

  const proposed = revisionOf.status === "proposed";
  const answer = (status: "confirmed" | "dismissed") => (
    <Button
      size="xs"
      variant={status === "confirmed" ? "outline" : "ghost"}
      disabled={decide.isPending}
      onClick={() =>
        decide.mutate(status, {
          onError: (error) => toast.error(error.message),
        })
      }
    >
      {t(
        `navigation:documents.lineage.${
          status === "confirmed" ? "confirm" : proposed ? "dismiss" : "undo"
        }`,
      )}
    </Button>
  );
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-border/60 border-b px-4 py-1.5 text-muted-foreground text-xs">
      <div
        role="note"
        className="flex min-w-0 flex-wrap items-center gap-x-1.5"
      >
        <span>{t(`navigation:documents.lineage.${revisionOf.status}`)}</span>
        <Link
          to="/dashboard/workspace/$workspaceId/document/$documentId"
          params={{ workspaceId, documentId: revisionOf.id }}
          className="truncate font-medium text-foreground underline underline-offset-2"
        >
          {revisionOf.title || t("navigation:documents.untitled")}
        </Link>
        {proposed && (
          <span>
            {t("navigation:documents.lineage.overlap", {
              percent: revisionOf.overlap,
            })}
          </span>
        )}
      </div>
      {canEdit && (
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {proposed && answer("confirmed")}
          {answer("dismissed")}
        </div>
      )}
    </div>
  );
}
