import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

// Linear only flags High (3) and Very high (4); lower scores stay off the row.
export function ReviewRowRisk({ level }: { level?: number | null }) {
  const { t } = useTranslation();
  if (!level || level < 3) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-xs",
        level === 4 ? "text-due-overdue" : "text-orange-500",
      )}
    >
      <ShieldAlert aria-hidden className="size-3.5" />
      {t(
        level === 4
          ? "workspace:reviews.chips.riskVeryHigh"
          : "workspace:reviews.chips.riskHigh",
      )}
    </span>
  );
}
