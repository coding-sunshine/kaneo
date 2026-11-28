import { useTranslation } from "react-i18next";
import { getPriorityLabel } from "@/lib/i18n/domain";
import type { UpNextReason as Reason } from "./order-up-next";

/** Why a task sits where it does in Up next; blocked work gets a chip. */
export function UpNextReason({ reason }: { reason: Reason }) {
  const { t } = useTranslation();

  if (reason.kind === "blocked") {
    const named = reason.blockers.filter((key) => key !== null);
    const hidden = reason.blockers.length - named.length;
    const issues = [
      ...named,
      ...(hidden
        ? [t("workspace:home.upNext.reasons.hiddenBlockers", { count: hidden })]
        : []),
    ].join(", ");
    return (
      <span
        data-up-next-reason="blocked"
        className="max-w-44 shrink-0 truncate rounded-full border border-border px-2 py-0.5 text-muted-foreground text-xs"
      >
        {t("workspace:home.upNext.reasons.blocked", { issues })}
      </span>
    );
  }

  return (
    <span
      data-up-next-reason={reason.kind}
      className="w-32 shrink-0 truncate text-muted-foreground text-xs"
    >
      {reason.kind === "priority"
        ? t("workspace:home.upNext.reasons.priority", {
            priority: getPriorityLabel(reason.priority),
          })
        : t(`workspace:home.upNext.reasons.${reason.kind}`)}
    </span>
  );
}
