import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { PatchDiff, parsePatch } from "./patch-diff";

afterEach(cleanup);

describe("parsePatch", () => {
  it("numbers old and new lines from the hunk header", () => {
    const lines = parsePatch("@@ -10,3 +20,3 @@ fn\n keep\n-old\n+new");
    expect(lines.map((line) => [line.kind, line.oldNo, line.newNo])).toEqual([
      ["hunk", null, null],
      ["ctx", 10, 20],
      ["del", 11, null],
      ["add", null, 21],
    ]);
  });

  it("renders code as text, never as markup", () => {
    const { container } = render(
      <PatchDiff patch={"@@ -1 +1 @@\n+<img src=x onerror=alert(1)>"} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
  });
});
