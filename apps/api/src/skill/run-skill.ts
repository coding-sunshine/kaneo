import { HTTPException } from "hono/http-exception";
import type { ChatMessage } from "../agent/openrouter";
import { resolveCitations } from "../agent/resolve-citations";
import { estimateTokens } from "../assist/estimate-tokens";
import { BULLETS_INSTRUCTION, readBullets } from "../assist/read-bullets";
import { runModel } from "../assist/run-model";
import { loadChannel } from "../chat/controllers/load-channel";
import db from "../database";
import { aiSkillRunTable } from "../database/schema";
import { openProjectIds } from "./open-projects";
import { gatherSkillSources } from "./gather-skill-sources";
import { reserveSkillTokens } from "./skill-cap";
import { loadOwnSkill } from "./skill-store";

type Reader = Parameters<typeof resolveCitations>[0];

/**
 * Runs the reader's skill over the tickets it may read: its scoped projects
 * that the reader can open now, or every project they can open. The answer
 * goes back to the reader only; the run's tokens are kept, its text is not.
 */
export const runSkill = async (
  reader: Reader,
  skillId: string,
  channelId: string,
  input?: string,
) => (await prepareSkillRun(reader, skillId, channelId, input))();

/**
 * The quick part of a run: the skill, the channel, its sources and the
 * credit cap are checked now, so a refusal answers at once. The model is
 * asked when the returned function is called.
 */
export async function prepareSkillRun(
  reader: Reader,
  skillId: string,
  channelId: string,
  input?: string,
) {
  const { workspaceId, userId } = reader;
  const skill = await loadOwnSkill(reader, skillId);
  const channel = await loadChannel(workspaceId, channelId, userId, "read");
  if (channel.aiDisabled)
    throw new HTTPException(403, {
      message: "AI is turned off in this channel",
    });

  const projects = await openProjectIds(
    workspaceId,
    userId,
    skill.projectIds ?? undefined,
  );
  const sources = await gatherSkillSources(projects);
  if (sources.ids.size === 0)
    return async () => ({
      skillName: skill.name,
      bullets: [] as Awaited<ReturnType<typeof citedBullets>>,
      promptTokens: 0,
      completionTokens: 0,
    });

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "You run a teammate's saved instruction over their tickets and comments.",
        BULLETS_INSTRUCTION,
      ].join("\n"),
    },
    {
      role: "user",
      content: `<instruction>${skill.prompt}</instruction>\n${input ? `<request>${input}</request>\n` : ""}${sources.text}`,
    },
  ];
  const settle = await reserveSkillTokens(
    {
      workspaceId,
      userId,
      name: skill.name,
      monthlyTokenCap: skill.monthlyTokenCap,
    },
    estimateTokens(messages.map((message) => message.content ?? "").join("\n")),
  );
  return async () => {
    let result: Awaited<ReturnType<typeof runModel>>;
    try {
      result = await runModel(
        { workspaceId, userId, purpose: "skill" },
        messages,
      );
    } catch (error) {
      await settle(0);
      throw error;
    }
    await settle(result.promptTokens + result.completionTokens);
    await db.insert(aiSkillRunTable).values({
      skillId: skill.id,
      userId,
      channelId,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
    const bullets = readBullets(result.content, sources.ids);
    if (!bullets)
      throw new HTTPException(502, {
        message: "The skill's answer could not be read. Try again.",
      });
    return {
      skillName: skill.name,
      bullets: await citedBullets(reader, bullets, sources.commentIds),
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    };
  };
}

const citedBullets = (
  reader: Reader,
  bullets: { text: string; sources: string[] }[],
  commentIds: ReadonlySet<string>,
) =>
  Promise.all(
    bullets.map(async (bullet) => ({
      text: bullet.text,
      sources: await resolveCitations(
        reader,
        bullet.sources.map((id) => ({
          kind: commentIds.has(id) ? ("comment" as const) : ("task" as const),
          id,
        })),
      ),
    })),
  );
