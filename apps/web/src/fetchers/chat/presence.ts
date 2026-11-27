import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const presence = client.chat.presence;

export async function getPresenceSetting() {
  const response = await presence.$get();
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function setPresenceSetting(enabled: boolean) {
  const response = await presence.$put({ json: { enabled } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function sendPresenceHeartbeat() {
  const response = await presence.heartbeat.$post();
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getOnline(workspaceId: string) {
  const response = await client.chat.workspace[":workspaceId"].presence.$get({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
