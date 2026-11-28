import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function createWelcomeWorkspace() {
  const response = await client.onboarding["welcome-workspace"].$post();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default createWelcomeWorkspace;
