import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import refreshFigmaPreview from "@/fetchers/figma/refresh-figma-preview";
import { figmaPreviewKey } from "@/hooks/queries/figma/use-figma-preview";
import { toast } from "@/lib/toast";

export default function useRefreshFigmaPreview() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: refreshFigmaPreview,
    onSuccess: (preview, { workspaceId, url }) =>
      queryClient.setQueryData(figmaPreviewKey(workspaceId, url), preview),
    onError: () => toast.error(t("tasks:figma.refreshError")),
  });
}
