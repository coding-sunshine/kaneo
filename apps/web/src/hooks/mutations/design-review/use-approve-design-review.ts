import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import approveDesignReview from "@/fetchers/design-review/approve-design-review";
import { toast } from "@/lib/toast";
import { useInvalidateDesignReviews } from "./use-invalidate-design-reviews";

export default function useApproveDesignReview() {
  const { t } = useTranslation();
  const invalidate = useInvalidateDesignReviews();
  return useMutation({
    mutationFn: approveDesignReview,
    onSuccess: (_data, variables) => invalidate(variables.taskId),
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:designReview.approveError"),
      ),
  });
}
