import { useMutation, useQueryClient } from "@tanstack/react-query";
import completeChecklistItem from "@/fetchers/onboarding/complete-checklist-item";
import { ONBOARDING_CHECKLIST_QUERY_KEY } from "@/hooks/queries/onboarding/use-onboarding-checklist";

function useCompleteChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeChecklistItem,
    onSuccess: (checklist) => {
      queryClient.setQueryData(ONBOARDING_CHECKLIST_QUERY_KEY, checklist);
    },
  });
}

export default useCompleteChecklistItem;
