import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { NotificationPreferences } from "@/fetchers/notification-preferences/get-notification-preferences";
import { useUpdateNotificationPreferences } from "@/hooks/mutations/notification-preferences/use-notification-preferences";
import { cn } from "@/lib/cn";
import { timeZones } from "@/lib/time-zones";

type ScheduleSectionProps = {
  preferences: NotificationPreferences;
};

// 2024-01-07 is a Sunday, so index n maps to day n (0 = Sunday), as the API expects.
const weekdayLabel = (day: number, locale?: string) =>
  new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
    new Date(Date.UTC(2024, 0, 7 + day)),
  );

export function ScheduleSection({ preferences }: ScheduleSectionProps) {
  const { t, i18n } = useTranslation();
  const { mutateAsync, isPending } = useUpdateNotificationPreferences();
  const [enabled, setEnabled] = useState(preferences.scheduleEnabled);
  const [timezone, setTimezone] = useState(preferences.scheduleTimezone);
  const [days, setDays] = useState(preferences.scheduleDays);
  const [start, setStart] = useState(preferences.scheduleStart);
  const [end, setEnd] = useState(preferences.scheduleEnd);

  const zones = timeZones();
  const options = zones.includes(timezone) ? zones : [timezone, ...zones];
  const invalid = days.length === 0 || start >= end;
  const dirty =
    enabled !== preferences.scheduleEnabled ||
    timezone !== preferences.scheduleTimezone ||
    start !== preferences.scheduleStart ||
    end !== preferences.scheduleEnd ||
    days.join() !== preferences.scheduleDays.join();

  const toggleDay = (day: number) =>
    setDays((current) =>
      (current.includes(day)
        ? current.filter((entry) => entry !== day)
        : [...current, day]
      ).sort(),
    );

  const save = () =>
    mutateAsync({
      scheduleEnabled: enabled,
      scheduleTimezone: timezone,
      scheduleDays: days,
      scheduleStart: start,
      scheduleEnd: end,
    }).catch(() => undefined);

  return (
    <SettingsSection
      title={t("settings:notificationsPage.scheduleTitle")}
      description={t("settings:notificationsPage.scheduleDescription")}
    >
      <SettingsCard>
        <SettingsRow
          title={t("settings:notificationsPage.scheduleEnabled")}
          description={t("settings:notificationsPage.scheduleEnabledHint")}
        >
          <Switch
            aria-label={t("settings:notificationsPage.scheduleEnabled")}
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </SettingsRow>
        {enabled ? (
          <>
            <SettingsRow
              title={t("settings:notificationsPage.scheduleTimezone")}
            >
              <select
                aria-label={t("settings:notificationsPage.scheduleTimezone")}
                className="h-8 max-w-56 rounded-lg border bg-background px-2 text-sm"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              >
                {options.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </SettingsRow>
            <SettingsRow title={t("settings:notificationsPage.scheduleDays")}>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={days.includes(day)}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "h-8 rounded-lg border px-2 text-xs",
                      days.includes(day)
                        ? "border-foreground/40 bg-accent font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    {weekdayLabel(day, i18n.language)}
                  </button>
                ))}
              </div>
            </SettingsRow>
            <SettingsRow
              title={t("settings:notificationsPage.scheduleHours")}
              description={
                start >= end
                  ? t("settings:notificationsPage.scheduleHoursInvalid")
                  : undefined
              }
            >
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  className="w-28"
                  aria-label={t("settings:notificationsPage.scheduleStart")}
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
                <span aria-hidden="true">-</span>
                <Input
                  type="time"
                  className="w-28"
                  aria-label={t("settings:notificationsPage.scheduleEnd")}
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </div>
            </SettingsRow>
          </>
        ) : null}
      </SettingsCard>
      {dirty ? (
        <Button
          type="button"
          size="sm"
          disabled={invalid || isPending}
          onClick={save}
        >
          {t("settings:notificationsPage.scheduleSave")}
        </Button>
      ) : null}
    </SettingsSection>
  );
}
