import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import requestDesignReview from "@/fetchers/design-review/request-design-review";
import { toast } from "@/lib/toast";
import { useInvalidateDesignReviews } from "./use-invalidate-design-reviews";

export default function useRequestDesignReview() {
  const { t } = useTranslation();
  const invalidate = useInvalidateDesignReviews();
  return useMutation({
    mutationFn: requestDesignReview,
    onSuccess: (_data, variables) => invalidate(variables.taskId),
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:designReview.requestError"),
      ),
  });
}
