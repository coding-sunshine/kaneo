import { describe, expect, it } from "vite-plus/test";
import { findBroadcastMention } from "./find-broadcast-mention";

describe("findBroadcastMention", () => {
  it("finds @channel and @here as words of their own", () => {
    expect(findBroadcastMention("@here deploy in 10 min")).toBe("here");
    expect(findBroadcastMention("heads up @channel.")).toBe("channel");
    expect(findBroadcastMention("(@here) now")).toBe("here");
  });

  it("prefers @channel when both appear", () => {
    expect(findBroadcastMention("@here and @channel")).toBe("channel");
  });

  it("ignores addresses, longer words and plain words", () => {
    expect(findBroadcastMention("mail ops@here.example")).toBeNull();
    expect(findBroadcastMention("@channels and @hereby")).toBeNull();
    expect(findBroadcastMention("@Here")).toBeNull();
    expect(findBroadcastMention("the channel is here")).toBeNull();
  });
});
