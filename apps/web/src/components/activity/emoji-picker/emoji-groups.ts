export type EmojiEntry = { emoji: string; name: string };
export type EmojiGroup = { slug: string; emojis: EmojiEntry[] };

type RawGroup = {
  slug: string;
  emojis: Array<EmojiEntry & { emoji_version: string }>;
};

// Linear's picker opens with these until a user has their own history.
export const FREQUENTLY_USED = [
  "👍",
  "👌",
  "🙏",
  "😂",
  "❤️",
  "👀",
  "✅",
  "🙂",
  "😃",
  "😄",
  "😀",
  "🤔",
  "😅",
  "⚠️",
  "🙁",
  "❌",
  "🙌",
  "🎉",
];

// Emoji 16+ still renders as an empty box on many current systems.
const NEWEST_RENDERED_VERSION = 15.1;

// Linear shows smileys and people as one "Smileys & People" section.
const MERGED_GROUPS: Record<string, string> = {
  smileys_emotion: "smileys_people",
  people_body: "smileys_people",
};

export function buildEmojiGroups(raw: RawGroup[]): EmojiGroup[] {
  const groups = new Map<string, EmojiEntry[]>();
  for (const group of raw) {
    if (group.slug === "component") continue;
    const slug = MERGED_GROUPS[group.slug] ?? group.slug;
    const emojis = groups.get(slug) ?? [];
    for (const { emoji, name, emoji_version } of group.emojis) {
      if (Number(emoji_version) <= NEWEST_RENDERED_VERSION) {
        emojis.push({ emoji, name });
      }
    }
    groups.set(slug, emojis);
  }
  return [...groups].map(([slug, emojis]) => ({ slug, emojis }));
}

export function searchEmoji(groups: EmojiGroup[], query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return groups
    .flatMap((group) => group.emojis)
    .filter(({ name }) => words.every((word) => name.includes(word)));
}

let loaded: Promise<EmojiGroup[]> | undefined;

export function loadEmojiGroups() {
  loaded ??= import("unicode-emoji-json/data-by-group.json").then((module) =>
    buildEmojiGroups(module.default as RawGroup[]),
  );
  return loaded;
}
