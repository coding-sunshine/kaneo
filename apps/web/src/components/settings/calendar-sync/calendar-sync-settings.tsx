import { CalendarOffIcon, RefreshCwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { SettingsNote } from "@/components/settings/settings-note";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { useDisconnectCalendar } from "@/hooks/mutations/calendar-sync/use-disconnect-calendar";
import { useSyncCalendarTasks } from "@/hooks/mutations/calendar-sync/use-sync-calendar-tasks";
import { useCalendarSyncStatus } from "@/hooks/queries/calendar-sync/use-calendar-sync-status";
import { toast } from "@/lib/toast";
import { CalendarProviderRow } from "./calendar-provider-row";

export function CalendarSyncSettings() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useCalendarSyncStatus();
  const disconnect = useDisconnectCalendar();
  const sync = useSyncCalendarTasks();
  const connected = data?.providers.some((item) => item.state === "connected");

  const handleDisconnect = (
    provider: Parameters<typeof disconnect.mutate>[0],
  ) =>
    disconnect.mutate(provider, {
      onSuccess: () => toast.success(t("settings:calendarSync.disconnected")),
      onError: (error) => toast.error(error.message),
    });

  const handleSync = () =>
    sync.mutate(undefined, {
      onSuccess: ({ synced }) =>
        toast.success(t("settings:calendarSync.synced", { count: synced })),
      onError: (error) => toast.error(error.message),
    });

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t("settings:calendarSync.accountsTitle")}
        description={t("settings:calendarSync.accountsDescription")}
      >
        <SettingsCard>
          {isLoading ? (
            <SettingsRowsSkeleton rows={2} withDescription />
          ) : isError || !data ? (
            <SettingsEmpty
              icon={<CalendarOffIcon />}
              title={t("settings:calendarSync.loadFailed")}
            />
          ) : (
            data.providers.map((status) => (
              <CalendarProviderRow
                key={status.provider}
                status={status}
                onDisconnect={handleDisconnect}
                disconnecting={disconnect.isPending}
              />
            ))
          )}
        </SettingsCard>
        <SettingsNote>{t("settings:calendarSync.howItWorks")}</SettingsNote>
      </SettingsSection>

      {connected ? (
        <SettingsSection title={t("settings:calendarSync.dueDatesTitle")}>
          <SettingsCard>
            <SettingsRow
              icon={<RefreshCwIcon />}
              title={t("settings:calendarSync.syncNow")}
              description={t("settings:calendarSync.syncNowDescription")}
            >
              <Button
                variant="outline"
                size="sm"
                disabled={sync.isPending}
                onClick={handleSync}
              >
                {t("settings:calendarSync.syncNowAction")}
              </Button>
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>
      ) : null}
    </div>
  );
}
