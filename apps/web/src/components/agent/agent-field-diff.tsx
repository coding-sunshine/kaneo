import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { proposalFieldKey } from "@/components/agent/proposal-field-key";

type FieldChange = { field: string; from: string | null; to: string | null };

/** A proposed write, field by field: the value now, then the value after. */
export function AgentFieldDiff({ diff }: { diff: FieldChange[] }) {
  const { t } = useTranslation();
  const value = (text: string | null, className: string) =>
    text === null ? (
      <span className="text-muted-foreground italic">
        {t("navigation:agent.proposal.empty")}
      </span>
    ) : (
      <span className={`whitespace-pre-wrap break-words ${className}`}>
        {text}
      </span>
    );
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
      {diff.map((change) => {
        const key = proposalFieldKey(change.field);
        return (
          <div key={change.field} className="contents">
            <dt className="text-muted-foreground">
              {key ? t(key) : change.field}
            </dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
              {value(change.from, "text-muted-foreground line-through")}
              <ArrowRight
                className="size-3 shrink-0 text-muted-foreground"
                aria-label={t("navigation:agent.proposal.changesTo")}
              />
              {value(change.to, "font-medium")}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
