import { useTranslation } from "react-i18next";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";

/** "A is typing" under the history; empty, but still announced, when nobody is. */
export function TypingIndicator({
  workspaceId,
  userIds,
}: {
  workspaceId: string;
  userIds: string[];
}) {
  const { t } = useTranslation();
  const { data } = useGetActiveWorkspaceUsers(workspaceId);
  const names = userIds.map(
    (id) =>
      data?.members.find((member) => member.userId === id)?.user.name ??
      t("navigation:chat.deletedUser"),
  );
  const text =
    names.length === 0
      ? ""
      : names.length === 1
        ? t("navigation:chat.typingOne", { name: names[0] })
        : names.length === 2
          ? t("navigation:chat.typingTwo", {
              first: names[0],
              second: names[1],
            })
          : t("navigation:chat.typingMany");

  return (
    <p
      role="status"
      aria-live="polite"
      className="h-5 truncate px-4 text-xs text-muted-foreground"
    >
      {text}
    </p>
  );
}
