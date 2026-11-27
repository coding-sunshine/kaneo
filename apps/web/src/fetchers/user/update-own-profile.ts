import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type OwnProfileUpdate = InferRequestType<
  typeof client.user.profile.$patch
>["json"];

async function updateOwnProfile(update: OwnProfileUpdate) {
  const response = await client.user.profile.$patch({ json: update });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updateOwnProfile;
