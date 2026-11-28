import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { proposalFieldKey } from "@/components/agent/proposal-field-key";
import { Checkbox } from "@/components/ui/checkbox";

type FieldChange = {
  field: string;
  from: string | null;
  to: string | null;
  reason?: string;
};

/**
 * A proposed write, field by field: the value now, then the value after, and
 * the field's own reason when it has one. With `kept`, each field has a box
 * the person unticks to leave it out.
 */
export function AgentFieldDiff({
  diff,
  kept,
  onToggle,
}: {
  diff: FieldChange[];
  kept?: ReadonlySet<string>;
  onToggle?: (field: string, keep: boolean) => void;
}) {
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
        const name = key ? t(key) : change.field;
        return (
          <div key={change.field} className="contents">
            <dt className="flex items-start gap-1.5 text-muted-foreground">
              {kept && onToggle ? (
                <Checkbox
                  checked={kept.has(change.field)}
                  onCheckedChange={(checked) =>
                    onToggle(change.field, checked === true)
                  }
                  aria-label={t("navigation:agent.proposal.keepField", {
                    field: name,
                  })}
                />
              ) : null}
              {name}
            </dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
              {value(change.from, "text-muted-foreground line-through")}
              <ArrowRight
                className="size-3 shrink-0 text-muted-foreground"
                aria-label={t("navigation:agent.proposal.changesTo")}
              />
              {value(change.to, "font-medium")}
              {change.reason ? (
                <span className="basis-full text-muted-foreground">
                  {change.reason}
                </span>
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
