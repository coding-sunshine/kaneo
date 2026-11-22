import { CheckCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ContextMenuItem } from "@/components/ui/context-menu";
import useMarkAllNotificationsAsRead from "@/hooks/mutations/notification/use-mark-all-notifications-as-read";

// Its own component so the mutation only mounts while the Inbox menu is open.
export function MarkAllReadItem({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { mutate } = useMarkAllNotificationsAsRead(workspaceId);

  return (
    <ContextMenuItem onClick={() => mutate()}>
      <CheckCheck aria-hidden="true" />
      {t("navigation:customizeSidebar.markAllRead")}
    </ContextMenuItem>
  );
}
