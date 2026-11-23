import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ReviewsPage } from "@/components/reviews/reviews-page";

// The list stays mounted while a pull request opens beside it, as in Linear.
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/reviews",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  return (
    <ReviewsPage
      returnTo={`/dashboard/workspace/${workspaceId}/reviews`}
      workspaceId={workspaceId}
    >
      <Outlet />
    </ReviewsPage>
  );
}
