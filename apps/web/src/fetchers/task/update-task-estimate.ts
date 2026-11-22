import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function updateTaskEstimate(taskId: string, estimate: number | null) {
  const response = await client.task.estimate[":id"].$put({
    param: { id: taskId },
    json: { estimate },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updateTaskEstimate;
