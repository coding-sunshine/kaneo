import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateView } from "@/hooks/mutations/view/use-view-mutations";
import { readBoardFilters } from "@/lib/saved-view";
import { toast } from "@/lib/toast";
import { useUserPreferencesStore } from "@/store/user-preferences";

type SaveViewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projectId: string;
};

/** Saves the team's current filters and layout as a named view. */
export function SaveViewDialog({
  open,
  onOpenChange,
  workspaceId,
  projectId,
}: SaveViewDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"team" | "workspace">("team");
  const layout = useUserPreferencesStore((s) => s.viewMode);
  const groupBy = useUserPreferencesStore((s) => s.listGroupBy);
  const create = useCreateView(workspaceId);

  const save = () => {
    if (!name.trim()) return;
    create.mutate(
      {
        workspaceId,
        projectId: scope === "team" ? projectId : null,
        name: name.trim(),
        filters: readBoardFilters(projectId),
        display: { layout, groupBy, sourceProjectId: projectId },
      },
      {
        onSuccess: (view) => {
          toast.success(t("navigation:views.saved"));
          setName("");
          onOpenChange(false);
          navigate({
            to: "/dashboard/workspace/$workspaceId/views/$viewId",
            params: { workspaceId, viewId: view.id },
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("navigation:views.saveTitle")}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          <Input
            autoFocus
            value={name}
            placeholder={t("navigation:views.namePlaceholder")}
            aria-label={t("navigation:views.name")}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && save()}
          />
          <div
            role="radiogroup"
            aria-label={t("navigation:views.scope")}
            className="flex gap-2"
          >
            {(["team", "workspace"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                role="radio"
                aria-checked={scope === value}
                variant={scope === value ? "secondary" : "outline"}
                size="sm"
                onClick={() => setScope(value)}
              >
                {t(
                  value === "team"
                    ? "navigation:views.scopeTeam"
                    : "navigation:views.scopeWorkspace",
                )}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("navigation:views.snapshotNote")}
          </p>
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!name.trim() || create.isPending}
            onClick={save}
          >
            {t("navigation:views.save")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
