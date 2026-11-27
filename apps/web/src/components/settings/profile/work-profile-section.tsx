import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { WorkProfileField } from "@/components/settings/profile/work-profile-field";
import type { OwnProfileUpdate } from "@/fetchers/user/update-own-profile";
import useUpdateOwnProfile from "@/hooks/mutations/user/use-update-own-profile";
import useOwnProfile from "@/hooks/queries/user/use-own-profile";
import { timeZones } from "@/lib/time-zones";
import { toast } from "@/lib/toast";

export function WorkProfileSection() {
  const { t } = useTranslation();
  const { data: profile } = useOwnProfile();
  const { mutate } = useUpdateOwnProfile();
  const save = (update: OwnProfileUpdate) =>
    mutate(update, {
      onError: () => toast.error(t("settings:peopleProfile.saveError")),
    });
  const zone = profile?.timeZone ?? "";
  const zones = timeZones();
  const options = !zone || zones.includes(zone) ? zones : [zone, ...zones];

  return (
    <SettingsSection
      title={t("settings:peopleProfile.sectionTitle")}
      description={t("settings:peopleProfile.sectionDescription")}
    >
      <SettingsCard>
        <WorkProfileField
          label={t("settings:peopleProfile.jobTitle")}
          placeholder={t("settings:peopleProfile.jobTitlePlaceholder")}
          value={profile?.jobTitle}
          onSave={(jobTitle) => save({ jobTitle })}
        />
        <WorkProfileField
          label={t("settings:peopleProfile.department")}
          placeholder={t("settings:peopleProfile.departmentPlaceholder")}
          value={profile?.department}
          onSave={(department) => save({ department })}
        />
        <WorkProfileField
          label={t("settings:peopleProfile.location")}
          placeholder={t("settings:peopleProfile.locationPlaceholder")}
          value={profile?.location}
          onSave={(location) => save({ location })}
        />
        <SettingsRow stack title={t("settings:peopleProfile.timeZone")}>
          <select
            aria-label={t("settings:peopleProfile.timeZone")}
            className="h-8 rounded-lg border bg-background px-2 text-sm sm:w-64"
            value={zone}
            onChange={(event) => save({ timeZone: event.target.value || null })}
          >
            <option value="">{t("settings:peopleProfile.timeZoneNone")}</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
