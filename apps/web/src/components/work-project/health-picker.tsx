import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { WORK_PROJECT_HEALTHS } from "@/lib/work-project/status";
import { WorkProjectHealth } from "./work-project-health";

export type Health = (typeof WORK_PROJECT_HEALTHS)[number];

type Props = { value: Health; onChange: (health: Health) => void };

export function HealthPicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div
      role="radiogroup"
      aria-label={t("workspace:workProject.fields.health")}
      className="flex gap-1"
    >
      {WORK_PROJECT_HEALTHS.map((health) => (
        <button
          key={health}
          type="button"
          role="radio"
          aria-checked={value === health}
          onClick={() => onChange(health)}
          className={cn(
            "rounded-md px-2 py-1 hover:bg-accent",
            value === health && "bg-accent",
          )}
        >
          <WorkProjectHealth health={health} />
        </button>
      ))}
    </div>
  );
}
