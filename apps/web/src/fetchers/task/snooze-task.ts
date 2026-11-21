import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function snoozeTask(taskId: string, snoozedUntil: string | null) {
  const response = await client.task.snooze[":id"].$put({
    param: { id: taskId },
    json: { snoozedUntil },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default snoozeTask;
