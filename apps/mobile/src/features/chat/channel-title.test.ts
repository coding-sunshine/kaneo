import { describe, expect, it } from "vite-plus/test";

import { channelTitle } from "./channel-title";

const members = [
  { userId: "me", name: "Me" },
  { userId: "writer", name: "Writer" },
  { userId: "reader", name: "Reader" },
];

describe("channelTitle", () => {
  it("prefixes a channel with #", () => {
    expect(
      channelTitle({ name: "general", isDirect: false }, "me", members, "You"),
    ).toBe("#general");
  });

  it("names the other people in a direct message", () => {
    expect(
      channelTitle(
        { name: "dm", isDirect: true, memberIds: ["me", "reader", "writer"] },
        "me",
        members,
        "You",
      ),
    ).toBe("Reader, Writer");
  });

  it("calls a note to yourself by the fallback", () => {
    expect(
      channelTitle(
        { name: "dm", isDirect: true, memberIds: ["me"] },
        "me",
        members,
        "You",
      ),
    ).toBe("You");
  });
});
