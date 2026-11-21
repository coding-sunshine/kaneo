import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

type SetCommentThreadSubscribedRequest = {
  activityId: string;
  subscribed: boolean;
};

async function setCommentThreadSubscribed({
  activityId,
  subscribed,
}: SetCommentThreadSubscribedRequest) {
  const route = client.activity.comment.subscription;
  const response = subscribed
    ? await route.$post({ json: { activityId } })
    : await route.$delete({ json: { activityId } });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default setCommentThreadSubscribed;
