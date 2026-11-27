import { useQuery } from "@tanstack/react-query";
import {
  getReferences,
  type ReferenceTarget,
} from "@/fetchers/reference/get-references";

export function useReferences(target: ReferenceTarget) {
  return useQuery({
    queryKey: ["references", target],
    queryFn: () => getReferences(target),
    // Any ticket or document can start naming the target, so read it again
    // each time the target is opened.
    refetchOnMount: true,
  });
}
