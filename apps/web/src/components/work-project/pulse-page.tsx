import { Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useWorkspaceProjectUpdates } from "@/hooks/queries/work-project/use-workspace-project-updates";
import { WorkProjectUpdateItem } from "./work-project-update-item";

/** Linear's Pulse: every project update in the workspace, newest first. */
export function PulsePage({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data: updates, isLoading } = useWorkspaceProjectUpdates(workspaceId);

  if (!isLoading && !updates?.length) {
    return (
      <Empty className="min-h-[60vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Activity />
          </EmptyMedia>
          <EmptyTitle>
            {t("workspace:workProject.updates.pulseEmpty")}
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ul className="mx-auto h-full max-w-3xl space-y-3 overflow-y-auto px-6 py-8">
      {updates?.map((update) => (
        <WorkProjectUpdateItem
          key={update.id}
          update={update}
          workspaceId={workspaceId}
          showProject
        />
      ))}
    </ul>
  );
}
