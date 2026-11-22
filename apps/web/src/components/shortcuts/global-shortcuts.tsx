import { useNavigate } from "@tanstack/react-router";
import { toastManager } from "@/components/ui/toast";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";

export function GlobalShortcuts() {
  const navigate = useNavigate();
  const { data: workspace } = useActiveWorkspace();
  const { data: projects = [] } = useGetProjects(
    { workspaceId: workspace?.id ?? "" },
    true,
  );
  const base = workspace ? `/dashboard/workspace/${workspace.id}` : null;
  const enabled = Boolean(base);
  const hasAgent = useHasAgent();
  const go = (path: string) => {
    if (base) navigate({ to: `${base}${path}` });
  };

  useShortcut("goToHome", () => go(""), { enabled });
  useShortcut("goToInbox", () => go("/inbox"), { enabled });
  useShortcut("goToMyTasks", () => go("/my-tasks"), { enabled });
  useShortcut(
    "openAgent",
    () => {
      if (base) navigate({ to: `${base}/agent` });
    },
    { enabled: enabled && hasAgent },
  );
  useShortcut("goToProjects", () => go("/work-projects"), { enabled });
  useShortcut("goToSettings", () =>
    navigate({ to: "/dashboard/settings/account/information" }),
  );
  useShortcut(
    "goToProject",
    (event) => {
      // Numbered like the sidebar's "Your teams", which skips teams you left.
      const project = projects.filter((team) => team.membership.joined)[
        Number(event.code.replace("Digit", "")) - 1
      ];
      if (project) go(`/project/${project.id}/board`);
    },
    { enabled: enabled && projects.length > 0 },
  );
  useShortcut("dismissToasts", () => toastManager.close());

  return null;
}
