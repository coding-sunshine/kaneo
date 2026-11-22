import { useTranslation } from "react-i18next";
import { useEstimateOptions } from "@/hooks/queries/project/use-estimate-options";
import { Toggle } from "@/components/ui/toggle";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function CardFieldToggles({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const preferences = useUserPreferencesStore();
  const estimating = useEstimateOptions(projectId).length > 0;

  const fields = [
    {
      id: "taskNumbers",
      label: t("settings:preferencesPage.taskNumbers"),
      pressed: preferences.showTaskNumbers,
      onPressedChange: preferences.setShowTaskNumbers,
    },
    {
      id: "assignees",
      label: t("settings:preferencesPage.assignees"),
      pressed: preferences.showAssignees,
      onPressedChange: preferences.setShowAssignees,
    },
    {
      id: "dueDates",
      label: t("settings:preferencesPage.dueDates"),
      pressed: preferences.showDueDates,
      onPressedChange: preferences.setShowDueDates,
    },
    {
      id: "status",
      label: t("settings:preferencesPage.status"),
      pressed: preferences.showStatus,
      onPressedChange: preferences.setShowStatus,
    },
    {
      id: "createdDates",
      label: t("settings:preferencesPage.createdDates"),
      pressed: preferences.showCreatedDates,
      onPressedChange: preferences.setShowCreatedDates,
    },
    {
      id: "labels",
      label: t("settings:preferencesPage.labels"),
      pressed: preferences.showLabels,
      onPressedChange: preferences.setShowLabels,
    },
    {
      id: "priority",
      label: t("settings:preferencesPage.priority"),
      pressed: preferences.showPriority,
      onPressedChange: preferences.setShowPriority,
    },
    ...(estimating
      ? [
          {
            id: "estimate",
            label: t("tasks:properties.estimate"),
            pressed: preferences.showEstimate,
            onPressedChange: preferences.setShowEstimate,
          },
        ]
      : []),
    {
      id: "checklist",
      label: t("tasks:display.checklistProgress"),
      pressed: preferences.showTaskItemCounts,
      onPressedChange: preferences.setShowTaskItemCounts,
    },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((field) => (
        <Toggle
          key={field.id}
          variant="outline"
          size="sm"
          pressed={field.pressed}
          onPressedChange={field.onPressedChange}
          className="px-2.5 text-xs text-muted-foreground data-pressed:text-foreground"
        >
          {field.label}
        </Toggle>
      ))}
    </div>
  );
}
