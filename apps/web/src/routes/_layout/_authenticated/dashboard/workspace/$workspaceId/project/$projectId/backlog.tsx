import { createFileRoute, redirect } from "@tanstack/react-router";

// Linear's Backlog is a filtered issues view, not a separate page.
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/backlog",
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params,
      search: { view: "backlog" },
      replace: true,
    });
  },
});
