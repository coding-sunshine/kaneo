import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const api = client.skill.workspace[":workspaceId"];

export async function listSkills(workspaceId: string) {
  const response = await api.skills.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function listSkillRuns(workspaceId: string) {
  const response = await api.runs.$get({ param: { workspaceId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type SkillInput = {
  name: string;
  prompt: string;
  projectIds?: string[] | null;
  monthlyTokenCap?: number | null;
};

export async function createSkill(workspaceId: string, json: SkillInput) {
  const response = await api.skills.$post({ param: { workspaceId }, json });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteSkill(workspaceId: string, skillId: string) {
  const response = await api.skills[":skillId"].$delete({
    param: { workspaceId, skillId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function runSkill(
  workspaceId: string,
  skillId: string,
  json: { channelId: string; input?: string },
) {
  const response = await api.skills[":skillId"].run.$post({
    param: { workspaceId, skillId },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type Skill = Awaited<ReturnType<typeof listSkills>>["skills"][number];
export type SkillRunResult = Awaited<ReturnType<typeof runSkill>>;
export type SkillRun = Awaited<
  ReturnType<typeof listSkillRuns>
>["runs"][number];
