import { createFileRoute, redirect } from "@tanstack/react-router";

// Linear's Projects page is the work-project list; teams live in Settings > Teams.
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/projects",
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/dashboard/workspace/$workspaceId/work-projects",
      params,
      replace: true,
    });
  },
});
