import { createFileRoute } from "@tanstack/react-router";
import { TopicPage } from "@/components/documents/topic-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/topic/$topicId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId, topicId } = Route.useParams();
  return <TopicPage workspaceId={workspaceId} topicId={topicId} />;
}
