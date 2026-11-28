import { describe, expect, it } from "vite-plus/test";
import { base64UrlBytes } from "./base64-url-bytes";

describe("base64UrlBytes", () => {
  it("decodes the url-safe alphabet without padding", () => {
    expect([...base64UrlBytes("-_8")]).toEqual([251, 255]);
    expect([...base64UrlBytes("AQID")]).toEqual([1, 2, 3]);
  });
});
