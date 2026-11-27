import { createFileRoute } from "@tanstack/react-router";
import { InitiativeDetail } from "@/components/initiative/initiative-detail";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/initiatives/$initiativeId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId, initiativeId } = Route.useParams();
  return (
    <InitiativeDetail workspaceId={workspaceId} initiativeId={initiativeId} />
  );
}
