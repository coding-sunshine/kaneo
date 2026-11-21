import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  loadFrequencies,
  recordEmojiUse,
  saveFrequencies,
  SEED_EMOJI,
  seedFrequencies,
  topEmoji,
} from "./emoji-frequency";

afterEach(() => localStorage.clear());

describe("emoji frequency", () => {
  it("ranks the user's own recent reactions first", () => {
    const seeded = seedFrequencies();
    expect(topEmoji(seeded)).toEqual(SEED_EMOJI.slice(0, 18));

    // Increment: a seeded emoji overtakes every tie at score 1.
    const tada = recordEmojiUse(seeded, "🎉");
    expect(tada.scores["🎉"]).toBe(2);
    expect(topEmoji(tada).slice(0, 2)).toEqual(["🎉", "👍"]);

    // lastUsed outside the top takes the last slot.
    const wave = recordEmojiUse(seeded, "👋");
    expect(wave.lastUsed).toBe("👋");
    expect(topEmoji(wave).slice(0, 17)).toEqual([
      "👋",
      ...SEED_EMOJI.slice(0, 16),
    ]);
    const unseeded = recordEmojiUse(seeded, "🦄");
    expect(topEmoji(unseeded)).toHaveLength(18);
    expect(topEmoji(unseeded).at(-1)).toBe("🦄");
  });

  it("keeps each user's history apart and works without storage", () => {
    saveFrequencies("a", recordEmojiUse(seedFrequencies(), "🦄"));
    expect(loadFrequencies("a").lastUsed).toBe("🦄");
    expect(loadFrequencies("b")).toEqual(seedFrequencies());

    localStorage.setItem("emojis:frequencies:c", "not json");
    expect(loadFrequencies("c")).toEqual(seedFrequencies());
  });
});
