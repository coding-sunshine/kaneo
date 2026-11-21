import { createFileRoute } from "@tanstack/react-router";
import { WorkProjectDetail } from "@/components/work-project/work-project-detail";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/work-projects/$workProjectId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId, workProjectId } = Route.useParams();
  return (
    <WorkProjectDetail
      workspaceId={workspaceId}
      workProjectId={workProjectId}
    />
  );
}
