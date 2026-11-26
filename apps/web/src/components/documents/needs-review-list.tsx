import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useNeedsReview } from "@/hooks/queries/topic/use-facts";
import { NeedsReviewRow } from "./needs-review-row";

/** Work that rests on a value its topic has since replaced. */
export function NeedsReviewList({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data, error, isPending } = useNeedsReview(workspaceId);
  if (isPending) return <Skeleton className="mx-4 my-3 h-16" />;
  if (error)
    return (
      <p className="px-4 py-3 text-muted-foreground text-sm">{error.message}</p>
    );
  if (data.length === 0)
    return (
      <p className="px-4 py-3 text-muted-foreground text-sm">
        {t("navigation:documents.facts.needsReview.empty")}
      </p>
    );
  return (
    <>
      <p className="px-4 py-2 text-muted-foreground text-xs">
        {t("navigation:documents.facts.needsReview.hint")}
      </p>
      <ul className="flex flex-col">
        {data.map((item) => (
          <NeedsReviewRow key={item.id} workspaceId={workspaceId} item={item} />
        ))}
      </ul>
    </>
  );
}
