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
import type { ThreadProposalKind } from "@/fetchers/agent/thread-proposal";
import { useThreadProposal } from "@/hooks/mutations/agent/use-thread-proposal";

const COPY = {
  ticket: {
    title: "navigation:chat.aiTicket.title",
    description: "navigation:chat.aiTicket.description",
  },
  decision: {
    title: "navigation:chat.aiDecision.title",
    description: "navigation:chat.aiDecision.description",
  },
} as const;

type Props = {
  kind: ThreadProposalKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  channelId: string;
  messageId: string;
};

/**
 * Drafts a ticket or a decision from the message's thread when opened and
 * shows it as a card. Accept creates the ticket, or files the decision on its
 * topic; Decline saves nothing.
 */
export function ThreadProposalDialog({
  kind,
  open,
  onOpenChange,
  workspaceId,
  channelId,
  messageId,
}: Props) {
  const { t } = useTranslation();
  const draft = useThreadProposal(workspaceId, channelId, kind);
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
          <DialogTitle>{t(COPY[kind].title)}</DialogTitle>
          <DialogDescription>{t(COPY[kind].description)}</DialogDescription>
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
              {t("navigation:chat.aiThreadLoading")}
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
