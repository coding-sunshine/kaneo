import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAddMessageToTicket } from "@/hooks/mutations/chat/use-add-message-to-ticket";
import useGlobalSearch from "@/hooks/queries/search/use-global-search";
import { toast } from "@/lib/toast";

/** Search for a ticket; picking one copies the message onto it as a comment. */
export function AddToTicketDialog({
  open,
  onOpenChange,
  workspaceId,
  channelId,
  messageId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  channelId: string;
  messageId: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const add = useAddMessageToTicket(workspaceId, channelId);
  const search = useGlobalSearch({
    q: query.trim(),
    type: "tasks",
    workspaceId,
    limit: 8,
  });
  const tasks = (search.data?.results ?? []).filter(
    (result) => result.type === "task" && !result.archivedAt,
  );
  const pick = (taskId: string) =>
    add.mutate(
      { messageId, taskId },
      {
        onSuccess: () => {
          toast.success(t("navigation:chat.addedToTicket"));
          onOpenChange(false);
        },
        onError: (error: Error) => toast.error(error.message),
      },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("navigation:chat.addToTicketTitle")}</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <Input
            size="sm"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("navigation:chat.searchTickets")}
            aria-label={t("navigation:chat.searchTickets")}
          />
          <ul className="mt-1 flex flex-col">
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-60"
                  disabled={add.isPending}
                  onClick={() => pick(task.id)}
                >
                  <span className="truncate">{task.title}</span>
                </button>
              </li>
            ))}
          </ul>
          {query.trim() !== "" && !search.isFetching && tasks.length === 0 && (
            <p className="px-2 py-1.5 text-muted-foreground text-sm">
              {t("navigation:chat.noTicketsFound")}
            </p>
          )}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
