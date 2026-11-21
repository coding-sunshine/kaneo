import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import useUpdateTeamMembership from "@/hooks/mutations/project/use-update-team-membership";
import { toast } from "@/lib/toast";

export type LeavingTeam = { id: string; name: string };

/**
 * Linear's "Leave team…" confirmation. Lives outside the team menu, which
 * unmounts as soon as the row is picked.
 */
export function LeaveTeamDialog({
  workspaceId,
  team,
  onClose,
}: {
  workspaceId: string;
  team: LeavingTeam | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { mutate } = useUpdateTeamMembership(workspaceId);

  return (
    <AlertDialog open={!!team} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("navigation:projectList.leaveConfirmTitle", {
              name: team?.name,
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("navigation:projectList.leaveConfirmDescription", {
              name: team?.name,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" size="sm" />}>
            {t("common:actions.cancel")}
          </AlertDialogClose>
          <AlertDialogClose
            render={
              <Button
                size="sm"
                onClick={() =>
                  team &&
                  mutate(
                    { projectId: team.id, joined: false },
                    { onError: (error) => toast.error(error.message) },
                  )
                }
              />
            }
          >
            {t("navigation:projectList.leaveTeam")}
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
