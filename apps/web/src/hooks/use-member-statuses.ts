import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import useGetWorkspaceMembers from "@/hooks/queries/workspace-users/use-get-workspace-members";
import { memberStatusHint } from "@/lib/people/member-status-hint";

/** The status line of each workspace member who set one, by user id. */
export function useMemberStatuses(workspaceId: string) {
  const { t } = useTranslation();
  const { data: members } = useGetWorkspaceMembers(workspaceId);
  return useMemo(() => {
    const statuses = new Map<string, string>();
    for (const member of members ?? []) {
      const hint = memberStatusHint(
        member.profile,
        t("team:people.outOfOffice"),
      );
      if (hint) statuses.set(member.id, hint);
    }
    return statuses;
  }, [members, t]);
}
