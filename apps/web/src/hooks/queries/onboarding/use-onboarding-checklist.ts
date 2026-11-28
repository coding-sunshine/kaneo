import { useQuery } from "@tanstack/react-query";
import getOnboardingChecklist from "@/fetchers/onboarding/get-onboarding-checklist";

export const ONBOARDING_CHECKLIST_QUERY_KEY = [
  "onboarding",
  "checklist",
] as const;

function useOnboardingChecklist() {
  return useQuery({
    queryKey: ONBOARDING_CHECKLIST_QUERY_KEY,
    queryFn: getOnboardingChecklist,
  });
}

export default useOnboardingChecklist;
