import { Bell, BellOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { Topic } from "@/fetchers/topic/topics";
import { useFollowTopic } from "@/hooks/mutations/topic/use-topic-mutations";
import { toast } from "@/lib/toast";

/** Follow a topic to hear about its proposals and its next current document. */
export function TopicFollowButton({ topic }: { topic: Topic }) {
  const { t } = useTranslation();
  const follow = useFollowTopic(topic.workspaceId);
  return (
    <Button
      size="xs"
      variant="outline"
      className="shrink-0"
      title={t("navigation:documents.topics.followHint")}
      disabled={follow.isPending}
      onClick={() =>
        follow.mutate(
          { id: topic.id, follow: !topic.following },
          { onError: (error) => toast.error(error.message) },
        )
      }
    >
      {topic.following ? <BellOff aria-hidden /> : <Bell aria-hidden />}
      {topic.following
        ? t("navigation:documents.topics.unfollow")
        : t("navigation:documents.topics.follow")}
    </Button>
  );
}
