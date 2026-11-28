import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export default async function getWebPushKey() {
  const response = await client.push["web-key"].$get();
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
