import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Switch } from "@/components/ui/switch";
import { useDesktopPush } from "./use-desktop-push";

const HINT = {
  unsupported: "settings:notificationsPage.desktopUnsupported",
  "server-off": "settings:notificationsPage.desktopServerOff",
  denied: "settings:notificationsPage.desktopDenied",
  on: "settings:notificationsPage.desktopOnHint",
  off: "settings:notificationsPage.desktopOffHint",
} as const;

export function DesktopPushSection() {
  const { t } = useTranslation();
  const { state, loading, busy, setEnabled } = useDesktopPush();
  const available = state === "on" || state === "off";

  return (
    <SettingsSection
      title={t("settings:notificationsPage.desktopTitle")}
      description={t("settings:notificationsPage.desktopDescription")}
    >
      <SettingsCard>
        <SettingsRow
          title={t("settings:notificationsPage.desktopEnabled")}
          description={loading ? undefined : t(HINT[state])}
        >
          <Switch
            aria-label={t("settings:notificationsPage.desktopEnabled")}
            checked={state === "on"}
            disabled={loading || busy || !available}
            onCheckedChange={(on) => setEnabled(on)}
          />
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
