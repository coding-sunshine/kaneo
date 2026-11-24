import { z } from "../openapi";

const text = (max: number) => z.string().trim().min(1).max(max);
const level = z.number().int().min(1).max(4);

// Strict like Linear's: an unknown field or a bad area drops the whole score.
const riskScore = z
  .object({
    plugin: z.literal("riskScore"),
    level,
    override: z.boolean().optional(),
    sha: z
      .string()
      .regex(/^[0-9a-f]{40}$/i)
      .optional(),
    explanations: z.array(text(200)).max(8).optional(),
    areas: z
      .array(
        z
          .object({
            name: text(60).refine((name) => !name.includes("\n")),
            level,
            explanation: text(200).optional(),
          })
          .strict(),
      )
      .max(8)
      .optional(),
  })
  .strict();

// Bounded so an unclosed opener cannot scan to the end of a large text, once per opener.
const BLOCK = /<!--\s*linear:extension\s*(\{[\s\S]{0,8192}?\})\s*-->/g;

/**
 * Linear's risk level (1 Low .. 4 Very high) from `linear:extension` comments in
 * the given texts, or null. Entries pinned to another head sha are stale; the
 * highest remaining level wins.
 */
export function parseRiskLevel(texts: string[], headSha: string) {
  let best: number | null = null;
  for (const source of texts) {
    for (const [, json = ""] of source.matchAll(BLOCK)) {
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
      for (const plugin of plugins) {
        const entry = riskScore.safeParse(plugin);
        if (!entry.success) continue;
        const { sha, override, areas = [] } = entry.data;
        if (sha && sha.toLowerCase() !== headSha.toLowerCase()) continue;
        const effective = override
          ? entry.data.level
          : Math.max(entry.data.level, ...areas.map((area) => area.level));
        if (best === null || effective > best) best = effective;
      }
    }
  }
  return best as 1 | 2 | 3 | 4 | null;
}
