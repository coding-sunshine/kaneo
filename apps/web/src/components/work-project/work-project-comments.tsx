import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateWorkProjectComment } from "@/hooks/mutations/work-project/use-work-project-comment-mutations";
import { useWorkProjectComments } from "@/hooks/queries/work-project/use-work-project-comments";
import { toast } from "@/lib/toast";
import { WorkProjectCommentItem } from "./work-project-comment-item";

type Props = { workProjectId: string; editable: boolean };

export function WorkProjectComments({ workProjectId, editable }: Props) {
  const { t } = useTranslation();
  const { data: comments } = useWorkProjectComments(workProjectId);
  const { mutateAsync: post, isPending } =
    useCreateWorkProjectComment(workProjectId);
  const [content, setContent] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await post(content.trim());
      setContent("");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("workspace:workProject.comments.error"),
      );
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="font-medium text-sm">
        {t("workspace:workProject.comments.title")}
      </h2>
      <ul className="space-y-3">
        {comments?.map((comment) => (
          <WorkProjectCommentItem key={comment.id} comment={comment} />
        ))}
      </ul>
      {comments?.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {t("workspace:workProject.comments.empty")}
        </p>
      )}
      {editable && (
        <form onSubmit={submit} className="space-y-2 rounded-lg border p-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("workspace:workProject.comments.placeholder")}
            aria-label={t("workspace:workProject.comments.placeholder")}
          />
          <Button
            type="submit"
            size="sm"
            disabled={isPending || !content.trim()}
          >
            {t("workspace:workProject.comments.post")}
          </Button>
        </form>
      )}
    </section>
  );
}
