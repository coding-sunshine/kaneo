import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getAdminBackups() {
  const response = await client.admin.backups.$get();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
