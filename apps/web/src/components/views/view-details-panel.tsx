import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useDeleteView } from "@/hooks/mutations/view/use-view-mutations";
import { toast } from "@/lib/toast";

type ViewDetailsPanelProps = {
  workspaceId: string;
  teamName?: string;
  view: { id: string; ownerName: string | null; projectId: string | null };
};

/** Linear's right-hand details panel: visibility and owner. */
export function ViewDetailsPanel({
  workspaceId,
  teamName,
  view,
}: ViewDetailsPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const remove = useDeleteView(workspaceId);
  const row = "flex items-center justify-between gap-2 text-[13px]";

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-4 border-border/80 border-l p-4 md:flex">
      <div className={row}>
        <span className="text-muted-foreground">
          {t("navigation:views.visibility")}
        </span>
        <span>
          {view.projectId
            ? (teamName ?? t("navigation:views.scopeTeam"))
            : t("navigation:views.everyone")}
        </span>
      </div>
      <div className={row}>
        <span className="text-muted-foreground">
          {t("navigation:views.ownerLabel")}
        </span>
        <span className="truncate">{view.ownerName}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start text-destructive"
        onClick={() =>
          remove.mutate(view.id, {
            onSuccess: () => {
              toast.success(t("navigation:views.deleted"));
              navigate({
                to: "/dashboard/workspace/$workspaceId",
                params: { workspaceId },
              });
            },
          })
        }
      >
        <Trash2 />
        {t("navigation:views.delete")}
      </Button>
    </aside>
  );
}
