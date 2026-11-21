import { createFileRoute } from "@tanstack/react-router";
import { DocumentPage } from "@/components/documents/document-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/document/$documentId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId, documentId } = Route.useParams();
  // Keyed so panels and a previewed version never carry over to another document.
  return (
    <DocumentPage
      key={documentId}
      workspaceId={workspaceId}
      documentId={documentId}
    />
  );
}
