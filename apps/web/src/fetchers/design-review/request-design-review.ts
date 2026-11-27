import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export default async function requestDesignReview({
  taskId,
  reviewerId,
}: {
  taskId: string;
  reviewerId: string;
}) {
  const response = await client["design-review"].task[":taskId"].$post({
    param: { taskId },
    json: { reviewerId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
