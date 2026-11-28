import { client } from "@kaneo/libs";
import i18n from "i18next";
import type { AgentCitation } from "@/components/agent/agent-citation";
import { HttpError } from "@/lib/http-error";
import { readSseEvents } from "@/lib/read-sse-events";

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

export type SkillRunResult = {
  skillName: string;
  bullets: {
    text: string;
    sources: AgentCitation[];
  }[];
  promptTokens: number;
  completionTokens: number;
};

type SkillRunEvent =
  | { type: "ping" }
  | { type: "result"; result: SkillRunResult }
  | { type: "error"; status: number; message: string };

/**
 * Runs a skill over a stream, so a run longer than a proxy's timeout still
 * gets its answer: pings arrive while the model works, then the answer.
 */
export async function runSkill(
  workspaceId: string,
  skillId: string,
  json: { channelId: string; input?: string },
) {
  const response = await api.skills[":skillId"].run.stream.$post({
    param: { workspaceId, skillId },
    json,
  });
  if (!response.ok || !response.body)
    throw await HttpError.fromResponse(response);
  let outcome: SkillRunResult | HttpError | undefined;
  await readSseEvents<SkillRunEvent>(response.body, (event) => {
    if (event.type === "result") outcome = event.result;
    if (event.type === "error")
      outcome = new HttpError(event.status, event.message);
  });
  if (outcome instanceof HttpError) throw outcome;
  if (!outcome) throw new Error(i18n.t("navigation:chat.skills.interrupted"));
  return outcome;
}

export type Skill = Awaited<ReturnType<typeof listSkills>>["skills"][number];
export type SkillRun = Awaited<
  ReturnType<typeof listSkillRuns>
>["runs"][number];
