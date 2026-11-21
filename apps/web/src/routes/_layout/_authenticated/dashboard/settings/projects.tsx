import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { TeamsSettingsPage } from "@/components/settings/teams-settings-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const location = useLocation();
  const isProjectsRoot =
    location.pathname.replace(/\/+$/, "") === "/dashboard/settings/projects";

  return isProjectsRoot ? <TeamsSettingsPage /> : <Outlet />;
}
