import { describe, expect, it } from "vite-plus/test";
import { guestAllows } from "./guest-permissions";

describe("guestAllows", () => {
  it("lets a guest work on tasks", () => {
    expect(guestAllows({ task: ["update"] })).toBe(true);
    expect(guestAllows({ workspace: ["read"] })).toBe(true);
  });

  it("refuses anything that widens reach or manages people", () => {
    expect(guestAllows({ project: ["create"] })).toBe(false);
    expect(guestAllows({ invitation: ["create"] })).toBe(false);
    expect(guestAllows({ member: ["update"] })).toBe(false);
    expect(guestAllows({ workspace: ["manage_settings"] })).toBe(false);
  });
});
