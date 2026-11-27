import { useTranslation } from "react-i18next";
import { AgentFieldDiff } from "@/components/agent/agent-field-diff";
import { AgentSourceChip } from "@/components/agent/agent-source-chip";
import type { AiAuditRow as Row } from "@/fetchers/agent/proposals";

/** One accepted agent write: who asked what, the tool calls, sources, who accepted, and the result. */
export function AiAuditRow({
  workspaceId,
  row,
}: {
  workspaceId: string;
  row: Row;
}) {
  const { t, i18n } = useTranslation();
  const when = row.decidedAt
    ? new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(row.decidedAt))
    : "";
  const label = (key: string) => (
    <dt className="text-muted-foreground">{t(key)}</dt>
  );
  return (
    <div
      role="listitem"
      className="flex flex-col gap-2 border-border/70 border-b px-4 py-3 text-sm last:border-b-0"
    >
      <p className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">
          {t("settings:aiAudit.acceptedBy", {
            name: row.acceptedBy?.name ?? t("settings:aiAudit.unknownUser"),
          })}
        </span>
        <span className="text-muted-foreground text-xs">
          {row.status === "failed" ? `${t("settings:aiAudit.failed")} · ` : ""}
          {when}
        </span>
      </p>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-xs">
        {label("settings:aiAudit.prompt")}
        <dd className="whitespace-pre-wrap break-words">
          {row.prompt}
          {row.requestedBy ? (
            <span className="text-muted-foreground">
              {" "}
              {t("settings:aiAudit.askedBy", { name: row.requestedBy.name })}
            </span>
          ) : null}
        </dd>
        {label("settings:aiAudit.change")}
        <dd>
          <AgentFieldDiff diff={row.diff} />
          <p className="mt-1 text-muted-foreground">{row.reason}</p>
        </dd>
        {label("settings:aiAudit.toolCalls")}
        <dd>
          <ol className="flex flex-col gap-0.5 font-mono">
            {row.toolCalls.map((call) => (
              <li key={call.id} className="break-all">
                {call.name}({call.arguments})
              </li>
            ))}
          </ol>
        </dd>
        {label("settings:aiAudit.sources")}
        <dd>
          <ul className="flex flex-wrap gap-1.5">
            {row.sources.map((citation, index) => (
              <li
                key={
                  citation.restricted
                    ? `restricted-${index}`
                    : `${citation.kind}-${citation.id}`
                }
              >
                <AgentSourceChip
                  workspaceId={workspaceId}
                  citation={citation}
                />
              </li>
            ))}
          </ul>
        </dd>
        {label("settings:aiAudit.result")}
        <dd>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono">
            {row.result}
          </pre>
        </dd>
      </dl>
    </div>
  );
}
