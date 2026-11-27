import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { WorkProjectHealth } from "@/components/work-project/work-project-health";
import type { InitiativeUpdate } from "@/fetchers/initiative/types";
import { useDeleteInitiativeUpdate } from "@/hooks/mutations/initiative/use-initiative-mutations";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

type Props = {
  update: InitiativeUpdate;
  workspaceId: string;
  // Pulse shows which initiative each update belongs to and has no controls.
  showInitiative?: boolean;
};

export function InitiativeUpdateItem({
  update,
  workspaceId,
  showInitiative,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin } = useWorkspacePermission();
  const { mutateAsync: remove } = useDeleteInitiativeUpdate();
  const canDelete =
    !showInitiative &&
    (isAdmin || (Boolean(user?.id) && user?.id === update.userId));

  return (
    <li className="space-y-1 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {showInitiative && (
          <Link
            to="/dashboard/workspace/$workspaceId/initiatives/$initiativeId"
            params={{ workspaceId, initiativeId: update.initiativeId }}
            className="font-medium text-foreground hover:underline"
          >
            {update.initiativeName}
          </Link>
        )}
        <WorkProjectHealth health={update.health} />
        <span>{update.userName}</span>
        <time dateTime={update.createdAt}>
          {new Date(update.createdAt).toLocaleDateString()}
        </time>
        {canDelete && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="ml-auto"
            aria-label={t("workspace:initiative.updates.delete")}
            onClick={async () => {
              if (
                !window.confirm(t("workspace:initiative.updates.deleteConfirm"))
              )
                return;
              try {
                await remove(update.id);
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : t("workspace:initiative.updates.postError"),
                );
              }
            }}
          >
            <Trash2 />
          </Button>
        )}
      </div>
      {update.body && (
        <p className="whitespace-pre-wrap text-sm">{update.body}</p>
      )}
    </li>
  );
}
