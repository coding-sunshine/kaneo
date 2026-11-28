import type { StandupDraft } from "@/fetchers/standup/get-standup-draft";

type Item = StandupDraft["did"][number];

export type StandupLabels = {
  did: string;
  doing: string;
  blocked: string;
  none: string;
};

/**
 * The draft as plain text the person edits and copies: one line per ticket,
 * with its key, title and link, under did, doing and blocked.
 */
export function formatStandup(
  draft: StandupDraft,
  labels: StandupLabels,
  linkOf: (item: Item) => string,
) {
  const section = (title: string, items: Item[]) =>
    [
      title,
      ...(items.length
        ? items.map(
            (item) => `- ${item.ticket} ${item.title} (${linkOf(item)})`,
          )
        : [`- ${labels.none}`]),
    ].join("\n");
  return [
    section(labels.did, draft.did),
    section(labels.doing, draft.doing),
    section(labels.blocked, draft.blocked),
  ].join("\n\n");
}
