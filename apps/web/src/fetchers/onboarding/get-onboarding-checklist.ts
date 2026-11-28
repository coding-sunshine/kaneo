import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type OnboardingChecklist = InferResponseType<
  typeof client.onboarding.checklist.$get,
  200
>;

async function getOnboardingChecklist() {
  const response = await client.onboarding.checklist.$get();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getOnboardingChecklist;
