import { describe, expect, it } from "vite-plus/test";
import { memberStatusHint } from "./member-status-hint";

const away = { from: "2026-11-30T00:00:00Z", until: "2026-12-04T23:59:59Z" };

describe("memberStatusHint", () => {
  it("is empty without a status or a range", () => {
    expect(memberStatusHint(undefined, "Out of office")).toBeUndefined();
    expect(
      memberStatusHint({ status: null, outOfOffice: null }, "Out of office"),
    ).toBeUndefined();
  });

  it("shows the status, the range, or both", () => {
    const status = { text: "In a meeting", clearsAt: null };
    expect(
      memberStatusHint({ status, outOfOffice: null }, "Out of office"),
    ).toBe("In a meeting");
    expect(
      memberStatusHint({ status: null, outOfOffice: away }, "Out of office"),
    ).toBe("Out of office");
    expect(
      memberStatusHint({ status, outOfOffice: away }, "Out of office"),
    ).toBe("In a meeting · Out of office");
  });
});
