import { useMutation, useQueryClient } from "@tanstack/react-query";
import dismissChecklist from "@/fetchers/onboarding/dismiss-checklist";
import { ONBOARDING_CHECKLIST_QUERY_KEY } from "@/hooks/queries/onboarding/use-onboarding-checklist";

function useDismissChecklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissChecklist,
    onSuccess: () => {
      queryClient.setQueryData(ONBOARDING_CHECKLIST_QUERY_KEY, null);
    },
  });
}

export default useDismissChecklist;
