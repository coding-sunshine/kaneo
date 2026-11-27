import { describe, expect, it } from "vite-plus/test";
import { splitLinks } from "./split-links";

describe("splitLinks", () => {
  it("splits a meeting link out of the text", () => {
    expect(splitLinks("join https://meet.example.test/abc-defg now")).toEqual([
      { text: "join " },
      {
        text: "https://meet.example.test/abc-defg",
        href: "https://meet.example.test/abc-defg",
      },
      { text: " now" },
    ]);
  });

  it("keeps sentence punctuation out of the link", () => {
    expect(splitLinks("see https://example.com.")).toEqual([
      { text: "see " },
      { text: "https://example.com", href: "https://example.com" },
      { text: "." },
    ]);
  });

  it("links only http and https", () => {
    expect(splitLinks("javascript:alert(1) ftp://example.com")).toEqual([
      { text: "javascript:alert(1) ftp://example.com" },
    ]);
  });
});
