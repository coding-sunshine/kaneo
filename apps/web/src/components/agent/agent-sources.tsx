import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentCitation } from "@/components/agent/agent-citation";
import { AgentSourceChip } from "@/components/agent/agent-source-chip";

/** The sources under an answer, or a label saying it has none. */
export function AgentSources({
  workspaceId,
  citations,
  unsourced,
}: {
  workspaceId: string;
  citations: AgentCitation[];
  unsourced: boolean;
}) {
  const { t } = useTranslation();
  if (unsourced) {
    return (
      <p
        className="inline-flex items-center gap-1 text-muted-foreground text-xs"
        title={t("navigation:agent.sources.unsourcedHint")}
      >
        <CircleHelp className="size-3" aria-hidden="true" />
        {t("navigation:agent.sources.unsourced")}
      </p>
    );
  }
  return (
    <ul
      aria-label={t("navigation:agent.sources.label")}
      className="flex max-w-[85%] flex-wrap gap-1.5"
    >
      {citations.map((citation, index) => (
        <li
          key={
            citation.restricted
              ? `restricted-${index}`
              : `${citation.kind}-${citation.id}`
          }
        >
          <AgentSourceChip workspaceId={workspaceId} citation={citation} />
        </li>
      ))}
    </ul>
  );
}
