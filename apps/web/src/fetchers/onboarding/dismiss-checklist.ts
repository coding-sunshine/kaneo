import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function dismissChecklist() {
  const response = await client.onboarding.checklist.dismiss.$post();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default dismissChecklist;
