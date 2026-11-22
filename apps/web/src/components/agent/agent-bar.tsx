import { Link } from "@tanstack/react-router";
import { History, MousePointer2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AgentHistory } from "@/components/agent/agent-history";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

/**
 * Linear's full-width strip under the app: the Agent button and chat-history
 * icon sit at the right. Layout reserves its height (h-9, 2.25rem).
 */
export function AgentBar() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const hasAgent = useHasAgent();

  if (!hasAgent || !workspace) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex h-9 items-center justify-end gap-1 bg-sidebar px-3 text-muted-foreground text-xs">
      <Link
        to="/dashboard/workspace/$workspaceId/agent"
        params={{ workspaceId: workspace.id }}
        search={{ chat: undefined }}
        className="flex h-6 items-center gap-1.5 rounded-md px-2 hover:bg-accent hover:text-foreground"
      >
        <MousePointer2 className="size-3.5" aria-hidden="true" />
        {t("navigation:sidebar.agent")}
      </Link>
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={t("navigation:agent.history")}
              className="flex size-6 items-center justify-center rounded-md hover:bg-accent hover:text-foreground"
            />
          }
        >
          <History className="size-3.5" />
        </PopoverTrigger>
        <PopoverPopup side="top" align="end" className="w-72 p-0">
          <AgentHistory workspaceId={workspace.id} />
        </PopoverPopup>
      </Popover>
    </div>
  );
}
