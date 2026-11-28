import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type WebPushSubscriptionJson = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export default async function registerWebPush(
  subscription: WebPushSubscriptionJson,
) {
  const response = await client.push.device.$put({
    json: { platform: "web", subscription },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
