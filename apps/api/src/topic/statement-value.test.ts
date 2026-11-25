import { describe, expect, it } from "vite-plus/test";
import { normalizeValue } from "./statement-value";

describe("normalizeValue", () => {
  it("reads a date in the forms people write it", () => {
    expect(normalizeValue("date", "5 March 2027")).toBe("2027-03-05");
    expect(normalizeValue("date", "March 5th, 2027")).toBe("2027-03-05");
    expect(normalizeValue("date", "2027-3-5")).toBe("2027-03-05");
    expect(normalizeValue("date", "5 Mar")).toBe("03-05");
  });

  it("keeps a date it cannot read as text", () => {
    expect(normalizeValue("date", "End of  Q2")).toBe("end of q2");
    expect(normalizeValue("date", "the market opens")).toBe("the market opens");
  });

  it("reads numbers and amounts", () => {
    expect(normalizeValue("number", "1,200 seats")).toBe("1200");
    expect(normalizeValue("number", "40.50")).toBe("40.5");
    expect(normalizeValue("money", "$1,200")).toBe("1200 USD");
    expect(normalizeValue("money", "1200 USD")).toBe("1200 USD");
    expect(normalizeValue("money", "40 per seat")).toBe("40");
    expect(normalizeValue("money", "EUR 40")).not.toBe(
      normalizeValue("money", "USD 40"),
    );
  });

  it("accepts only yes or no for a bool", () => {
    expect(normalizeValue("bool", "Yes")).toBe("true");
    expect(normalizeValue("bool", "false")).toBe("false");
    expect(normalizeValue("bool", "maybe")).toBeNull();
  });

  it("accepts only an option for an enum, whatever its case", () => {
    expect(normalizeValue("enum", "Stripe", ["stripe", "Adyen"])).toBe(
      "stripe",
    );
    expect(normalizeValue("enum", "PayPal", ["stripe", "Adyen"])).toBeNull();
    expect(normalizeValue("enum", "stripe")).toBeNull();
  });

  it("compares people and terms as lower-case text", () => {
    expect(normalizeValue("person", "  Ada   Lovelace ")).toBe("ada lovelace");
    expect(normalizeValue("term", "Net 30")).toBe("net 30");
    expect(normalizeValue("term", "   ")).toBeNull();
  });
});
