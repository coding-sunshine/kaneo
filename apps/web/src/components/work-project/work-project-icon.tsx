import icons from "@/constants/project-icons";
import { cn } from "@/lib/cn";
import { resolveLabelColor } from "@/lib/label-color";
import { DEFAULT_WORK_PROJECT_COLOR } from "@/lib/work-project/status";

type WorkProjectIconProps = {
  icon?: string | null;
  color?: string | null;
  className?: string;
};

/** Linear paints a project's icon in the project colour. */
export function WorkProjectIcon({
  icon,
  color,
  className,
}: WorkProjectIconProps) {
  const Icon = icons[icon as keyof typeof icons] || icons.Box;
  return (
    <Icon
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", className)}
      style={{ color: resolveLabelColor(color || DEFAULT_WORK_PROJECT_COLOR) }}
    />
  );
}
