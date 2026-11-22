import { createFileRoute } from "@tanstack/react-router";
import { PullRequestPage } from "@/components/reviews/pull-request-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/reviews/$owner/$repo/$number",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId, owner, repo, number } = Route.useParams();
  return (
    <PullRequestPage
      pullRef={{ owner, repo, number }}
      workspaceId={workspaceId}
    />
  );
}
