import { useQuery } from "@tanstack/react-query";
import { getLoops, getRun, getRuns } from "@/fetchers/loop/loops";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";

export const loopsKey = (workspaceId: string) => ["loops", workspaceId];

export function useLoops(workspaceId: string, scope: "mine" | "all") {
  const enabled = useHasAgent() && Boolean(workspaceId);
  return useQuery({
    enabled,
    queryKey: [...loopsKey(workspaceId), scope],
    queryFn: () => getLoops(workspaceId, scope),
  });
}

export function useLoopRuns(workspaceId: string, loopId: string) {
  return useQuery({
    queryKey: ["loop-runs", workspaceId, loopId],
    queryFn: () => getRuns(workspaceId, loopId),
  });
}

export function useLoopRun(
  workspaceId: string,
  loopId: string,
  runId: string | null,
) {
  return useQuery({
    enabled: Boolean(runId),
    queryKey: ["loop-run", workspaceId, loopId, runId],
    queryFn: () => getRun(workspaceId, loopId, runId ?? ""),
  });
}
