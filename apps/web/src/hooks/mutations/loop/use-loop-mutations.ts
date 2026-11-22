import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createLoop,
  deleteLoop,
  draftLoop,
  type LoopInput,
  runLoop,
  updateLoop,
} from "@/fetchers/loop/loops";
import { loopsKey } from "@/hooks/queries/loop/use-loops";

export function useLoopMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: loopsKey(workspaceId) });
    queryClient.invalidateQueries({ queryKey: ["loop-runs", workspaceId] });
  };
  return {
    draft: useMutation({
      mutationFn: (description: string) => draftLoop(workspaceId, description),
    }),
    create: useMutation({
      mutationFn: (input: LoopInput) => createLoop(workspaceId, input),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        ...input
      }: Partial<LoopInput> & { id: string; enabled?: boolean }) =>
        updateLoop(workspaceId, id, input),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteLoop(workspaceId, id),
      onSuccess: refresh,
    }),
    run: useMutation({
      mutationFn: (id: string) => runLoop(workspaceId, id),
      onSuccess: refresh,
    }),
  };
}
