import { describe, expect, it } from "vite-plus/test";
import { collapse, documentText, quoteStart } from "./statement-text";

describe("documentText", () => {
  it("drops tags, decodes entities and collapses whitespace", () => {
    expect(
      documentText(
        "<h1>Launch</h1>\n<p>We go live on&nbsp;5 March &amp; not before.</p>",
      ),
    ).toBe("Launch We go live on 5 March & not before.");
  });

  it("decodes an entity once", () => {
    expect(documentText("a &amp;lt; b")).toBe("a &lt; b");
  });
});

describe("quoteStart", () => {
  const text = documentText("<p>We go live on 5 March.</p><p>40 seats.</p>");

  it("finds a quote whatever its line breaks", () => {
    expect(quoteStart(text, "live on\n  5 March")).toBe(6);
    expect(collapse(" live on\n5 March ")).toBe("live on 5 March");
  });

  it("answers -1 for a quote that is not there, in another case or empty", () => {
    expect(quoteStart(text, "live on 6 March")).toBe(-1);
    expect(quoteStart(text, "LIVE ON 5 MARCH")).toBe(-1);
    expect(quoteStart(text, "  ")).toBe(-1);
  });

  it("does not find a quote that spans a tag the text does not have", () => {
    expect(quoteStart(text, "5 March.40 seats")).toBe(-1);
    expect(quoteStart(text, "5 March. 40 seats")).toBeGreaterThan(0);
  });
});
