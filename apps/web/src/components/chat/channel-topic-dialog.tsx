import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChatChannelDetail } from "@/components/chat/types";
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
import { useUpdateChannel } from "@/hooks/mutations/chat/use-channel-mutations";
import { toast } from "@/lib/toast";

type ChannelTopicDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  channel: ChatChannelDetail;
};

export function ChannelTopicDialog({
  open,
  onOpenChange,
  workspaceId,
  channel,
}: ChannelTopicDialogProps) {
  const { t } = useTranslation();
  const [topic, setTopic] = useState(channel.topic ?? "");
  const update = useUpdateChannel(workspaceId, channel.id);

  const save = () =>
    !update.isPending &&
    update.mutate(
      { topic: topic.trim() || null },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("navigation:chat.setTopic")}</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <Input
            autoFocus
            value={topic}
            maxLength={250}
            placeholder={t("navigation:chat.topicPlaceholder")}
            aria-label={t("navigation:chat.topic")}
            onChange={(event) => setTopic(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && save()}
          />
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button size="sm" disabled={update.isPending} onClick={save}>
            {t("navigation:chat.saveTopic")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
