import { describe, expect, it } from "vite-plus/test";
import { findFigmaUrls } from "./find-figma-urls";

const KEY = "AbCdEf0123456789xyzQrs";
const frame = (id: string) =>
  `https://www.figma.com/design/${KEY}/Flow?node-id=${id}`;

describe("findFigmaUrls", () => {
  it("finds bare, markdown and autolinked Figma links once each", () => {
    const content = [
      `Bare ${frame("1-2")}`,
      `[Spec](${frame("3-4")})`,
      `<${frame("5-6")}>`,
      `Again ${frame("1-2")}.`,
    ].join("\n");
    expect(findFigmaUrls(content)).toEqual([
      frame("1-2"),
      frame("3-4"),
      frame("5-6"),
    ]);
  });

  it("reads the escaped text of a saved link as the same link", () => {
    const url = `https://www.figma.com/design/${KEY}/Flow_v2?type=design&node-id=1-2`;
    const text = url.replaceAll("_", "\\_").replaceAll("&", "&amp;");
    expect(findFigmaUrls(`[${text}](${url})`)).toEqual([url]);
  });

  it("keeps at most three cards per body", () => {
    const content = ["1-1", "2-2", "3-3", "4-4"].map(frame).join(" ");
    expect(findFigmaUrls(content)).toHaveLength(3);
  });

  it("ignores other hosts and lookalikes", () => {
    expect(
      findFigmaUrls(
        `https://figma.com.evil.test/design/${KEY} https://example.test/figma.com/design/${KEY}`,
      ),
    ).toEqual([]);
  });
});
