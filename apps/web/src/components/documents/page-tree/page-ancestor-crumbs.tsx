import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

type PageAncestorCrumbsProps = {
  workspaceId: string;
  ancestors: { id: string; title: string }[];
};

/** The pages above a document in the page tree, each a link. */
export function PageAncestorCrumbs({
  workspaceId,
  ancestors,
}: PageAncestorCrumbsProps) {
  const { t } = useTranslation();
  return ancestors.map((page) => (
    <span key={page.id} className="flex min-w-0 items-center gap-0.5">
      <ChevronRight
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <Link
        to="/dashboard/workspace/$workspaceId/document/$documentId"
        params={{ workspaceId, documentId: page.id }}
        className="max-w-40 truncate rounded px-1 py-0.5 text-xs hover:bg-accent/60"
      >
        {page.title || t("navigation:documents.untitled")}
      </Link>
    </span>
  ));
}
