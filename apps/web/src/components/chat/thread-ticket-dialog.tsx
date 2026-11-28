import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AgentProposalCard } from "@/components/agent/agent-proposal-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AgentProposal } from "@/fetchers/agent/proposals";
import { useThreadTicket } from "@/hooks/mutations/agent/use-thread-ticket";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  channelId: string;
  messageId: string;
};

/**
 * Drafts a ticket from the message's thread when opened and shows it as a
 * card: Accept creates the ticket and links it in the thread; Decline
 * creates nothing.
 */
export function ThreadTicketDialog({
  open,
  onOpenChange,
  workspaceId,
  channelId,
  messageId,
}: Props) {
  const { t } = useTranslation();
  const draft = useThreadTicket(workspaceId, channelId);
  const [proposal, setProposal] = useState<AgentProposal | null>(null);
  const { mutate, reset } = draft;

  useEffect(() => {
    if (!open) return;
    setProposal(null);
    reset();
    mutate(messageId, { onSuccess: setProposal });
  }, [open, messageId, mutate, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("navigation:chat.aiTicket.title")}</DialogTitle>
          <DialogDescription>
            {t("navigation:chat.aiTicket.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {proposal ? (
            <AgentProposalCard
              workspaceId={workspaceId}
              proposal={proposal}
              onDecided={setProposal}
            />
          ) : draft.isError ? (
            <p role="alert" className="text-destructive text-sm">
              {draft.error.message}
            </p>
          ) : (
            <p
              role="status"
              className="flex items-center gap-2 text-muted-foreground text-sm"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t("navigation:chat.aiTicket.loading")}
            </p>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common:actions.close")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
