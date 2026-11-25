import { Lock } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PrivateTeamConfirmDialog } from "@/components/settings/project-visibility/private-team-confirm-dialog";
import { useToggleProjectPrivate } from "@/components/settings/project-visibility/use-toggle-project-private";
import { SettingsRow } from "@/components/settings/settings-row";
import { StatusBadge } from "@/components/settings/status-badge";
import { Switch } from "@/components/ui/switch";
import type { Project } from "@/types/project";

type PrivateTeamRowProps = {
  project: Project | undefined;
  workspaceId: string | undefined;
  canManage: boolean;
};

export function PrivateTeamRow({
  project,
  workspaceId,
  canManage,
}: PrivateTeamRowProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const togglePrivate = useToggleProjectPrivate(project, workspaceId);
  const isPrivate = Boolean(project?.isPrivate);
  const blockedByPublic = Boolean(project?.isPublic);

  return (
    <>
      <SettingsRow
        icon={<Lock />}
        title={t("settings:projectVisibility.privateTeam")}
        badge={
          isPrivate ? (
            <StatusBadge tone="success">
              {t("settings:projectVisibility.on")}
            </StatusBadge>
          ) : null
        }
        description={
          blockedByPublic
            ? t("settings:projectVisibility.privateBlockedByPublic")
            : t("settings:projectVisibility.privateTeamHint")
        }
      >
        <Switch
          aria-label={t("settings:projectVisibility.privateTeam")}
          checked={isPrivate}
          onCheckedChange={
            canManage && !blockedByPublic
              ? () => setConfirming(true)
              : undefined
          }
          disabled={!canManage || blockedByPublic}
        />
      </SettingsRow>
      <PrivateTeamConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        makePrivate={!isPrivate}
        projectName={project?.name ?? ""}
        onConfirm={() => void togglePrivate()}
      />
    </>
  );
}
