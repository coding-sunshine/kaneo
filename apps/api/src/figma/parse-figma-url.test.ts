import { describe, expect, it } from "vite-plus/test";
import { parseFigmaUrl } from "./parse-figma-url";

const KEY = "AbCdEf0123456789xyzQrs";

describe("parseFigmaUrl", () => {
  it("reads the file key and frame node id from a design link", () => {
    expect(
      parseFigmaUrl(
        `https://www.figma.com/design/${KEY}/Checkout-flow?node-id=12-34&t=x`,
      ),
    ).toEqual({
      fileKey: KEY,
      nodeId: "12:34",
      url: `https://www.figma.com/design/${KEY}/Checkout-flow?node-id=12-34&t=x`,
    });
  });

  it("accepts file, proto and board links on the bare host", () => {
    for (const kind of ["file", "proto", "board"]) {
      expect(parseFigmaUrl(`https://figma.com/${kind}/${KEY}`)).toMatchObject({
        fileKey: KEY,
        nodeId: null,
      });
    }
  });

  it("uses the branch key of a branch link", () => {
    expect(
      parseFigmaUrl(
        `https://www.figma.com/design/${KEY}/branch/Branch0123456789Key/Name?node-id=1%3A2`,
      ),
    ).toMatchObject({ fileKey: "Branch0123456789Key", nodeId: "1:2" });
  });

  it("drops a node id that is not a plain frame id", () => {
    expect(
      parseFigmaUrl(`https://www.figma.com/design/${KEY}/x?node-id=1-2;evil`),
    ).toMatchObject({ nodeId: null });
  });

  it.each([
    `http://www.figma.com/design/${KEY}`,
    `https://figma.com.evil.test/design/${KEY}`,
    `https://evilfigma.com/design/${KEY}`,
    `https://api.figma.com/v1/files/${KEY}`,
    `https://user@www.figma.com/design/${KEY}`,
    `https://www.figma.com:8443/design/${KEY}`,
    `https://www.figma.com/community/file/${KEY}`,
    "https://www.figma.com/design/../../v1/me",
    "https://www.figma.com/design/short",
    "not a url",
  ])("rejects %s", (url) => {
    expect(parseFigmaUrl(url)).toBeNull();
  });
});
