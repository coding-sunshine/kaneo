import { useTranslation } from "react-i18next";
import { directMessageTitle } from "@/components/chat/direct-message-title";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";

/** Names a direct message after the other people in it, for this viewer. */
export function useDirectMessageTitle(workspaceId: string) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data } = useGetActiveWorkspaceUsers(workspaceId);
  const names = new Map(
    (data?.members ?? []).map((member) => [member.userId, member.user.name]),
  );
  return (memberIds: string[]) =>
    directMessageTitle(
      memberIds,
      user?.id,
      names,
      t("navigation:chat.deletedUser"),
    );
}
