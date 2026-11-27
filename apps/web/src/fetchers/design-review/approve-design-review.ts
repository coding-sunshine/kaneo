import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export default async function approveDesignReview({
  taskId,
}: {
  taskId: string;
}) {
  const response = await client["design-review"].task[":taskId"].approve.$post({
    param: { taskId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
