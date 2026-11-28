import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useChannels } from "@/hooks/queries/chat/use-channels";
import {
  useBriefPreference,
  useSetBriefPreference,
} from "@/hooks/queries/daily-brief/use-daily-brief";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { toast } from "@/lib/toast";

type Draft = { enabled: boolean; channelIds: string[] };

/** A private morning brief in the Inbox, reading only the chosen channels. */
export function DailyBriefSection() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id ?? "";
  const { data: saved } = useBriefPreference(workspaceId);
  const { data: channels = [] } = useChannels(workspaceId);
  const save = useSetBriefPreference(workspaceId);
  const [draft, setDraft] = useState<{ of: unknown; value: Draft } | null>(
    null,
  );
  if (!workspaceId || !saved) return null;
  const value = draft?.of === saved ? draft.value : saved;
  const edit = (next: Partial<Draft>) =>
    setDraft({ of: saved, value: { ...value, ...next } });
  const choosable = channels.filter(
    (channel) => !channel.isDirect && !channel.archivedAt,
  );
  const dirty =
    value.enabled !== saved.enabled ||
    [...value.channelIds].sort().join() !== [...saved.channelIds].sort().join();

  return (
    <SettingsSection
      title={t("settings:notificationsPage.dailyBrief.title")}
      description={t("settings:notificationsPage.dailyBrief.description")}
    >
      <SettingsCard>
        <SettingsRow
          title={t("settings:notificationsPage.dailyBrief.enabled")}
          description={t("settings:notificationsPage.dailyBrief.enabledHint")}
        >
          <Switch
            aria-label={t("settings:notificationsPage.dailyBrief.enabled")}
            checked={value.enabled}
            onCheckedChange={(enabled) => edit({ enabled })}
          />
        </SettingsRow>
        {value.enabled && (
          <SettingsRow
            title={t("settings:notificationsPage.dailyBrief.channels")}
            description={t(
              "settings:notificationsPage.dailyBrief.channelsHint",
            )}
          >
            <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
              {choosable.map((channel) => (
                <Label
                  key={channel.id}
                  className="flex items-center gap-2 font-normal"
                >
                  <Checkbox
                    checked={value.channelIds.includes(channel.id)}
                    onCheckedChange={(checked) =>
                      edit({
                        channelIds: checked
                          ? [...value.channelIds, channel.id]
                          : value.channelIds.filter((id) => id !== channel.id),
                      })
                    }
                  />
                  #{channel.name}
                </Label>
              ))}
            </div>
          </SettingsRow>
        )}
        <div className="flex justify-end px-4 py-3">
          <Button
            size="sm"
            disabled={!dirty || save.isPending}
            onClick={() =>
              save.mutate(value, {
                onSuccess: () => {
                  setDraft(null);
                  toast.success(
                    t("settings:notificationsPage.dailyBrief.saved"),
                  );
                },
                onError: (error) => toast.error(error.message),
              })
            }
          >
            {t("settings:notificationsPage.dailyBrief.save")}
          </Button>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
