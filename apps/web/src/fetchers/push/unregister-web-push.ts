import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { WebPushSubscriptionJson } from "./register-web-push";

export default async function unregisterWebPush(
  subscription: WebPushSubscriptionJson,
) {
  const response = await client.push.device.$delete({
    json: { subscription },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
