import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";

export default function useWorkspaceWebhookMutation<T, R>(
  mutationFn: (input: T) => Promise<R>,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn,
    gcTime: 0,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["workspace-webhooks"] }),
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceWebhooks.saveError"),
      ),
  });
}
