import { describe, expect, it } from "vite-plus/test";
import { brand } from "./index";

describe("brand", () => {
  it("is frozen and has a name", () => {
    expect(Object.isFrozen(brand)).toBe(true);
    expect(brand.name).toBeTruthy();
  });
});
