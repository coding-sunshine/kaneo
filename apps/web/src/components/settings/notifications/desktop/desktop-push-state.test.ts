import { describe, expect, it } from "vite-plus/test";
import { desktopPushState } from "./desktop-push-state";

const base = {
  supported: true,
  publicKey: "key" as string | null,
  permission: "default" as NotificationPermission,
  subscribed: false,
};

describe("desktopPushState", () => {
  it("is unsupported before anything else", () => {
    expect(desktopPushState({ ...base, supported: false })).toBe("unsupported");
  });

  it("is off on the server without a public key", () => {
    expect(desktopPushState({ ...base, publicKey: null })).toBe("server-off");
  });

  it("is blocked when the browser denied notifications", () => {
    expect(
      desktopPushState({ ...base, permission: "denied", subscribed: true }),
    ).toBe("denied");
  });

  it("is on only with permission and a subscription", () => {
    expect(desktopPushState(base)).toBe("off");
    expect(desktopPushState({ ...base, subscribed: true })).toBe("off");
    expect(
      desktopPushState({ ...base, permission: "granted", subscribed: true }),
    ).toBe("on");
  });
});
