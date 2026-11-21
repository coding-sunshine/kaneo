import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers, Layers2, Box } from "lucide-react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import { TeamResources } from "@/components/documents/team-resources";
import PageTitle from "@/components/page-title";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import icons from "@/constants/project-icons";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetProjectMembers from "@/hooks/queries/workspace-users/use-get-project-members";
import { teamColor } from "@/lib/team-color";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/home",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId, projectId } = Route.useParams();
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { data: members = [] } = useGetProjectMembers({
    workspaceId,
    projectId,
  });
  const Icon = icons[project?.icon as keyof typeof icons] || icons.Layout;
  const color = teamColor(projectId);
  const params = { workspaceId, projectId };
  const links = [
    {
      key: "issues",
      label: t("navigation:sidebar.issues"),
      icon: Layers,
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
    },
    {
      key: "projects",
      label: t("navigation:sidebar.teamProjects"),
      icon: Box,
      to: "/dashboard/workspace/$workspaceId/project/$projectId/projects",
    },
    {
      key: "views",
      label: t("navigation:sidebar.views"),
      icon: Layers2,
      to: "/dashboard/workspace/$workspaceId/project/$projectId/views",
    },
  ] as const;

  return (
    <>
      <PageTitle title={t("navigation:teamHome.pageTitle")} />
      <ProjectLayout
        projectId={projectId}
        workspaceId={workspaceId}
        showViewSwitcher={false}
        crumb={t("navigation:sidebar.teamHome")}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex size-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${color}26`, color }}
            >
              <Icon className="size-5" />
            </span>
            <h1 className="text-2xl font-semibold">{project?.name}</h1>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("navigation:teamHome.members")}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center gap-2 rounded-md border px-2 py-1 text-[13px]"
                >
                  <Avatar className="size-5">
                    <AvatarImage src={member.image ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {(member.name ?? "?").slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {member.name}
                </li>
              ))}
            </ul>
          </section>

          <TeamResources workspaceId={workspaceId} projectId={projectId} />

          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("navigation:teamHome.goTo")}
            </h2>
            <ul className="flex flex-col">
              {links.map(({ key, label, icon: LinkIcon, to }) => (
                <li key={key}>
                  <Link
                    to={to}
                    params={params}
                    className="flex h-9 items-center gap-2.5 rounded-md px-2 text-[13px] hover:bg-accent"
                  >
                    <LinkIcon className="size-4 text-muted-foreground" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </ProjectLayout>
    </>
  );
}
