import { useQuery } from "@tanstack/react-query";
import getDuplicateSuggestions from "@/fetchers/duplicate-suggestion/get-duplicate-suggestions";

function useDuplicateSuggestions(taskId: string, enabled = true) {
  return useQuery({
    queryKey: ["duplicate-suggestions", taskId],
    queryFn: () => getDuplicateSuggestions(taskId),
    enabled: enabled && Boolean(taskId),
  });
}

export default useDuplicateSuggestions;
