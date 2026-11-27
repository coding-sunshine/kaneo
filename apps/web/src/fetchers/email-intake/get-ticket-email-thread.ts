import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getTicketEmailThread(taskId: string) {
  const response = await client["email-intake"].task[":taskId"].$get({
    param: { taskId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default getTicketEmailThread;
