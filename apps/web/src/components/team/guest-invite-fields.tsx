import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { Fieldset, FieldsetLegend } from "@/components/ui/fieldset";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useChannels } from "@/hooks/queries/chat/use-channels";

type Props = {
  workspaceId: string;
  guest: boolean;
  onGuestChange: (guest: boolean) => void;
  channelIds: string[];
  onChannelIdsChange: (channelIds: string[]) => void;
  disabled?: boolean;
};

/** The guest switch of the invite form, with the channels a guest joins. */
function GuestInviteFields({
  workspaceId,
  guest,
  onGuestChange,
  channelIds,
  onChannelIdsChange,
  disabled = false,
}: Props) {
  const { t } = useTranslation();
  const { data: channels } = useChannels(workspaceId);
  const open = (channels ?? []).filter((channel) => !channel.archivedAt);

  return (
    <div className="flex flex-col gap-3">
      <Label className="items-start gap-3">
        <Switch
          checked={guest}
          onCheckedChange={onGuestChange}
          disabled={disabled}
        />
        <span className="flex flex-col gap-0.5">
          {t("team:guest.inviteLabel")}
          <span className="font-normal text-muted-foreground text-xs">
            {t("team:guest.inviteHint")}
          </span>
        </span>
      </Label>
      {guest ? (
        <Fieldset
          className="max-w-none gap-3 ps-7"
          render={
            <CheckboxGroup
              disabled={disabled}
              value={channelIds}
              onValueChange={onChannelIdsChange}
            />
          }
        >
          <FieldsetLegend className="text-sm font-medium">
            {t("team:guest.channelsLabel")}
          </FieldsetLegend>
          {open.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("team:guest.noChannels")}
            </p>
          ) : (
            open.map((channel) => (
              <Label key={channel.id} className="max-w-full">
                <Checkbox value={channel.id} />
                <span className="truncate">#{channel.name}</span>
              </Label>
            ))
          )}
        </Fieldset>
      ) : null}
    </div>
  );
}

export default GuestInviteFields;
