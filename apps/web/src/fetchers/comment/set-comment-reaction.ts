import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type SetCommentReactionRequest = {
  activityId: string;
  emoji: string;
  reacted: boolean;
};

async function setCommentReaction({
  activityId,
  emoji,
  reacted,
}: SetCommentReactionRequest) {
  const json = { activityId, emoji };
  const response = reacted
    ? await client.activity.comment.reaction.$post({ json })
    : await client.activity.comment.reaction.$delete({ json });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default setCommentReaction;
