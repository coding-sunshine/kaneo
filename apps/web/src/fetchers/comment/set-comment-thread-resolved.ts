import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

type SetCommentThreadResolvedRequest = {
  activityId: string;
  resolved: boolean;
};

async function setCommentThreadResolved({
  activityId,
  resolved,
}: SetCommentThreadResolvedRequest) {
  const route = resolved
    ? client.activity.comment.resolve
    : client.activity.comment.unresolve;
  const response = await route.$post({ json: { activityId } });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default setCommentThreadResolved;
