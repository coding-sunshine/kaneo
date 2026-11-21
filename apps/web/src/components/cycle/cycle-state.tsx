import { useTranslation } from "react-i18next";
import type { CycleState } from "@/lib/cycle/cycle-label";

/** Small ring showing completion, like Linear's cycle progress ring. */
export function ProgressRing({ value }: { value: number }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0 -rotate-90" aria-hidden>
      <circle
        cx="8"
        cy="8"
        r={r}
        fill="none"
        strokeWidth="2"
        className="stroke-border"
      />
      <circle
        cx="8"
        cy="8"
        r={r}
        fill="none"
        strokeWidth="2"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
        className="stroke-primary"
      />
    </svg>
  );
}

export function useStateLabels(): Record<CycleState | "planned", string> {
  const { t } = useTranslation();
  return {
    current: t("workspace:cycles.state.current"),
    upcoming: t("workspace:cycles.state.upcoming"),
    previous: t("workspace:cycles.state.completed"),
    planned: t("workspace:cycles.state.planned"),
  };
}
