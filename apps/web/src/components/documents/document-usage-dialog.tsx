import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentUsage } from "@/hooks/queries/document/use-documents";
import { formatDateShort } from "@/lib/format";

type DocumentUsageDialogProps = { workspaceId: string; onClose: () => void };

/** Four weeks of counts, newest first. Numbers only: no title, topic or person. */
export function DocumentUsageDialog({
  workspaceId,
  onClose,
}: DocumentUsageDialogProps) {
  const { t } = useTranslation();
  const { data, isError } = useDocumentUsage(workspaceId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("navigation:documents.usage.title")}</DialogTitle>
          <DialogDescription>
            {t("navigation:documents.usage.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          {isError ? (
            <p role="alert" className="text-destructive-foreground text-sm">
              {t("navigation:documents.usage.failed")}
            </p>
          ) : !data ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <>
              <p className="text-sm">
                {t("navigation:documents.usage.topics", {
                  count: data.topicsWithCurrent,
                })}
              </p>
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-muted-foreground text-xs">
                    <th scope="col" className="py-1 text-left font-normal">
                      {t("navigation:documents.usage.week")}
                    </th>
                    <th scope="col" className="py-1 text-right font-normal">
                      {t("navigation:documents.usage.added")}
                    </th>
                    <th scope="col" className="py-1 text-right font-normal">
                      {t("navigation:documents.usage.filed")}
                    </th>
                    <th scope="col" className="py-1 text-right font-normal">
                      {t("navigation:documents.usage.chatSaves")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.weeks.map((week, index) => (
                    <tr key={week.from} className="border-border/50 border-t">
                      <th scope="row" className="py-1.5 text-left font-normal">
                        {index === 0
                          ? t("navigation:documents.usage.thisWeek")
                          : t("navigation:documents.usage.range", {
                              from: formatDateShort(week.from),
                              to: formatDateShort(week.to),
                            })}
                      </th>
                      <td className="py-1.5 text-right">{week.added}</td>
                      <td className="py-1.5 text-right">{week.filed}</td>
                      <td className="py-1.5 text-right">{week.chatSaves}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
