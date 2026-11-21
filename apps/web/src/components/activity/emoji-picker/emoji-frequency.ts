export type EmojiFrequencies = {
  lastUsed: string | null;
  scores: Record<string, number>;
};

// Linear seeds every user with these shortcodes at score 1, in this order
// ("eyes" appears twice there; the second one changes nothing). Reactions are
// stored as characters, so each shortcode is paired with its emoji.
export const SEED_EMOJI = [
  "👍", // +1
  "👌", // ok_hand
  "🙏", // pray
  "😂", // joy
  "❤️", // heart
  "👀", // eyes
  "✅", // white_check_mark
  "🙂", // slightly_smiling_face
  "😃", // smiley
  "😄", // smile
  "😀", // grinning
  "🤔", // thinking_face
  "😅", // sweat_smile
  "⚠️", // warning
  "🙁", // confused
  "❌", // x
  "🙌", // raised_hands
  "🎉", // tada
  "😉", // wink
  "😊", // blush
  "🤷", // shrug
  "👋", // wave
  "❓", // question
] as const;

export const EMOJI_COLUMNS = 9;

const storageKey = (userId: string) => `emojis:frequencies:${userId}`;

export function seedFrequencies(): EmojiFrequencies {
  return {
    lastUsed: null,
    scores: Object.fromEntries(SEED_EMOJI.map((emoji) => [emoji, 1])),
  };
}

export function recordEmojiUse(
  frequencies: EmojiFrequencies,
  emoji: string,
): EmojiFrequencies {
  return {
    lastUsed: emoji,
    scores: {
      ...frequencies.scores,
      [emoji]: (frequencies.scores[emoji] ?? 0) + 1,
    },
  };
}

// Highest score first; ties keep insertion order. The latest pick always shows,
// taking the last slot when it did not make the cut.
export function topEmoji(
  { lastUsed, scores }: EmojiFrequencies,
  count = EMOJI_COLUMNS * 2,
) {
  const top = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, count)
    .map(([emoji]) => emoji);
  if (lastUsed && !top.includes(lastUsed) && top.length > 0) {
    top[top.length - 1] = lastUsed;
  }
  return top;
}

function isFrequencies(value: unknown): value is EmojiFrequencies {
  if (typeof value !== "object" || value === null) return false;
  const { lastUsed, scores } = value as Partial<EmojiFrequencies>;
  return (
    (lastUsed === null || typeof lastUsed === "string") &&
    typeof scores === "object" &&
    scores !== null &&
    Object.values(scores).every((score) => typeof score === "number")
  );
}

export function loadFrequencies(userId: string): EmojiFrequencies {
  try {
    const stored = JSON.parse(
      localStorage.getItem(storageKey(userId)) ?? "null",
    );
    if (isFrequencies(stored)) return stored;
  } catch {
    // Storage can be blocked or hold junk; fall back to the seed.
  }
  return seedFrequencies();
}

export function saveFrequencies(userId: string, frequencies: EmojiFrequencies) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(frequencies));
  } catch {
    // The picker still works without storage; picks just are not remembered.
  }
}
