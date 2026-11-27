import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createInitiative,
  deleteInitiative,
  updateInitiative,
} from "@/fetchers/initiative/initiatives";
import type {
  CreateInitiativeUpdateInput,
  UpdateInitiativeInput,
} from "@/fetchers/initiative/types";
import {
  createInitiativeUpdate,
  deleteInitiativeUpdate,
} from "@/fetchers/initiative/updates";
import { initiativeKeys } from "@/hooks/queries/initiative/initiative-keys";

// Lists, details, updates and Pulse all show health from the latest update.
function useInvalidateInitiatives() {
  const queryClient = useQueryClient();
  return () =>
    void queryClient.invalidateQueries({ queryKey: initiativeKeys.all });
}

export function useCreateInitiative() {
  const onSuccess = useInvalidateInitiatives();
  return useMutation({ mutationFn: createInitiative, onSuccess });
}

export function useUpdateInitiative(id: string) {
  const onSuccess = useInvalidateInitiatives();
  return useMutation({
    mutationFn: (json: UpdateInitiativeInput) => updateInitiative(id, json),
    onSuccess,
  });
}

export function useDeleteInitiative() {
  const onSuccess = useInvalidateInitiatives();
  return useMutation({ mutationFn: deleteInitiative, onSuccess });
}

export function useCreateInitiativeUpdate(id: string) {
  const onSuccess = useInvalidateInitiatives();
  return useMutation({
    mutationFn: (json: CreateInitiativeUpdateInput) =>
      createInitiativeUpdate(id, json),
    onSuccess,
  });
}

export function useDeleteInitiativeUpdate() {
  const onSuccess = useInvalidateInitiatives();
  return useMutation({ mutationFn: deleteInitiativeUpdate, onSuccess });
}
