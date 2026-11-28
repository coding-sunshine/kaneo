import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const workspace = client.chat.workspace[":workspaceId"];

export async function getDrafts(workspaceId: string) {
  const response = await workspace.drafts.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

/** An empty body deletes the draft. Survives the page closing mid-request. */
export async function saveDraft(
  param: { workspaceId: string; channelId: string },
  body: string,
) {
  const response = await workspace.channels[":channelId"].draft.$put(
    { param, json: { body } },
    { init: { keepalive: true } },
  );
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
