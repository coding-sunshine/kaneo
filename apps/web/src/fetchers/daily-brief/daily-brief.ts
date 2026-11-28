import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const api = client["daily-brief"].workspace[":workspaceId"];

export async function getBriefPreference(workspaceId: string) {
  const response = await api.preference.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function setBriefPreference(
  workspaceId: string,
  json: { enabled: boolean; channelIds: string[] },
) {
  const response = await api.preference.$put({ param: { workspaceId }, json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getBrief(workspaceId: string, briefId: string) {
  const response = await api.briefs[":briefId"].$get({
    param: { workspaceId, briefId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type DailyBrief = Awaited<ReturnType<typeof getBrief>>;
