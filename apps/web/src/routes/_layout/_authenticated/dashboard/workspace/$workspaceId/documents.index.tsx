import { createFileRoute } from "@tanstack/react-router";
import { DocumentsPage } from "@/components/documents/documents-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/documents/",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  return <DocumentsPage workspaceId={workspaceId} filter="recent" />;
}
