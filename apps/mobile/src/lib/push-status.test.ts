import { describe, expect, it } from "vite-plus/test";

import { pushStatus } from "./push-status";

describe("pushStatus", () => {
  it("is on when the server delivers to the registered phone", () => {
    expect(
      pushStatus({ credentialType: "bearer", token: "t", delivering: true }),
    ).toBe("on");
  });

  it("is off on the server until the operator adds the key", () => {
    expect(
      pushStatus({ credentialType: "bearer", token: "t", delivering: false }),
    ).toBe("serverOff");
  });

  it("needs a password or browser sign-in, not an API key", () => {
    expect(
      pushStatus({ credentialType: "apiKey", token: "t", delivering: true }),
    ).toBe("needsSession");
  });

  it("is unavailable when the phone has no push token", () => {
    expect(
      pushStatus({ credentialType: "bearer", token: null, delivering: null }),
    ).toBe("noToken");
  });
});
