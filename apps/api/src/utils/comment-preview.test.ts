import { describe, expect, it } from "vite-plus/test";
import { commentPreview } from "./comment-preview";

describe("commentPreview", () => {
  it("drops a mention tag that straddles the cut", () => {
    const content = `${"a".repeat(150)} <kaneo-mention id="user-1">@Sam</kaneo-mention> done`;
    const preview = commentPreview(content);
    expect(preview).not.toContain("<");
    expect(preview).toBe(`${"a".repeat(150)} @Sam done`);
  });

  it("caps plain text at 160 characters", () => {
    expect(commentPreview("x".repeat(200))).toHaveLength(160);
  });
});
