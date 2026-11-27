import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useUnshareDocumentFromHiddenTasks } from "@/hooks/mutations/document/use-document-mutations";
import { toast } from "@/lib/toast";

type DocumentHiddenTaskSharesProps = {
  workspaceId: string;
  id: string;
  count: number;
};

/** Shares on issues the editor cannot open: a count and a way to stop them. */
export function DocumentHiddenTaskShares({
  workspaceId,
  id,
  count,
}: DocumentHiddenTaskSharesProps) {
  const { t } = useTranslation();
  const stop = useUnshareDocumentFromHiddenTasks(workspaceId, id);

  return (
    <div className="flex min-h-9 items-center justify-between gap-2 px-3 text-[13px]">
      <span className="text-muted-foreground">
        {t("navigation:documents.share.hiddenTasks", { count })}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={stop.isPending}
        onClick={() =>
          stop.mutate(undefined, {
            onSuccess: () =>
              toast.success(
                t("navigation:documents.share.hiddenTasksUnshared"),
              ),
            onError: () =>
              toast.error(
                t("navigation:documents.share.unshareHiddenTasksFailed"),
              ),
          })
        }
      >
        {t("navigation:documents.share.stopHiddenTasks")}
      </Button>
    </div>
  );
}
