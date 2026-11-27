import { describe, expect, it } from "vite-plus/test";
import { stripQuotedReply } from "./strip-quoted-reply";

describe("stripQuotedReply", () => {
  it("keeps only the new text above the quoted message", () => {
    expect(
      stripQuotedReply(
        [
          "Thanks, that fixed it.",
          "",
          "On Mon, 1 Jan 2026 at 10:00, Help <help@example.test> wrote:",
          "> We restarted the printer.",
        ].join("\n"),
      ),
    ).toBe("Thanks, that fixed it.");
  });

  it("cuts at a quote block or an original-message divider", () => {
    expect(stripQuotedReply("Yes\n> earlier")).toBe("Yes");
    expect(
      stripQuotedReply("Sure\n\n-----Original Message-----\nFrom: x"),
    ).toBe("Sure");
  });

  it("returns the whole text when nothing is quoted", () => {
    expect(stripQuotedReply("Line one\nLine two")).toBe("Line one\nLine two");
  });
});
