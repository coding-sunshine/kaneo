import { describe, expect, it } from "vite-plus/test";
import { directMessageTitle } from "./direct-message-title";

const names = new Map([
  ["me", "Me"],
  ["b", "Bea"],
  ["c", "Cal"],
]);

describe("directMessageTitle", () => {
  it("names the other people, not the viewer", () => {
    expect(directMessageTitle(["me", "b"], "me", names, "Someone")).toBe("Bea");
    expect(directMessageTitle(["b", "me", "c"], "me", names, "Someone")).toBe(
      "Bea, Cal",
    );
  });

  it("falls back for people who are no longer in the workspace", () => {
    expect(directMessageTitle(["me", "gone"], "me", names, "Someone")).toBe(
      "Someone",
    );
  });
});
