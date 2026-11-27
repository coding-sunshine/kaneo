import { Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useAgentDrafts } from "@/hooks/queries/agent/use-agent-drafts";
import { useWorkspaceProjectUpdates } from "@/hooks/queries/work-project/use-workspace-project-updates";
import { PulseDrafts } from "./pulse-drafts";
import { WorkProjectUpdateItem } from "./work-project-update-item";

/** Linear's Pulse: your loops' drafted updates, then every project update in the workspace, newest first. */
export function PulsePage({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data: updates, isLoading } = useWorkspaceProjectUpdates(workspaceId);
  const { data: drafts = [] } = useAgentDrafts(workspaceId);

  if (!isLoading && !updates?.length && !drafts.length) {
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
    <div className="mx-auto h-full max-w-3xl space-y-6 overflow-y-auto px-6 py-8">
      <PulseDrafts workspaceId={workspaceId} drafts={drafts} />
      <ul className="space-y-3">
        {updates?.map((update) => (
          <WorkProjectUpdateItem
            key={update.id}
            update={update}
            workspaceId={workspaceId}
            showProject
          />
        ))}
      </ul>
    </div>
  );
}
