import { HTTPException } from "hono/http-exception";
import { resolveCitations } from "../agent/resolve-citations";
import { BULLETS_INSTRUCTION, readBullets } from "../assist/read-bullets";
import { runModel } from "../assist/run-model";
import { loadChannel } from "../chat/controllers/load-channel";
import db from "../database";
import { aiSkillRunTable } from "../database/schema";
import { openProjectIds } from "./open-projects";
import { gatherSkillSources } from "./gather-skill-sources";
import { assertSkillWithinCap } from "./skill-cap";
import { loadOwnSkill } from "./skill-store";

type Reader = Parameters<typeof resolveCitations>[0];

/**
 * Runs the reader's skill over the tickets it may read: its scoped projects
 * that the reader can open now, or every project they can open. The answer
 * goes back to the reader only; the run's tokens are kept, its text is not.
 */
export async function runSkill(
  reader: Reader,
  skillId: string,
  channelId: string,
  input?: string,
) {
  const { workspaceId, userId } = reader;
  const skill = await loadOwnSkill(reader, skillId);
  await loadChannel(workspaceId, channelId, userId, "read");
  await assertSkillWithinCap(skill);

  const projects = await openProjectIds(
    workspaceId,
    userId,
    skill.projectIds ?? undefined,
  );
  const sources = await gatherSkillSources(projects);
  if (sources.ids.size === 0)
    return {
      skillName: skill.name,
      bullets: [],
      promptTokens: 0,
      completionTokens: 0,
    };

  const result = await runModel({ workspaceId, userId, purpose: "skill" }, [
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
  ]);
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
    bullets: await Promise.all(
      bullets.map(async (bullet) => ({
        text: bullet.text,
        sources: await resolveCitations(
          reader,
          bullet.sources.map((id) => ({
            kind: sources.commentIds.has(id)
              ? ("comment" as const)
              : ("task" as const),
            id,
          })),
        ),
      })),
    ),
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
  };
}
