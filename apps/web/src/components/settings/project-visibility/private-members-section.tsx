import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsNote } from "@/components/settings/settings-note";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddPrivateTeamMember,
  useRemovePrivateTeamMember,
} from "@/hooks/mutations/project/use-private-team-member";
import useGetPrivateTeamMembers from "@/hooks/queries/project/use-get-private-team-members";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";
import { toast } from "@/lib/toast";

type PrivateMembersSectionProps = {
  projectId: string;
  workspaceId: string;
};

export function PrivateMembersSection({
  projectId,
  workspaceId,
}: PrivateMembersSectionProps) {
  const { t } = useTranslation();
  const { data: members, isLoading: loadingMembers } = useGetWorkspaceUsers({
    workspaceId,
  });
  const { data: privateTeams, isLoading: loadingTeams } =
    useGetPrivateTeamMembers(workspaceId);
  const add = useAddPrivateTeamMember(workspaceId);
  const remove = useRemovePrivateTeamMember(workspaceId);
  const userIds =
    privateTeams?.find((team) => team.projectId === projectId)?.userIds ?? [];
  const others = (members ?? []).filter((member) => member.role !== "owner");
  const pendingUserId = add.isPending
    ? add.variables?.userId
    : remove.isPending
      ? remove.variables?.userId
      : undefined;

  const toggle = (userId: string, checked: boolean) => {
    const mutation = checked ? add : remove;
    mutation.mutate(
      { projectId, userId },
      {
        onError: (error) =>
          toast.error(
            error instanceof Error && error.message
              ? error.message
              : checked
                ? t("settings:projectVisibility.privateMemberAddError")
                : t("settings:projectVisibility.privateMemberRemoveError"),
          ),
      },
    );
  };

  return (
    <SettingsSection
      title={t("settings:projectVisibility.privateMembersTitle")}
    >
      <SettingsCard>
        {loadingMembers || loadingTeams ? (
          <div className="space-y-3 px-4 py-3.5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : others.length === 0 ? (
          <p className="px-4 py-3.5 text-sm text-muted-foreground">
            {t("settings:projectVisibility.privateMembersEmpty")}
          </p>
        ) : (
          others.map((member) => {
            const name = member.user.name || member.user.email;
            return (
              <SettingsRow
                key={member.userId}
                title={name}
                description={
                  name === member.user.email ? undefined : member.user.email
                }
              >
                <Checkbox
                  aria-label={name}
                  checked={userIds.includes(member.userId)}
                  disabled={pendingUserId === member.userId}
                  onCheckedChange={(checked) => toggle(member.userId, checked)}
                />
              </SettingsRow>
            );
          })
        )}
      </SettingsCard>
      <SettingsNote>
        {t("settings:projectVisibility.privateMembersOwnerNote")}
      </SettingsNote>
    </SettingsSection>
  );
}
