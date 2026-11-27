import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getOwnProfile() {
  const response = await client.user.profile.$get();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getOwnProfile;
