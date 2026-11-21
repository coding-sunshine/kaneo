import { describe, expect, it } from "vite-plus/test";
import { buildEmojiGroups, searchEmoji } from "./emoji-groups";

const raw = [
  {
    slug: "smileys_emotion",
    emojis: [
      { emoji: "😀", name: "grinning face", emoji_version: "1.0" },
      { emoji: "🫩", name: "face with bags under eyes", emoji_version: "16.0" },
    ],
  },
  {
    slug: "people_body",
    emojis: [{ emoji: "👍", name: "thumbs up", emoji_version: "0.6" }],
  },
  {
    slug: "food_drink",
    emojis: [{ emoji: "🍕", name: "pizza", emoji_version: "0.6" }],
  },
];

describe("emoji groups", () => {
  it("merges smileys and people and drops emoji too new to render", () => {
    expect(buildEmojiGroups(raw)).toEqual([
      {
        slug: "smileys_people",
        emojis: [
          { emoji: "😀", name: "grinning face" },
          { emoji: "👍", name: "thumbs up" },
        ],
      },
      { slug: "food_drink", emojis: [{ emoji: "🍕", name: "pizza" }] },
    ]);
  });

  it("matches every search word", () => {
    const groups = buildEmojiGroups(raw);
    expect(searchEmoji(groups, "Thumbs UP").map((e) => e.emoji)).toEqual([
      "👍",
    ]);
    expect(searchEmoji(groups, "face pizza")).toEqual([]);
  });
});
