import { ArrowUp, Paperclip } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/get-initials";
import CommentInput from "./comment-input";

type ReplyComposerProps = {
  taskId: string;
  parentId: string;
};

// Every open thread ends in a one-line "Leave a reply..." row, as in Linear.
// The editor mounts only once someone starts a reply.
export default function ReplyComposer({
  taskId,
  parentId,
}: ReplyComposerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user?.id) return null;

  if (open) {
    return (
      <div className="border-border/80 border-t">
        <CommentInput
          taskId={taskId}
          parentId={parentId}
          autoFocus
          onCancel={() => setOpen(false)}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex w-full items-center gap-2 border-border/80 border-t px-3 py-2.5 text-left text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground/80 focus-visible:bg-accent/50"
    >
      <Avatar className="size-5">
        <AvatarImage src={user.image ?? ""} alt="" />
        <AvatarFallback className="bg-muted font-semibold text-[9px]">
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      <span className="flex-1">{t("activity:comment.leaveReply")}</span>
      <Paperclip aria-hidden className="size-3.5" />
      <ArrowUp aria-hidden className="size-3.5" />
    </button>
  );
}
