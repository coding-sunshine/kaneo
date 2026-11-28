import { describe, expect, it } from "vite-plus/test";
import { plainAnswerText } from "./plain-answer-text";

describe("plainAnswerText", () => {
  it("keeps plain words and ticket keys", () => {
    expect(plainAnswerText("Checkout fails, see PAY-1.")).toBe(
      "Checkout fails, see PAY-1.",
    );
  });

  it("drops tags, mentions, links and workspace addresses", () => {
    expect(
      plainAnswerText(
        '@channel look <kaneo-mention id="u1">@Dana</kaneo-mention> https://example.com/x /workspace/w1/document/d1 www.example.com done',
      ),
    ).toBe("channel look Dana done");
  });

  it("keeps the answer on one line", () => {
    expect(plainAnswerText("one\n\n- two\n> three")).toBe("one - two > three");
  });
});
