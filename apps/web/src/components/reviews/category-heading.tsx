import { useTranslation } from "react-i18next";
import type { Category } from "@/components/reviews/file-categories";

/** A section title for a file category, used in the file list and the diff column. */
export function CategoryHeading({ category }: { category: Category }) {
  const { t } = useTranslation();
  return (
    <h4 className="px-2 pt-2 font-medium text-muted-foreground text-xs">
      {t(`workspace:reviews.diffOptions2.category.${category}`)}
    </h4>
  );
}
