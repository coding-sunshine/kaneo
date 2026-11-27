import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import setUpItIntake from "@/fetchers/team-automation/set-up-it-intake";

/** Turns the team into an IT service desk: template, category, SLA and queue view. */
export function ItIntakeCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setUp = useMutation({
    mutationFn: () => setUpItIntake(projectId),
    onSuccess: async () => {
      // Columns and SLA settings live on the project and its task board.
      await Promise.all(
        [
          ["projects"],
          ["tasks", projectId],
          ["custom-fields", projectId],
          ["issue-templates", projectId],
          ["views"],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      toast.success(t("settings:projectTriage.itIntake.done"));
    },
    onError: () => toast.error(t("settings:projectTriage.itIntake.failed")),
  });

  return (
    <SettingsCard>
      <SettingsRow
        title={t("settings:projectTriage.itIntake.title")}
        description={t("settings:projectTriage.itIntake.description")}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={setUp.isPending}
          onClick={() => setUp.mutate()}
        >
          {t("settings:projectTriage.itIntake.action")}
        </Button>
      </SettingsRow>
    </SettingsCard>
  );
}
