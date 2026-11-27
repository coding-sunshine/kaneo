import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useUpdateOwnProfile from "@/hooks/mutations/user/use-update-own-profile";
import useOwnProfile from "@/hooks/queries/user/use-own-profile";
import { localDayRange, toDateInput } from "@/lib/people/local-day-range";
import { toast } from "@/lib/toast";

export function StatusSection() {
  const { t } = useTranslation();
  const { data: profile } = useOwnProfile();
  const { mutate, isPending } = useUpdateOwnProfile();
  const [text, setText] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");

  useEffect(() => {
    setText(profile?.status?.text ?? "");
    setFrom(profile?.outOfOffice ? toDateInput(profile.outOfOffice.from) : "");
    setUntil(
      profile?.outOfOffice ? toDateInput(profile.outOfOffice.until) : "",
    );
  }, [profile]);

  const hasRange = Boolean(from || until);
  const rangeInvalid = hasRange && (!from || !until || until < from);
  const isSet = Boolean(profile?.status || profile?.outOfOffice);

  const onError = () => toast.error(t("settings:peopleStatus.saveError"));
  const save = () => {
    if (!text.trim() && !hasRange) {
      toast.error(t("settings:peopleStatus.needsText"));
      return;
    }
    mutate(
      {
        status: text.trim() ? { text: text.trim() } : null,
        outOfOffice: hasRange ? localDayRange(from, until) : null,
      },
      {
        onSuccess: () => toast.success(t("settings:peopleStatus.saved")),
        onError,
      },
    );
  };
  const clear = () =>
    mutate(
      { status: null, outOfOffice: null },
      {
        onSuccess: () => toast.success(t("settings:peopleStatus.cleared")),
        onError,
      },
    );

  return (
    <SettingsSection
      title={t("settings:peopleStatus.sectionTitle")}
      description={t("settings:peopleStatus.sectionDescription")}
    >
      <SettingsCard>
        <SettingsRow stack title={t("settings:peopleStatus.text")}>
          <Input
            size="sm"
            className="sm:w-64"
            aria-label={t("settings:peopleStatus.text")}
            placeholder={t("settings:peopleStatus.textPlaceholder")}
            maxLength={100}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </SettingsRow>
        <SettingsRow
          stack
          title={t("settings:peopleStatus.outOfOffice")}
          description={
            rangeInvalid
              ? t("settings:peopleStatus.invalidRange")
              : t("settings:peopleStatus.outOfOfficeHint")
          }
        >
          <div className="flex items-center gap-2">
            <Input
              type="date"
              size="sm"
              className="w-40"
              aria-label={t("settings:peopleStatus.from")}
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
            <span aria-hidden="true">–</span>
            <Input
              type="date"
              size="sm"
              className="w-40"
              aria-label={t("settings:peopleStatus.until")}
              value={until}
              min={from || undefined}
              onChange={(event) => setUntil(event.target.value)}
            />
          </div>
        </SettingsRow>
        <div className="flex justify-end gap-2 px-4 py-3">
          {isSet && (
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={clear}
            >
              {t("settings:peopleStatus.clear")}
            </Button>
          )}
          <Button size="sm" disabled={isPending || rangeInvalid} onClick={save}>
            {t("settings:peopleStatus.save")}
          </Button>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
