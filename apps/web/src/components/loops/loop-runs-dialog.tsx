import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AgentTranscript } from "@/components/agent/agent-transcript";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLoopRun, useLoopRuns } from "@/hooks/queries/loop/use-loops";
import { formatDate } from "@/lib/format";

type LoopRunsDialogProps = {
  workspaceId: string;
  loop: { id: string; name: string } | null;
  onClose: () => void;
};

/** Run history for one loop; a run opens as its agent transcript. */
export function LoopRunsDialog({
  workspaceId,
  loop,
  onClose,
}: LoopRunsDialogProps) {
  return (
    <Dialog open={loop !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        {loop ? <RunHistory workspaceId={workspaceId} loop={loop} /> : null}
      </DialogPopup>
    </Dialog>
  );
}

function RunHistory({
  workspaceId,
  loop,
}: {
  workspaceId: string;
  loop: { id: string; name: string };
}) {
  const { t } = useTranslation();
  const [runId, setRunId] = useState<string | null>(null);
  const { data: runs = [] } = useLoopRuns(workspaceId, loop.id);
  const { data: run } = useLoopRun(workspaceId, loop.id, runId);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{loop.name}</DialogTitle>
      </DialogHeader>
      <DialogPanel className="flex flex-col gap-3">
        {runId ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setRunId(null)}
            >
              {t("navigation:loops.backToRuns")}
            </Button>
            {run?.error ? (
              <p className="text-destructive text-xs">{run.error}</p>
            ) : null}
            <AgentTranscript messages={run?.messages ?? []} />
          </>
        ) : runs.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground text-sm">
            {t("navigation:loops.noRuns")}
          </p>
        ) : (
          <ul className="flex flex-col">
            {runs.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setRunId(item.id)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-[13px] hover:bg-accent"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {formatDate(item.startedAt, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {t(`navigation:loops.trigger_${item.trigger}`)}
                  </span>
                  <span className="w-20 text-right text-muted-foreground text-xs">
                    {t(`navigation:loops.status.${item.status}`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogPanel>
    </>
  );
}
