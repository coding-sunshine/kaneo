import { describe, expect, it } from "vite-plus/test";
import { asksForStatus } from "./status-guard";

describe("asksForStatus", () => {
  it("accepts a status the person named in their own words", () => {
    expect(asksForStatus("Move SLUG-3 to done please", "done")).toBe(true);
    expect(asksForStatus("set it In Progress", "in-progress")).toBe(true);
    expect(asksForStatus("set it to in_review", "in-review")).toBe(true);
  });

  it("refuses a status the person did not name", () => {
    expect(asksForStatus("Set priority to high and label it bug", "done")).toBe(
      false,
    );
    expect(asksForStatus("this is undone work", "done")).toBe(false);
    expect(asksForStatus("", "done")).toBe(false);
  });
});
