import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { Button } from "@/components/ui/button";
import setEmailIntake from "@/fetchers/email-intake/set-email-intake";
import { useEmailIntake } from "@/hooks/queries/email-intake/use-email-intake";

/** The team's intake address: mail sent to it becomes a Triage ticket. */
export function EmailIntakeCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Only people who can change the team may see its address.
  const { data, isError } = useEmailIntake(projectId);
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setEmailIntake(projectId, enabled),
    onSuccess: async (next) => {
      queryClient.setQueryData(["email-intake", projectId], next);
      // Turning intake on can add the Triage status.
      await Promise.all(
        [["projects"], ["tasks", projectId]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    },
    onError: () => toast.error(t("settings:projectTriage.emailIntake.failed")),
  });

  const address = data?.address ?? null;
  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      toast.success(t("settings:projectTriage.emailIntake.copied"));
    } catch {
      toast.error(t("settings:projectTriage.emailIntake.copyFailed"));
    }
  };

  if (isError) return null;

  return (
    <SettingsCard>
      <SettingsRow
        title={t("settings:projectTriage.emailIntake.title")}
        description={t("settings:projectTriage.emailIntake.description")}
        stack
      >
        {data?.available && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate(!address)}
          >
            {address
              ? t("settings:projectTriage.emailIntake.disable")
              : t("settings:projectTriage.emailIntake.enable")}
          </Button>
        )}
      </SettingsRow>
      {data && !data.available && (
        <p role="status" className="px-4 pb-3.5 text-muted-foreground text-sm">
          {t("settings:projectTriage.emailIntake.off")}
        </p>
      )}
      {address && (
        <div className="flex flex-col gap-2 px-4 pb-3.5">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {t("settings:projectTriage.emailIntake.address")}
            </span>
            <code className="min-w-0 truncate rounded bg-muted px-1.5 py-0.5 text-sm">
              {address}
            </code>
            <Button type="button" variant="ghost" size="sm" onClick={copy}>
              {t("settings:projectTriage.emailIntake.copy")}
            </Button>
          </div>
          {!data?.repliesAvailable && (
            <p role="status" className="text-muted-foreground text-sm">
              {t("settings:projectTriage.emailIntake.repliesOff")}
            </p>
          )}
        </div>
      )}
    </SettingsCard>
  );
}
