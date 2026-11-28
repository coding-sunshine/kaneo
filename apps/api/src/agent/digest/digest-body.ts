import { DIGEST_SECTIONS } from "./digest-tool";

export type DigestLine = { title: string; url: string; note?: string };
export type DigestSections = Record<
  (typeof DIGEST_SECTIONS)[number]["key"],
  DigestLine[]
>;

// Brackets would end the link text early.
const linkText = (title: string) => title.replace(/[[\]]/g, "");

/** The digest as Markdown: the four headings always, a ticket link per line. */
export function digestBody(sections: DigestSections) {
  return DIGEST_SECTIONS.map(({ key, heading }) => {
    const rows = sections[key].map(
      (line) =>
        `- [${linkText(line.title)}](${line.url})${line.note ? ` — ${line.note}` : ""}`,
    );
    return [
      `## ${heading}`,
      ...(rows.length ? rows : ["_Nothing this week._"]),
    ].join("\n");
  }).join("\n\n");
}

/** Health follows the worst section: blocked, then at risk. */
export const digestHealth = (sections: DigestSections) =>
  sections.blocked.length
    ? ("offTrack" as const)
    : sections.atRisk.length
      ? ("atRisk" as const)
      : ("onTrack" as const);
