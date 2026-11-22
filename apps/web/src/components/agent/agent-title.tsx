import { ChevronDown } from "lucide-react";
import { AgentHistory } from "@/components/agent/agent-history";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";

/** Header title that doubles as the chat history menu. */
export function AgentTitle({
  workspaceId,
  title,
}: {
  workspaceId: string;
  title: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-1 text-xs hover:text-foreground"
          />
        }
      >
        {title}
        <ChevronDown className="size-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverPopup align="start" className="w-72 p-0">
        <AgentHistory workspaceId={workspaceId} />
      </PopoverPopup>
    </Popover>
  );
}
