import { createFileRoute } from "@tanstack/react-router";
import { LabelsSettings } from "@/components/settings/labels/labels-settings";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/labels",
)({
  component: function TeamLabelsSettings() {
    const { projectId } = Route.useParams();
    return <LabelsSettings key={projectId} projectId={projectId} />;
  },
});
