import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import replyToTicketByEmail from "@/fetchers/email-intake/reply-to-ticket-by-email";
import { useTicketEmailThread } from "@/hooks/queries/email-intake/use-ticket-email-thread";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

/** For a ticket that came in by email: who sent it, and a reply that goes back by email. */
export function TaskEmailReply({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { canUpdateTasks } = useWorkspacePermission();
  const { data: thread } = useTicketEmailThread(taskId);
  const [content, setContent] = useState("");
  const send = useMutation({
    mutationFn: () => replyToTicketByEmail(taskId, content.trim()),
    onSuccess: async () => {
      setContent("");
      toast.success(t("tasks:detail.emailReply.sent"));
      await queryClient.invalidateQueries({ queryKey: ["activities", taskId] });
    },
    onError: (error) =>
      toast.error(t("tasks:detail.emailReply.failed"), {
        description: error.message,
      }),
  });

  if (!thread) return null;
  const requester = thread.name
    ? `${thread.name} <${thread.address}>`
    : thread.address;

  return (
    <section
      aria-label={t("tasks:detail.emailReply.title")}
      className="flex flex-col gap-2"
    >
      <h2 className="flex items-center gap-1.5 font-medium text-[15px] text-foreground">
        <Mail aria-hidden className="size-4 text-muted-foreground" />
        {t("tasks:detail.emailReply.title")}
      </h2>
      <p className="text-muted-foreground text-sm">
        {t("tasks:detail.emailReply.from", { requester })}
      </p>
      {canUpdateTasks() && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (content.trim()) send.mutate();
          }}
        >
          <Textarea
            aria-label={t("tasks:detail.emailReply.label", {
              address: thread.address,
            })}
            placeholder={t("tasks:detail.emailReply.placeholder")}
            value={content}
            maxLength={10_000}
            onChange={(event) => setContent(event.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            className="self-end"
            disabled={send.isPending || !content.trim()}
          >
            {t("tasks:detail.emailReply.send")}
          </Button>
        </form>
      )}
    </section>
  );
}
