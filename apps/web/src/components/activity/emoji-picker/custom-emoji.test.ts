import { describe, expect, it } from "vite-plus/test";
import { customEmojiName, searchCustomEmoji } from "./custom-emoji";

const custom = [
  { id: "1", name: "party_parrot", url: "/a" },
  { id: "2", name: "ship-it", url: "/b" },
];

describe("custom emoji", () => {
  it("finds custom emoji by name", () => {
    expect(searchCustomEmoji(custom, "parrot")).toEqual([custom[0]]);
    expect(searchCustomEmoji(custom, "SHIP")).toEqual([custom[1]]);
    expect(searchCustomEmoji(custom, "nope")).toEqual([]);
  });

  it("tells shortcodes from native emoji", () => {
    expect(customEmojiName(":ship-it:")).toBe("ship-it");
    expect(customEmojiName("👍")).toBeNull();
  });
});
