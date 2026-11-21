import { useTranslation } from "react-i18next";
import type { WorkProject } from "@/fetchers/work-project/types";

const DOT: Record<NonNullable<WorkProject["health"]>, string> = {
  onTrack: "#4cb782",
  atRisk: "#f2c94c",
  offTrack: "#eb5757",
};

export function WorkProjectHealth({
  health,
}: {
  health: WorkProject["health"];
}) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
      <span
        aria-hidden="true"
        className="size-3.5 shrink-0 rounded-full border border-dashed border-muted-foreground/50"
        style={health ? { background: DOT[health], border: "none" } : undefined}
      />
      {health
        ? t(`workspace:workProject.health.${health}`)
        : t("workspace:workProject.noUpdates")}
    </span>
  );
}
