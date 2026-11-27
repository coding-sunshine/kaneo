import { CalendarDaysIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { StatusBadge } from "@/components/settings/status-badge";
import { Button } from "@/components/ui/button";
import {
  type CalendarProviderId,
  type CalendarProviderStatus,
  getCalendarConnectUrl,
} from "@/fetchers/calendar-sync/calendar-sync";

const RETURN_TO = "/dashboard/settings/account/calendar";

const PROVIDER_LABEL = {
  google: "settings:calendarSync.providers.google",
  microsoft: "settings:calendarSync.providers.microsoft",
} as const;

const PROVIDER_DESCRIPTION = {
  google: "settings:calendarSync.descriptions.google",
  microsoft: "settings:calendarSync.descriptions.microsoft",
} as const;

type CalendarProviderRowProps = {
  status: CalendarProviderStatus;
  onDisconnect: (provider: CalendarProviderId) => void;
  disconnecting: boolean;
};

export function CalendarProviderRow({
  status,
  onDisconnect,
  disconnecting,
}: CalendarProviderRowProps) {
  const { t } = useTranslation();
  const { provider, state, email } = status;

  const description =
    state === "not_configured"
      ? t("settings:calendarSync.notConfigured")
      : state === "connected"
        ? (email ?? t("settings:calendarSync.connectedNoEmail"))
        : state === "needs_reconnect"
          ? t("settings:calendarSync.needsReconnectDescription")
          : t(PROVIDER_DESCRIPTION[provider]);

  return (
    <SettingsRow
      icon={<CalendarDaysIcon />}
      title={t(PROVIDER_LABEL[provider])}
      badge={
        state === "connected" ? (
          <StatusBadge tone="success">
            {t("settings:calendarSync.connected")}
          </StatusBadge>
        ) : state === "needs_reconnect" ? (
          <StatusBadge tone="warning">
            {t("settings:calendarSync.needsReconnect")}
          </StatusBadge>
        ) : null
      }
      description={description}
    >
      {state === "connected" ? (
        <Button
          variant="outline"
          size="sm"
          disabled={disconnecting}
          onClick={() => onDisconnect(provider)}
        >
          {t("settings:calendarSync.disconnect")}
        </Button>
      ) : state === "not_configured" ? null : (
        <Button
          variant="outline"
          size="sm"
          render={<a href={getCalendarConnectUrl(provider, RETURN_TO)} />}
        >
          {t(
            state === "needs_reconnect"
              ? "settings:calendarSync.reconnect"
              : "settings:calendarSync.connect",
          )}
        </Button>
      )}
    </SettingsRow>
  );
}
