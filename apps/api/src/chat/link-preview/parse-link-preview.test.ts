import { describe, expect, it } from "vite-plus/test";
import { parseLinkPreview } from "./parse-link-preview";

// The page https://example.com serves: a title, no meta tags, one paragraph.
const exampleDomain = `<!doctype html><html lang="en"><head><title>Example Domain</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{background:#eee}</style></head><body><div><h1>Example Domain</h1><p>This domain is for use in documentation examples without needing permission. Avoid use in operations.</p><p><a href="https://iana.org/domains/example">Learn more</a></p></div></body></html>`;

describe("parseLinkPreview", () => {
  it("falls back to the title and first paragraph", () => {
    expect(parseLinkPreview(exampleDomain, "https://example.com/")).toEqual({
      url: "https://example.com/",
      title: "Example Domain",
      description:
        "This domain is for use in documentation examples without needing permission. Avoid use in operations.",
      siteName: "example.com",
    });
  });

  it("prefers Open Graph tags and decodes entities", () => {
    const html = `<head><title>Ignored</title>
      <meta property="og:title" content="Tom &amp; Jerry">
      <meta content="A &quot;classic&quot; &#39;show&#39;" property="og:description">
      <meta property="og:site_name" content="Cartoons"></head>`;
    expect(parseLinkPreview(html, "https://cartoons.test/a")).toEqual({
      url: "https://cartoons.test/a",
      title: "Tom & Jerry",
      description: `A "classic" 'show'`,
      siteName: "Cartoons",
    });
  });

  it("uses the meta description when there is no Open Graph one", () => {
    const html = `<title>Docs</title><meta name="description" content="How it works">`;
    expect(parseLinkPreview(html, "https://docs.test/")?.description).toBe(
      "How it works",
    );
  });

  it("strips markup and caps long text", () => {
    const html = `<title>${"x".repeat(500)}</title><p>Hello <b>bold</b> world</p>`;
    const preview = parseLinkPreview(html, "https://long.test/");
    expect(preview?.title.length).toBeLessThanOrEqual(200);
    expect(preview?.description).toBe("Hello bold world");
  });

  it("returns null for a page without a title", () => {
    expect(parseLinkPreview("<p>no title</p>", "https://a.test/")).toBeNull();
  });

  // Any member can point the server at a page, so unclosed tags must not
  // make parsing slow.
  it.each([
    ["unclosed paragraphs", `<title>x</title>${"<p>".repeat(90_000)}`],
    ["unclosed scripts", `<title>x</title>${"<script".repeat(37_000)}`],
    ["unclosed meta tags", "<meta ".repeat(40_000)],
    ["unclosed titles", "<title>".repeat(30_000)],
  ])("parses a page of %s quickly", (_name, html) => {
    const started = performance.now();
    parseLinkPreview(html, "https://a.test/");
    expect(performance.now() - started).toBeLessThan(500);
  });
});
