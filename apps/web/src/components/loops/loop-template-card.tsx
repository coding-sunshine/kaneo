import { ArrowRight, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LoopTemplate } from "@/components/loops/loop-templates";

/** A template: opens the loop form prefilled with its instructions. */
export function LoopTemplateCard({
  template,
  onPick,
}: {
  template: LoopTemplate;
  onPick: (template: LoopTemplate) => void;
}) {
  const { t } = useTranslation();
  const base = `navigation:loops.templates.${template.id}`;
  return (
    <button
      type="button"
      onClick={() => onPick(template)}
      className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-card p-3 text-left hover:bg-accent/40"
    >
      <template.icon
        className={`mb-1.5 size-3.5 ${template.iconClass}`}
        aria-hidden="true"
      />
      <span className="text-[13px]">{t(`${base}.title`)}</span>
      <span className="line-clamp-2 text-muted-foreground text-xs">
        {t(`${base}.description`)}
      </span>
      <span className="mt-1 flex items-center gap-1.5 text-muted-foreground text-xs">
        <Clock className="size-3" aria-hidden="true" />
        {t(`navigation:loops.frequency.${template.frequency}`)}
        <ArrowRight className="size-3" aria-hidden="true" />
        {t(`${base}.action`)}
      </span>
    </button>
  );
}
