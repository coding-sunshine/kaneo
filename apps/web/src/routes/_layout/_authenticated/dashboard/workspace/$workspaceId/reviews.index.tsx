import { createFileRoute } from "@tanstack/react-router";
import { ReviewsPage } from "@/components/reviews/reviews-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/reviews/",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  return (
    <ReviewsPage returnTo={`/dashboard/workspace/${workspaceId}/reviews`} />
  );
}
