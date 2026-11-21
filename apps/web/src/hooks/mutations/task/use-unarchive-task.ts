import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { unarchiveTask } from "@/fetchers/task/task-archive";
import { toast } from "@/lib/toast";

/** Restore an archived task, then refresh every view that lists tasks. */
export default function useUnarchiveTask() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unarchiveTask,
    onSuccess: () => queryClient.invalidateQueries(),
    onError: () => toast.error(t("tasks:detail.archived.restoreFailed")),
  });
}
