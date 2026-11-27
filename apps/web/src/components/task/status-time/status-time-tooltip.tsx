import type { ComponentProps, ReactElement } from "react";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusTimeList } from "./status-time-list";

type StatusTimeTooltipProps = Omit<
  ComponentProps<typeof TooltipTrigger>,
  "children" | "render"
> & {
  taskId: string;
  children: ReactElement;
};

/** Shows time per status on hover. Extra props come from a wrapping trigger, such as the status popover's. */
export function StatusTimeTooltip({
  taskId,
  children,
  ...props
}: StatusTimeTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger {...props} render={children} />
      <TooltipPopup side="bottom" align="start" className="min-w-48">
        <StatusTimeList taskId={taskId} />
      </TooltipPopup>
    </Tooltip>
  );
}
