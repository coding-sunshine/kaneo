import { createFileRoute } from "@tanstack/react-router";
import { documentTabFromSlug } from "@/components/documents/document-tab";
import { DocumentsPage } from "@/components/documents/documents-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/documents/$tab",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId, tab } = Route.useParams();
  return (
    <DocumentsPage
      workspaceId={workspaceId}
      filter={documentTabFromSlug(tab)}
    />
  );
}
