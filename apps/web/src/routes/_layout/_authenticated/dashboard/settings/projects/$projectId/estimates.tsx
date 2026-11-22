import { createFileRoute } from "@tanstack/react-router";
import { ProjectEstimatesSettings } from "@/components/settings/project-general/project-estimates-settings";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/estimates",
)({
  component: function EstimatesSettings() {
    const { projectId } = Route.useParams();
    return <ProjectEstimatesSettings key={projectId} projectId={projectId} />;
  },
});
