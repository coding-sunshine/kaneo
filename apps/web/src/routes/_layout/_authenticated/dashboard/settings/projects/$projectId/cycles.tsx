import { createFileRoute } from "@tanstack/react-router";
import { ProjectCyclesSettings } from "@/components/settings/project-cycles/project-cycles-settings";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/cycles",
)({
  component: function CyclesSettings() {
    const { projectId } = Route.useParams();
    return <ProjectCyclesSettings key={projectId} projectId={projectId} />;
  },
});
