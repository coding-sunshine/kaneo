import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export default async function withdrawDesignReview({
  taskId,
  reviewerId,
}: {
  taskId: string;
  reviewerId: string;
}) {
  const response = await client["design-review"].task[":taskId"].reviewer[
    ":reviewerId"
  ].$delete({ param: { taskId, reviewerId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
