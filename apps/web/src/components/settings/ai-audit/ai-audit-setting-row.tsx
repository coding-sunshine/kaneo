import { useTranslation } from "react-i18next";
import { AgentFieldDiff } from "@/components/agent/agent-field-diff";
import type { AiAuditRow as Row } from "@/fetchers/agent/proposals";

/** An admin's change of the AI data destination: who changed it, from what to what. */
export function AiAuditSettingRow({ row }: { row: Row }) {
  const { t, i18n } = useTranslation();
  const when = row.decidedAt
    ? new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(row.decidedAt))
    : "";
  return (
    <div
      role="listitem"
      className="flex flex-col gap-2 border-border/70 border-b px-4 py-3 text-sm last:border-b-0"
    >
      <p className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">
          {t("settings:aiAudit.destinationChangedBy", {
            name: row.acceptedBy?.name ?? t("settings:aiAudit.unknownUser"),
          })}
        </span>
        <span className="text-muted-foreground text-xs">{when}</span>
      </p>
      <div className="text-xs">
        <AgentFieldDiff diff={row.diff} />
      </div>
    </div>
  );
}
