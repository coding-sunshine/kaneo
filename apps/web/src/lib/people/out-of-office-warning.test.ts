import { describe, expect, it } from "vite-plus/test";
import { warnsOutOfOffice } from "./out-of-office-warning";

const range = {
  from: "2026-11-30T00:00:00.000Z",
  until: "2026-12-04T23:59:59.999Z",
};
const before = new Date("2026-11-28T09:00:00.000Z");
const during = new Date("2026-12-02T09:00:00.000Z");
const after = new Date("2026-12-05T09:00:00.000Z");

describe("warnsOutOfOffice", () => {
  it("does not warn without a range or after it ended", () => {
    expect(warnsOutOfOffice(null, null, before)).toBe(false);
    expect(warnsOutOfOffice(range, null, after)).toBe(false);
    expect(warnsOutOfOffice(range, "2026-12-02", after)).toBe(false);
  });

  it("warns during the range whatever the due date", () => {
    expect(warnsOutOfOffice(range, null, during)).toBe(true);
    expect(warnsOutOfOffice(range, "2027-01-15", during)).toBe(true);
  });

  it("warns ahead of the range when the ticket is due in it or has no due date", () => {
    expect(warnsOutOfOffice(range, null, before)).toBe(true);
    expect(warnsOutOfOffice(range, "2026-12-03T00:00:00.000Z", before)).toBe(
      true,
    );
    expect(warnsOutOfOffice(range, "2026-11-29T12:00:00.000Z", before)).toBe(
      false,
    );
    expect(warnsOutOfOffice(range, "2026-12-10T12:00:00.000Z", before)).toBe(
      false,
    );
  });
});
