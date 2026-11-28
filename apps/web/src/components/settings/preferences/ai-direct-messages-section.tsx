import { useTranslation } from "react-i18next";
import { PreferenceSwitchRow } from "@/components/settings/preferences/preference-switch-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";
import {
  useCatchUpPreference,
  useSetCatchUpPreference,
} from "@/hooks/queries/catch-up/use-catch-up-preference";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

/** Whether AI answers for you may read your direct messages. Off by default. */
export function AiDirectMessagesSection() {
  const { t } = useTranslation();
  const hasAgent = useHasAgent();
  const workspaceId = useActiveWorkspace().data?.id ?? "";
  const enabled = hasAgent && Boolean(workspaceId);
  const preference = useCatchUpPreference(workspaceId, enabled);
  const setPreference = useSetCatchUpPreference(workspaceId);

  if (!enabled) return null;
  return (
    <SettingsSection title={t("settings:preferencesPage.aiTitle")}>
      <SettingsCard>
        <PreferenceSwitchRow
          title={t("settings:preferencesPage.aiDirectMessages")}
          description={t(
            "settings:preferencesPage.aiDirectMessagesDescription",
          )}
          checked={preference.data?.includeDirectMessages ?? false}
          onCheckedChange={(include) => setPreference.mutate(include)}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
