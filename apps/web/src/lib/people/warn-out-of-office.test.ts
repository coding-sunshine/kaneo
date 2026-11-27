import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { warnOutOfOffice } from "./warn-out-of-office";

const { warning } = vi.hoisted(() => ({ warning: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: { warning } }));

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString();

afterEach(() => vi.clearAllMocks());

describe("warnOutOfOffice", () => {
  it("warns when the new assignee will be away", () => {
    warnOutOfOffice(
      {
        name: "Avery",
        profile: { outOfOffice: { from: inDays(2), until: inDays(6) } },
      },
      null,
    );
    expect(warning).toHaveBeenCalledOnce();
  });

  it("stays quiet when the assignee is not away", () => {
    warnOutOfOffice({ name: "Avery", profile: { outOfOffice: null } }, null);
    warnOutOfOffice({ name: "Blake" }, null);
    warnOutOfOffice(
      {
        name: "Casey",
        profile: { outOfOffice: { from: inDays(2), until: inDays(6) } },
      },
      inDays(20),
    );
    expect(warning).not.toHaveBeenCalled();
  });
});
