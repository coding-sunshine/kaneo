import { createFileRoute } from "@tanstack/react-router";
import { ProjectSlaSettings } from "@/components/settings/project-sla/project-sla-settings";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/sla",
)({
  component: function SlaSettings() {
    const { projectId } = Route.useParams();
    return <ProjectSlaSettings key={projectId} projectId={projectId} />;
  },
});
