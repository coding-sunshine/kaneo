import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function replyToTicketByEmail(taskId: string, content: string) {
  const response = await client["email-intake"].task[":taskId"].reply.$post({
    param: { taskId },
    json: { content },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export default replyToTicketByEmail;
