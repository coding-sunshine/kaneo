import { useTranslation } from "react-i18next";
import { PreferenceSwitchRow } from "@/components/settings/preferences/preference-switch-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { useSetPresence } from "@/hooks/mutations/chat/use-set-presence";
import { usePresenceSetting } from "@/hooks/queries/chat/use-presence-setting";
import { toast } from "@/lib/toast";

/** Online presence in chat: off until you turn it on. */
export function ChatPresenceSection() {
  const { t } = useTranslation();
  const { data } = usePresenceSetting();
  const setPresence = useSetPresence();

  return (
    <SettingsSection title={t("settings:preferencesPage.chatTitle")}>
      <SettingsCard>
        <PreferenceSwitchRow
          title={t("settings:preferencesPage.chatPresence")}
          description={t("settings:preferencesPage.chatPresenceDescription")}
          checked={data?.enabled ?? false}
          onCheckedChange={(enabled) =>
            setPresence.mutate(enabled, {
              onError: (error) => toast.error(error.message),
            })
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}
