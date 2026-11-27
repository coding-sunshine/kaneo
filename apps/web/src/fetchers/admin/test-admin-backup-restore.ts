import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function testAdminBackupRestore() {
  const response = await client.admin.backups["test-restore"].$post();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
