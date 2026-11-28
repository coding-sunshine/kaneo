import { Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  MenuItem,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "@/components/ui/menu";
import { useRemindMessage } from "@/hooks/mutations/chat/use-later-mutations";
import { toast } from "@/lib/toast";
import { type ReminderChoice, reminderTimes } from "./reminder-times";

type MessageRemindMenuProps = {
  workspaceId: string;
  channelId: string;
  messageId: string;
};

const CHOICES: Array<[ReminderChoice, string]> = [
  ["inOneHour", "navigation:chat.remindInOneHour"],
  ["tomorrow", "navigation:chat.remindTomorrow"],
  ["nextWeek", "navigation:chat.remindNextWeek"],
];

/** Remind me about this message: only the caller hears of it, in their Inbox. */
export function MessageRemindMenu(param: MessageRemindMenuProps) {
  const { t, i18n } = useTranslation();
  const remind = useRemindMessage();

  const pick = (choice: ReminderChoice) => {
    const remindAt = reminderTimes(new Date())[choice];
    remind.mutate(
      { ...param, remindAt },
      {
        onSuccess: () =>
          toast.success(
            t("navigation:chat.reminderSet", {
              time: new Intl.DateTimeFormat(i18n?.language, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(remindAt),
            }),
          ),
        onError: (error: Error) => toast.error(error.message),
      },
    );
  };

  return (
    <MenuSub>
      <MenuSubTrigger>
        <Timer />
        {t("navigation:chat.remindMe")}
      </MenuSubTrigger>
      <MenuSubPopup>
        {CHOICES.map(([choice, label]) => (
          <MenuItem key={choice} onClick={() => pick(choice)}>
            {t(label)}
          </MenuItem>
        ))}
      </MenuSubPopup>
    </MenuSub>
  );
}
