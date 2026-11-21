import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRow } from "@/components/settings/settings-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import updateCycleSettings, {
  type CycleSettings,
} from "@/fetchers/cycle/update-cycle-settings";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const DAYS = [1, 2, 3, 4, 5, 6, 0];

function NumberSelect({
  value,
  options,
  label,
  onChange,
  format = String,
}: {
  value: number;
  options: number[];
  label: string;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <Select
      value={String(value)}
      onValueChange={(next) => onChange(Number(next))}
    >
      <SelectTrigger aria-label={label} className="w-36" size="sm">
        <SelectValue>{format(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={String(option)}>
            {format(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ProjectCyclesSettings({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: workspace } = useActiveWorkspace();
  const { data: project } = useGetProject({
    id: projectId,
    workspaceId: workspace?.id ?? "",
  });

  const save = useMutation({
    mutationFn: (settings: CycleSettings) =>
      updateCycleSettings(projectId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["cycles", projectId] });
    },
    onError: () => toast.error(t("settings:projectCycles.saveFailed")),
  });

  const enabled = project?.cyclesEnabled ?? false;
  const weekday = (day: number) =>
    new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(
      new Date(2024, 0, 7 + day),
    );
  const weeks = (n: number) => t("settings:projectCycles.weeks", { count: n });

  const toggle = (
    key: "cycleAutoAddStarted" | "cycleAutoAddCompleted" | "cycleAutoRollover",
    title: string,
    description: string,
  ) => (
    <SettingsRow title={title} description={description}>
      <Switch
        aria-label={title}
        checked={project?.[key] ?? false}
        onCheckedChange={(checked) => save.mutate({ [key]: checked })}
      />
    </SettingsRow>
  );

  return (
    <SettingsPage
      title={t("settings:projectCycles.title")}
      description={t("settings:projectCycles.subtitle")}
    >
      <SettingsCard>
        <SettingsRow
          title={t("settings:projectCycles.enable")}
          description={t("settings:projectCycles.enableDescription")}
        >
          <Switch
            aria-label={t("settings:projectCycles.enable")}
            checked={enabled}
            onCheckedChange={(checked) =>
              save.mutate({ cyclesEnabled: checked })
            }
          />
        </SettingsRow>
        {enabled && (
          <>
            <SettingsRow title={t("settings:projectCycles.duration")}>
              <NumberSelect
                label={t("settings:projectCycles.duration")}
                value={project?.cycleDurationWeeks ?? 2}
                options={range(1, 8)}
                format={weeks}
                onChange={(n) => save.mutate({ cycleDurationWeeks: n })}
              />
            </SettingsRow>
            <SettingsRow title={t("settings:projectCycles.cooldown")}>
              <NumberSelect
                label={t("settings:projectCycles.cooldown")}
                value={project?.cycleCooldownWeeks ?? 0}
                options={range(0, 8)}
                format={weeks}
                onChange={(n) => save.mutate({ cycleCooldownWeeks: n })}
              />
            </SettingsRow>
            <SettingsRow title={t("settings:projectCycles.startDay")}>
              <NumberSelect
                label={t("settings:projectCycles.startDay")}
                value={project?.cycleStartDay ?? 1}
                options={DAYS}
                format={weekday}
                onChange={(n) => save.mutate({ cycleStartDay: n })}
              />
            </SettingsRow>
            <SettingsRow
              title={t("settings:projectCycles.upcoming")}
              description={t("settings:projectCycles.upcomingDescription")}
            >
              <NumberSelect
                label={t("settings:projectCycles.upcoming")}
                value={project?.cycleUpcomingCount ?? 2}
                options={range(1, 12)}
                onChange={(n) => save.mutate({ cycleUpcomingCount: n })}
              />
            </SettingsRow>
            {toggle(
              "cycleAutoAddStarted",
              t("settings:projectCycles.autoAddStarted"),
              t("settings:projectCycles.autoAddStartedDescription"),
            )}
            {toggle(
              "cycleAutoAddCompleted",
              t("settings:projectCycles.autoAddCompleted"),
              t("settings:projectCycles.autoAddCompletedDescription"),
            )}
            {toggle(
              "cycleAutoRollover",
              t("settings:projectCycles.autoRollover"),
              t("settings:projectCycles.autoRolloverDescription"),
            )}
          </>
        )}
      </SettingsCard>
    </SettingsPage>
  );
}
