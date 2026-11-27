import { describe, expect, it } from "vite-plus/test";
import { isTwoFactorSetupPath, isTwoFactorSetupPending } from "./setup-pending";

describe("two-factor setup sessions", () => {
  it("holds a stamped session until its user turns two-factor on", () => {
    const session = { twoFactorSetupRequired: true };
    expect(
      isTwoFactorSetupPending({ session, user: { twoFactorEnabled: false } }),
    ).toBe(true);
    expect(
      isTwoFactorSetupPending({ session, user: { twoFactorEnabled: true } }),
    ).toBe(false);
    expect(
      isTwoFactorSetupPending({
        session: { twoFactorSetupRequired: false },
        user: { twoFactorEnabled: false },
      }),
    ).toBe(false);
    expect(isTwoFactorSetupPending(null)).toBe(false);
  });

  it("lets a held session reach only the routes for setting up", () => {
    for (const path of [
      "/get-session",
      "/sign-out",
      "/two-factor/enable",
      "/two-factor/verify-totp",
    ]) {
      expect(isTwoFactorSetupPath(path)).toBe(true);
    }
    for (const path of [
      "/api-key/create",
      "/organization/list",
      "/passkey/generate-register-options",
      "/device/approve",
      "/update-user",
    ]) {
      expect(isTwoFactorSetupPath(path)).toBe(false);
    }
  });
});
