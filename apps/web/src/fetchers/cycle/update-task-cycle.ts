import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function updateTaskCycle(taskId: string, cycleId: string | null) {
  const response = await client.task.cycle[":id"].$put({
    param: { id: taskId },
    json: { cycleId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default updateTaskCycle;
