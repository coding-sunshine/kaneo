import { Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import { InitiativeUpdateItem } from "@/components/initiative/initiative-update-item";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useWorkspaceInitiativeUpdates } from "@/hooks/queries/initiative/use-workspace-initiative-updates";
import { useWorkspaceProjectUpdates } from "@/hooks/queries/work-project/use-workspace-project-updates";
import { mergePulse } from "./merge-pulse";
import { WorkProjectUpdateItem } from "./work-project-update-item";

/** Linear's Pulse: every project and initiative update, newest first. */
export function PulsePage({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const projects = useWorkspaceProjectUpdates(workspaceId);
  const initiatives = useWorkspaceInitiativeUpdates(workspaceId);
  const isLoading = projects.isLoading || initiatives.isLoading;
  const entries = mergePulse(projects.data ?? [], initiatives.data ?? []);

  if (!isLoading && entries.length === 0) {
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
      {entries.map((entry) =>
        entry.kind === "initiative" ? (
          <InitiativeUpdateItem
            key={`initiative-${entry.update.id}`}
            update={entry.update}
            workspaceId={workspaceId}
            showInitiative
          />
        ) : (
          <WorkProjectUpdateItem
            key={`project-${entry.update.id}`}
            update={entry.update}
            workspaceId={workspaceId}
            showProject
          />
        ),
      )}
    </ul>
  );
}
