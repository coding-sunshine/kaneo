import { describe, expect, it } from "vite-plus/test";
import { localDayRange, toDateInput } from "./local-day-range";

describe("localDayRange", () => {
  it("runs from the start of the first local day to the end of the last", () => {
    const { from, until } = localDayRange("2026-11-30", "2026-12-04");

    expect(new Date(from).getTime()).toBe(
      new Date(2026, 10, 30, 0, 0, 0, 0).getTime(),
    );
    expect(new Date(until).getTime()).toBe(
      new Date(2026, 11, 4, 23, 59, 59, 999).getTime(),
    );
  });

  it("reads an instant back as the local calendar day", () => {
    const { from, until } = localDayRange("2026-11-30", "2026-12-04");

    expect(toDateInput(from)).toBe("2026-11-30");
    expect(toDateInput(until)).toBe("2026-12-04");
  });
});
