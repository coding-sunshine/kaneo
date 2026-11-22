import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PopoverClose } from "@/components/ui/popover";
import { useDeleteChat } from "@/hooks/mutations/agent/use-agent-mutations";
import { useAgentChats } from "@/hooks/queries/agent/use-agent";
import { groupChatsByRecency } from "@/lib/group-chats";

/** Past chats grouped by recency; picking one reopens it on the Agent page. */
export function AgentHistory({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: chats = [] } = useAgentChats(workspaceId);
  const remove = useDeleteChat(workspaceId);

  if (chats.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-muted-foreground text-xs">
        {t("navigation:agent.historyEmpty")}
      </p>
    );
  }

  return (
    <div className="max-h-80 overflow-auto py-1">
      {groupChatsByRecency(chats).map((group) => (
        <section
          key={group.key}
          aria-label={t(`navigation:agent.group.${group.key}`)}
        >
          <h3 className="px-3 pt-2 pb-1 text-muted-foreground text-xs">
            {t(`navigation:agent.group.${group.key}`)}
          </h3>
          <ul>
            {group.chats.map((chat) => (
              <li key={chat.id} className="group/chat flex items-center">
                <PopoverClose
                  render={
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate px-3 py-1.5 text-left text-[13px] hover:bg-accent"
                      onClick={() =>
                        navigate({
                          to: "/dashboard/workspace/$workspaceId/agent",
                          params: { workspaceId },
                          search: { chat: chat.id },
                        })
                      }
                    />
                  }
                >
                  {chat.title}
                </PopoverClose>
                <button
                  type="button"
                  aria-label={t("navigation:agent.deleteChat")}
                  className="mr-2 hidden rounded p-1 text-muted-foreground hover:bg-accent group-hover/chat:block focus-visible:block"
                  onClick={() => remove.mutate(chat.id)}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
