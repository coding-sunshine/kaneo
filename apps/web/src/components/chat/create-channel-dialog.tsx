import { useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCreateChannel } from "@/hooks/mutations/chat/use-channel-mutations";
import { toast } from "@/lib/toast";

type CreateChannelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
};

export function CreateChannelDialog({
  open,
  onOpenChange,
  workspaceId,
}: CreateChannelDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const create = useCreateChannel(workspaceId);
  const privateId = useId();

  const save = () => {
    if (!name.trim() || create.isPending) return;
    create.mutate(
      { name: name.trim(), topic: topic.trim() || undefined, isPrivate },
      {
        onSuccess: (channel) => {
          setName("");
          setTopic("");
          setIsPrivate(false);
          onOpenChange(false);
          navigate({
            to: "/dashboard/workspace/$workspaceId/channels/$channelId",
            params: { workspaceId, channelId: channel.id },
          });
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("navigation:chat.createTitle")}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          <Input
            autoFocus
            value={name}
            maxLength={80}
            placeholder={t("navigation:chat.namePlaceholder")}
            aria-label={t("navigation:chat.name")}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && save()}
          />
          <Input
            value={topic}
            maxLength={250}
            placeholder={t("navigation:chat.topicPlaceholder")}
            aria-label={t("navigation:chat.topic")}
            onChange={(event) => setTopic(event.target.value)}
          />
          <label
            htmlFor={privateId}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex flex-col">
              <span>{t("navigation:chat.private")}</span>
              <span className="text-xs text-muted-foreground">
                {t("navigation:chat.privateHint")}
              </span>
            </span>
            <Switch
              id={privateId}
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
            />
          </label>
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={!name.trim() || create.isPending}
            onClick={save}
          >
            {t("navigation:chat.create")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
