import { Bell, BellOff, Link2, ListChecks, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { HeaderIconButton } from "@/components/task/header/header-icon-button";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { useSetDocumentSubscribers } from "@/hooks/mutations/document/use-document-mutations";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { DocumentKindMenu } from "./document-kind-menu";
import { DocumentSharePopover } from "./document-share-popover";
import { MeetingNotesDialog } from "./meeting-notes/meeting-notes-dialog";
import { useCopyDocumentLink } from "./use-copy-document-link";

type DocumentHeaderActionsProps = {
  document: DocumentDetail;
  commentsOpen: boolean;
  onToggleComments: () => void;
  factsOpen: boolean;
  onToggleFacts: () => void;
  shareOpen: boolean;
  onShareOpenChange: (open: boolean) => void;
};

/** Kind, then share, facts, comments, copy link and subscribe as in Linear. */
export function DocumentHeaderActions({
  document,
  commentsOpen,
  onToggleComments,
  factsOpen,
  onToggleFacts,
  shareOpen,
  onShareOpenChange,
}: DocumentHeaderActionsProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { workspaceId, id, subscriberIds } = document;
  const copyLink = useCopyDocumentLink(workspaceId, id);
  const setSubscribers = useSetDocumentSubscribers(workspaceId, id);
  const subscribed = Boolean(user?.id && subscriberIds.includes(user.id));

  const toggleSubscription = () => {
    if (!user?.id) return;
    const next = subscribed
      ? subscriberIds.filter((userId) => userId !== user.id)
      : [...subscriberIds, user.id];
    setSubscribers.mutate(next, {
      onSuccess: () =>
        toast.success(
          subscribed
            ? t("navigation:documents.unsubscribed")
            : t("navigation:documents.subscribed"),
        ),
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <div className="flex items-center gap-0.5">
      {/* A phone has no room for it here; the editor shows it under the title. */}
      <span className="hidden sm:contents">
        <DocumentKindMenu document={document} />
      </span>
      <DocumentSharePopover
        document={document}
        open={shareOpen}
        onOpenChange={onShareOpenChange}
      />
      {/* Every document can rely on facts; a filed one also states them. */}
      <HeaderIconButton
        label={
          factsOpen
            ? t("navigation:documents.facts.close")
            : t("navigation:documents.facts.show")
        }
        onClick={onToggleFacts}
        className={cn(factsOpen && "bg-accent text-foreground")}
      >
        <ListChecks aria-hidden />
      </HeaderIconButton>
      <MeetingNotesDialog workspaceId={workspaceId} documentId={id} />
      <HeaderIconButton
        label={
          commentsOpen
            ? t("navigation:documents.closeComments")
            : t("navigation:documents.showComments")
        }
        onClick={onToggleComments}
        className={cn(commentsOpen && "bg-accent text-foreground")}
      >
        <MessageSquare aria-hidden />
      </HeaderIconButton>
      <HeaderIconButton
        label={t("navigation:documents.copyLink")}
        onClick={copyLink}
      >
        <Link2 aria-hidden />
      </HeaderIconButton>
      <HeaderIconButton
        label={
          subscribed
            ? t("navigation:documents.unsubscribe")
            : t("navigation:documents.subscribe")
        }
        onClick={toggleSubscription}
      >
        {subscribed ? <BellOff aria-hidden /> : <Bell aria-hidden />}
      </HeaderIconButton>
    </div>
  );
}
