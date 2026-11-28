import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { Switch } from "@/components/ui/switch";
import type { AiFeatures } from "@/fetchers/agent/ai-features";
import { useSetAiFeatures } from "@/hooks/mutations/agent/use-set-ai-features";
import { useAiFeatures } from "@/hooks/queries/agent/use-ai-features";

const SWITCHES = ["triage", "prSummary"] as const;

/** Background AI features that call the model on their own; each off by default. */
export function AiFeaturesCard({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data } = useAiFeatures(workspaceId);
  const save = useSetAiFeatures(workspaceId);
  if (!data) return null;
  const set = (next: AiFeatures) =>
    save.mutate(next, {
      onError: () => toast.error(t("settings:aiUsage.switches.saveFailed")),
    });

  return (
    <SettingsCard>
      {SWITCHES.map((feature) => (
        <SettingsRow
          key={feature}
          title={t(`settings:aiUsage.switches.${feature}`)}
          description={t(`settings:aiUsage.switches.${feature}Description`)}
        >
          <Switch
            aria-label={t(`settings:aiUsage.switches.${feature}`)}
            checked={data[feature]}
            disabled={save.isPending}
            onCheckedChange={(on) => set({ ...data, [feature]: on })}
          />
        </SettingsRow>
      ))}
    </SettingsCard>
  );
}
