import { expect, it } from "vite-plus/test";
import { localDay } from "./local-day";

it("pads month and day in the local calendar", () => {
  expect(localDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  expect(localDay(new Date(2026, 10, 25, 23, 59))).toBe("2026-11-25");
});
