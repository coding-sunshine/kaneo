import { useTranslation } from "react-i18next";
import { AgentProposalCard } from "@/components/agent/agent-proposal-card";
import type { AgentProposal } from "@/fetchers/agent/proposals";

/** Project updates the person's loops drafted; accepting one posts it as them. */
export function PulseDrafts({
  workspaceId,
  drafts,
}: {
  workspaceId: string;
  drafts: AgentProposal[];
}) {
  const { t } = useTranslation();
  if (drafts.length === 0) return null;
  return (
    <section
      aria-label={t("workspace:workProject.updates.drafts")}
      className="space-y-3"
    >
      <h2 className="font-medium text-sm">
        {t("workspace:workProject.updates.drafts")}
      </h2>
      <p className="text-muted-foreground text-xs">
        {t("workspace:workProject.updates.draftsHint")}
      </p>
      {drafts.map((draft) => (
        <AgentProposalCard
          key={draft.id}
          workspaceId={workspaceId}
          proposal={draft}
        />
      ))}
    </section>
  );
}
