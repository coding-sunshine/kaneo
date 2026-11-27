import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function resetAdminUserTwoFactor(userId: string, code: string) {
  const response = await client.admin.users[":userId"][
    "two-factor"
  ].reset.$post({ param: { userId }, json: { code } });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
