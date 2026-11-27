import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { CalendarSyncSettings } from "@/components/settings/calendar-sync/calendar-sync-settings";
import { SettingsPage } from "@/components/settings/settings-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/calendar",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("settings:calendarSync.pageTitle")} />
      <SettingsPage
        title={t("settings:calendarSync.title")}
        description={t("settings:calendarSync.subtitle")}
      >
        <CalendarSyncSettings />
      </SettingsPage>
    </>
  );
}
