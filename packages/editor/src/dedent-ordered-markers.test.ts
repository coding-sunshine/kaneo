import { describe, expect, it } from "vite-plus/test";
import { dedentOrderedMarkers } from "./dedent-ordered-markers";

describe("dedentOrderedMarkers", () => {
  it("removes the one-space indent before ordered markers", () => {
    expect(dedentOrderedMarkers(" 9. a\n\n    ![i](u)\n10. b")).toBe(
      "9. a\n\n    ![i](u)\n10. b",
    );
  });

  it("leaves code fences and deeper nesting alone", () => {
    const md = "```\n 1. x\n```\n  1. nested";
    expect(dedentOrderedMarkers(md)).toBe(md);
  });
});
