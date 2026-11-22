import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { NumberSelect } from "@/components/settings/number-select";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRow } from "@/components/settings/settings-row";
import { Switch } from "@/components/ui/switch";
import updateSlaSettings, {
  type SlaSettings,
} from "@/fetchers/team-automation/update-sla-settings";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

// Linear's preset SLA durations, in hours.
const HOURS = [12, 24, 48, 168, 336, 672];

export function ProjectSlaSettings({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: workspace } = useActiveWorkspace();
  const { data: project } = useGetProject({
    id: projectId,
    workspaceId: workspace?.id ?? "",
  });

  const save = useMutation({
    mutationFn: (settings: SlaSettings) =>
      updateSlaSettings(projectId, settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
    onError: () => toast.error(t("settings:projectSla.saveFailed")),
  });

  const duration = (hours: number) =>
    hours % 168 === 0
      ? t("settings:projectSla.weeks", { count: hours / 168 })
      : t("settings:projectSla.hours", { count: hours });
  const options = (current: number) =>
    HOURS.includes(current) ? HOURS : [...HOURS, current].sort((a, b) => a - b);
  const urgent = project?.slaUrgentHours ?? 24;
  const high = project?.slaHighHours ?? 168;

  return (
    <SettingsPage
      title={t("settings:projectSla.title")}
      description={t("settings:projectSla.subtitle")}
    >
      <SettingsCard>
        <SettingsRow
          title={t("settings:projectSla.enable")}
          description={t("settings:projectSla.enableDescription")}
        >
          <Switch
            aria-label={t("settings:projectSla.enable")}
            checked={project?.slaEnabled ?? false}
            onCheckedChange={(checked) => save.mutate({ slaEnabled: checked })}
          />
        </SettingsRow>
        {project?.slaEnabled && (
          <>
            <SettingsRow title={t("settings:projectSla.urgent")}>
              <NumberSelect
                label={t("settings:projectSla.urgent")}
                value={urgent}
                options={options(urgent)}
                format={duration}
                onChange={(n) => save.mutate({ slaUrgentHours: n })}
              />
            </SettingsRow>
            <SettingsRow
              title={t("settings:projectSla.high")}
              description={t("settings:projectSla.otherDescription")}
            >
              <NumberSelect
                label={t("settings:projectSla.high")}
                value={high}
                options={options(high)}
                format={duration}
                onChange={(n) => save.mutate({ slaHighHours: n })}
              />
            </SettingsRow>
          </>
        )}
      </SettingsCard>
    </SettingsPage>
  );
}
