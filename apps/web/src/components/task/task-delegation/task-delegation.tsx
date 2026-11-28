import { Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useDelegateTask } from "@/hooks/mutations/agent/use-delegate-task";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";
import { useCodingAgent } from "@/hooks/queries/agent/use-coding-agent";
import { useTaskDelegations } from "@/hooks/queries/agent/use-task-delegations";
import { TaskDelegationRun } from "./task-delegation-run";

/**
 * "Delegate" on a ticket: proposes handing it to the server's coding agent
 * (a card to accept), and lists the runs with their pull requests.
 */
export function TaskDelegation({
  workspaceId,
  taskId,
}: {
  workspaceId: string;
  taskId: string;
}) {
  const { t } = useTranslation();
  const hasAgent = useHasAgent();
  const { data: agent } = useCodingAgent(workspaceId);
  const { data: runs } = useTaskDelegations(workspaceId, taskId);
  const delegate = useDelegateTask(workspaceId, taskId);
  if (!hasAgent || !agent) return null;
  return (
    <section
      aria-label={t("tasks:delegation.title")}
      className="flex flex-col gap-2"
    >
      {agent.configured ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={delegate.isPending}
            onClick={() => delegate.mutate()}
          >
            <Bot />
            {t("tasks:delegation.action", { name: agent.name })}
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          {t("tasks:delegation.notConfigured")}
        </p>
      )}
      {delegate.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {delegate.error.message}
        </p>
      ) : null}
      {runs?.length ? (
        <ul className="flex flex-col gap-1">
          {runs.map((run) => (
            <li key={run.id}>
              <TaskDelegationRun run={run} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
