import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { parseFilter } from "@/fetchers/agent/parse-filter";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";
import type { BoardFilters } from "@/hooks/use-task-filters";
import { applyParsedFilter } from "@/lib/task-filters/apply-parsed-filter";
import { toast } from "@/lib/toast";

/**
 * Reads a sentence as a filter on the team's board. A filter replaces the
 * current one; a question comes back as a toast and nothing changes. Without
 * AI on the server there is nothing to ask.
 */
export function useNaturalFilter(
  workspaceId: string,
  projectId: string,
  setFilters: (filters: BoardFilters) => void,
) {
  const { t } = useTranslation();
  const hasAgent = useHasAgent();
  const parse = useMutation({
    mutationFn: (text: string) => parseFilter(workspaceId, projectId, text),
  });
  if (!hasAgent || !workspaceId || !projectId) return undefined;
  return (text: string) => {
    const pending = toast.loading(t("tasks:filterMenu.askAiWorking"));
    parse.mutate(text, {
      onSuccess: (result) => {
        if (result.filters) {
          setFilters(applyParsedFilter(result.filters));
          toast.success(t("tasks:filterMenu.askAiApplied"));
        } else if (result.question) {
          toast.info(result.question);
        }
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => toast.dismiss(pending),
    });
  };
}
