import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ItIntakeCard } from "@/components/settings/project-triage/it-intake-card";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRow } from "@/components/settings/settings-row";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import updateTriageResponsibility, {
  type TriageResponsibility,
} from "@/fetchers/team-automation/update-triage-responsibility";
import { useTriageResponsibility } from "@/hooks/queries/team-automation/use-triage-responsibility";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";

export function ProjectTriageSettings({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: workspace } = useActiveWorkspace();
  const { data: members = [] } = useGetWorkspaceUsers({
    workspaceId: workspace?.id,
  });
  const { data } = useTriageResponsibility(projectId);

  const save = useMutation({
    mutationFn: (body: TriageResponsibility) =>
      updateTriageResponsibility(projectId, body),
    onSuccess: (next) =>
      queryClient.setQueryData(["triage-responsibility", projectId], next),
    onError: () => toast.error(t("settings:projectTriage.saveFailed")),
  });

  const mode = data?.mode ?? "notify";
  const userIds = data?.userIds ?? [];
  const toggle = (userId: string, on: boolean) =>
    save.mutate({
      mode,
      userIds: on
        ? [...userIds, userId]
        : userIds.filter((id) => id !== userId),
    });

  return (
    <SettingsPage
      title={t("settings:projectTriage.title")}
      description={t("settings:projectTriage.subtitle")}
    >
      <SettingsCard>
        <SettingsRow
          title={t("settings:projectTriage.mode")}
          description={t("settings:projectTriage.modeDescription")}
        >
          <Select
            value={mode}
            onValueChange={(next) =>
              save.mutate({
                mode: next as TriageResponsibility["mode"],
                userIds,
              })
            }
          >
            <SelectTrigger
              aria-label={t("settings:projectTriage.mode")}
              className="w-44"
              size="sm"
            >
              <SelectValue>{t(`settings:projectTriage.${mode}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(["notify", "assign"] as const).map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`settings:projectTriage.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsCard>
      <SettingsCard>
        {members.map((member) => {
          const name = member.user.name || member.user.email;
          return (
            <SettingsRow key={member.userId} title={name}>
              <Checkbox
                aria-label={name}
                checked={userIds.includes(member.userId)}
                onCheckedChange={(checked) => toggle(member.userId, checked)}
              />
            </SettingsRow>
          );
        })}
      </SettingsCard>
      <ItIntakeCard projectId={projectId} />
    </SettingsPage>
  );
}
