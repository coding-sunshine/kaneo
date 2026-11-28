import { z } from "../openapi";

const level = z.number().int().min(1).max(4);

// Strict like Linear's: an unknown field drops the whole score.
// Area names and explanations are not shown, so a bad one does not.
const riskScore = z
  .object({
    plugin: z.literal("riskScore"),
    level,
    override: z.boolean().optional(),
    sha: z
      .string()
      .regex(/^[0-9a-f]{40}$/i)
      .optional(),
    // Not shown. Accepted so a long note does not drop the level.
    explanations: z.unknown().optional(),
    areas: z.array(z.object({ level }).passthrough()).max(8).optional(),
  })
  .strict();

// Bounded so an unclosed opener cannot scan to the end of a large text, once per opener.
const BLOCK = /<!--\s*linear:extension\s*(\{[\s\S]{0,8192}?\})\s*-->/g;

function entryLevel(plugin: unknown, headSha: string) {
  const entry = riskScore.safeParse(plugin);
  if (!entry.success) return null;
  const { sha, override, areas = [] } = entry.data;
  if (sha && sha.toLowerCase() !== headSha.toLowerCase()) return null;
  return override
    ? entry.data.level
    : Math.max(entry.data.level, ...areas.map((area) => area.level));
}

/**
 * Linear's risk level (1 Low .. 4 Very high) from `linear:extension` comments in
 * the given texts, or null. Texts are oldest first. Entries pinned to another
 * head sha are stale; the newest remaining entry wins.
 */
export function parseRiskLevel(texts: string[], headSha: string) {
  for (let i = texts.length - 1; i >= 0; i--) {
    const text = texts[i];
    if (text === undefined) continue;
    const matches = [...text.matchAll(BLOCK)];
    for (let j = matches.length - 1; j >= 0; j--) {
      const json = matches[j]?.[1] ?? "";
      let block: unknown;
      try {
        block = JSON.parse(json);
      } catch {
        continue;
      }
      const { version, plugins } = block as {
        version?: unknown;
        plugins?: unknown;
      };
      if (version !== 1 || !Array.isArray(plugins)) continue;
      for (let k = plugins.length - 1; k >= 0; k--) {
        const level = entryLevel(plugins[k], headSha);
        if (level !== null) return level as 1 | 2 | 3 | 4;
      }
    }
  }
  return null;
}
