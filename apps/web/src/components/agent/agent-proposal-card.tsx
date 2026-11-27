import { Check, Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AgentFieldDiff } from "@/components/agent/agent-field-diff";
import { AgentSourceChip } from "@/components/agent/agent-source-chip";
import { Button } from "@/components/ui/button";
import type { AgentProposal } from "@/fetchers/agent/proposals";
import { useDecideProposal } from "@/hooks/mutations/agent/use-decide-proposal";
import { toast } from "@/lib/toast";

const STATUS_KEYS = {
  pending: "navigation:agent.proposal.status.pending",
  accepted: "navigation:agent.proposal.status.accepted",
  declined: "navigation:agent.proposal.status.declined",
  failed: "navigation:agent.proposal.status.failed",
} as const;

/**
 * A write the agent proposed: what would change, why, and what it rests on.
 * Nothing changes until the person accepts it.
 */
export function AgentProposalCard({
  workspaceId,
  chatId,
  proposal,
}: {
  workspaceId: string;
  chatId: string;
  proposal: AgentProposal;
}) {
  const { t } = useTranslation();
  const decide = useDecideProposal(workspaceId, chatId);
  const submit = (decision: "accept" | "decline") =>
    decide.mutate(
      { proposalId: proposal.id, decision },
      {
        onSuccess: (decided) => {
          if (decided.status === "failed")
            toast.error(t("navigation:agent.proposal.failed"));
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <section
      aria-label={t("navigation:agent.proposal.label")}
      className="flex max-w-[85%] flex-col gap-2.5 rounded-lg border border-border/70 bg-card p-3"
    >
      <header className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <Sparkles className="size-3" aria-hidden="true" />
        <span>{t("navigation:agent.proposal.label")}</span>
      </header>
      <AgentFieldDiff diff={proposal.diff} />
      <p className="text-xs">
        <span className="text-muted-foreground">
          {t("navigation:agent.proposal.reason")}{" "}
        </span>
        {proposal.reason}
      </p>
      {proposal.sources.length ? (
        <ul
          aria-label={t("navigation:agent.sources.label")}
          className="flex flex-wrap gap-1.5"
        >
          {proposal.sources.map((citation, index) => (
            <li
              key={
                citation.restricted
                  ? `restricted-${index}`
                  : `${citation.kind}-${citation.id}`
              }
            >
              <AgentSourceChip workspaceId={workspaceId} citation={citation} />
            </li>
          ))}
        </ul>
      ) : null}
      {proposal.status === "pending" ? (
        <div className="flex gap-2">
          <Button
            size="xs"
            disabled={decide.isPending}
            onClick={() => submit("accept")}
          >
            <Check aria-hidden="true" />
            {t("navigation:agent.proposal.accept")}
          </Button>
          <Button
            size="xs"
            variant="outline"
            disabled={decide.isPending}
            onClick={() => submit("decline")}
          >
            <X aria-hidden="true" />
            {t("navigation:agent.proposal.decline")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1 text-xs" role="status">
          <p className="text-muted-foreground">
            {t(STATUS_KEYS[proposal.status])}
          </p>
          {proposal.result ? (
            <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-destructive">
              {proposal.result}
            </pre>
          ) : null}
        </div>
      )}
    </section>
  );
}
