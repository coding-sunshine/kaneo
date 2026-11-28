import { AgentProposalCard } from "@/components/agent/agent-proposal-card";
import { useTaskProposals } from "@/hooks/queries/agent/use-task-proposals";

/** The person's own proposal cards about this ticket, such as AI triage. */
export function TaskProposals({
  workspaceId,
  taskId,
}: {
  workspaceId: string;
  taskId: string;
}) {
  const { data: proposals } = useTaskProposals(workspaceId, taskId);
  const shown = (proposals ?? []).filter(
    (proposal) => proposal.status === "pending",
  );
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {shown.map((proposal) => (
        <AgentProposalCard
          key={proposal.id}
          workspaceId={workspaceId}
          taskId={taskId}
          proposal={proposal}
        />
      ))}
    </div>
  );
}
