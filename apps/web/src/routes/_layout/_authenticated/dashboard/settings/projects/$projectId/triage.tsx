import { createFileRoute } from "@tanstack/react-router";
import { ProjectTriageSettings } from "@/components/settings/project-triage/project-triage-settings";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/triage",
)({
  component: function TriageSettings() {
    const { projectId } = Route.useParams();
    return <ProjectTriageSettings key={projectId} projectId={projectId} />;
  },
});
