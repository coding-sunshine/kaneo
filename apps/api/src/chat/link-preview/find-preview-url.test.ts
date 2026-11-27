import { describe, expect, it } from "vite-plus/test";
import { findPreviewUrl } from "./find-preview-url";

describe("findPreviewUrl", () => {
  it("returns the first web link in a message", () => {
    expect(findPreviewUrl("see https://example.com and https://a.test")).toBe(
      "https://example.com",
    );
  });

  it("drops trailing punctuation that ends a sentence", () => {
    expect(findPreviewUrl("read (https://example.com/docs).")).toBe(
      "https://example.com/docs",
    );
  });

  it("ignores links inside a fenced code block", () => {
    expect(findPreviewUrl("```\ncurl https://example.com\n```")).toBeNull();
  });

  it("ignores links inside inline code", () => {
    expect(findPreviewUrl("run `curl https://example.com` now")).toBeNull();
  });

  it("previews a link that follows a code block", () => {
    expect(
      findPreviewUrl("```\nhttps://a.test\n```\nsee https://example.com"),
    ).toBe("https://example.com");
  });

  it("ignores schemes other than http and https", () => {
    expect(findPreviewUrl("ftp://example.com javascript:alert(1)")).toBeNull();
  });
});
