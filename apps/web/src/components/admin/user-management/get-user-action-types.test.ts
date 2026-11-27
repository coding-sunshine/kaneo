import { describe, expect, it } from "vite-plus/test";
import { getUserActionTypes } from "./get-user-action-types";

const options = {
  isSelf: false,
  canSendPasswordReset: true,
  permissions: ["users:credentials", "users:disable", "users:delete"] as const,
};

describe("getUserActionTypes", () => {
  it("offers verification actions only for unverified addresses", () => {
    expect(
      getUserActionTypes(
        {
          isAnonymous: false,
          emailVerified: true,
          banned: false,
          twoFactorEnabled: false,
        },
        options,
      ),
    ).toEqual(["sendPasswordReset", "deactivate", "delete"]);
    expect(
      getUserActionTypes(
        {
          isAnonymous: false,
          emailVerified: false,
          banned: true,
          twoFactorEnabled: false,
        },
        options,
      ),
    ).toEqual([
      "sendPasswordReset",
      "sendVerification",
      "markEmailVerified",
      "reactivate",
      "delete",
    ]);
  });

  it("omits every email action for guests", () => {
    expect(
      getUserActionTypes(
        {
          isAnonymous: true,
          emailVerified: false,
          banned: false,
          twoFactorEnabled: false,
        },
        options,
      ),
    ).toEqual(["deactivate", "delete"]);
  });

  it("never offers deactivating or deleting yourself", () => {
    expect(
      getUserActionTypes(
        {
          isAnonymous: false,
          emailVerified: true,
          banned: false,
          twoFactorEnabled: false,
        },
        { ...options, isSelf: true },
      ),
    ).toEqual(["sendPasswordReset"]);
  });

  it("hides reset links when password sign-in is off", () => {
    expect(
      getUserActionTypes(
        {
          isAnonymous: false,
          emailVerified: true,
          banned: false,
          twoFactorEnabled: false,
        },
        { ...options, canSendPasswordReset: false },
      ),
    ).toEqual(["deactivate", "delete"]);
  });

  it("offers a two-factor reset only when it is on", () => {
    const user = {
      isAnonymous: false,
      emailVerified: true,
      banned: false,
      twoFactorEnabled: true,
    };
    expect(getUserActionTypes(user, options)).toEqual([
      "sendPasswordReset",
      "resetTwoFactor",
      "deactivate",
      "delete",
    ]);
    expect(
      getUserActionTypes(user, { ...options, permissions: ["users:disable"] }),
    ).toEqual(["deactivate"]);
  });

  it("offers only the actions the viewer has permission for", () => {
    expect(
      getUserActionTypes(
        {
          isAnonymous: false,
          emailVerified: false,
          banned: false,
          twoFactorEnabled: false,
        },
        { ...options, permissions: ["users:disable"] },
      ),
    ).toEqual(["deactivate"]);
  });
});
