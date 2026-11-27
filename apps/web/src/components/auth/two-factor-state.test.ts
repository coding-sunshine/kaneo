import { describe, expect, it } from "vite-plus/test";
import { isTwoFactorRedirect, needsTwoFactorSetup } from "./two-factor-state";

describe("two-factor state", () => {
  it("recognises a sign-in answered with a challenge", () => {
    expect(isTwoFactorRedirect({ twoFactorRedirect: true })).toBe(true);
    expect(isTwoFactorRedirect({ token: "t", user: {} })).toBe(false);
    expect(isTwoFactorRedirect(null)).toBe(false);
  });

  it("sends a held session to setup until two-factor is on", () => {
    expect(
      needsTwoFactorSetup({
        session: { twoFactorSetupRequired: true },
        user: { twoFactorEnabled: false },
      }),
    ).toBe(true);
    expect(
      needsTwoFactorSetup({
        session: { twoFactorSetupRequired: true },
        user: { twoFactorEnabled: true },
      }),
    ).toBe(false);
    expect(
      needsTwoFactorSetup({
        session: { twoFactorSetupRequired: false },
        user: { twoFactorEnabled: false },
      }),
    ).toBe(false);
    expect(needsTwoFactorSetup(null)).toBe(false);
  });
});
