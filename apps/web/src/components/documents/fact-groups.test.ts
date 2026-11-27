import { describe, expect, it } from "vite-plus/test";
import type { DocumentReceipt } from "@/fetchers/document/facts";
import { factGroups, openConflicts, waitingCount } from "./fact-groups";

const stated = (id: string, confirmed = false) => ({
  statementId: id,
  slot: `slot-${id}`,
  slotName: `Fact ${id}`,
  type: "term",
  value: "v",
  quote: "quote",
  confirmed,
});
const compared = (id: string, confirmed = false) => ({
  ...stated(id, confirmed),
  current: { documentId: "d", documentTitle: "t", value: "c", quote: "q" },
});
const conflict = (id: string, status: string) => ({ ...compared(id), status });

// The rows carry only what the grouping reads.
const receipt = (over: object) =>
  ({
    conflicts: [],
    unjudged: [],
    new: [],
    repeats: [],
    notChecked: [],
    ...over,
  }) as DocumentReceipt;
const full = receipt({
  conflicts: [conflict("a", "open"), conflict("b", "resolved")],
  unjudged: [compared("c")],
  new: [stated("d"), stated("e", true)],
  repeats: [compared("f"), compared("g", true)],
  notChecked: [{ slot: "s", slotName: "S", type: "date" }],
});

describe("factGroups", () => {
  it("orders the groups for a proposal", () => {
    expect(factGroups(full, false).map((g) => g.key)).toEqual([
      "conflicts",
      "decided",
      "unjudged",
      "new",
      "repeats",
      "notChecked",
    ]);
  });

  it("renames new and repeats on the current document", () => {
    expect(factGroups(full, true).map((g) => g.key)).toEqual([
      "conflicts",
      "decided",
      "unjudged",
      "waiting",
      "stated",
      "notChecked",
    ]);
  });

  it("drops empty groups", () => {
    expect(factGroups(receipt({}), false)).toEqual([]);
    expect(
      factGroups(receipt({ new: [stated("d")] }), true).map((g) => g.key),
    ).toEqual(["waiting"]);
  });

  it("keeps open conflicts apart from decided ones", () => {
    const [open, decided] = factGroups(full, false);
    expect(
      open.rows.map((row) => "statementId" in row && row.statementId),
    ).toEqual(["a"]);
    expect(
      decided.rows.map((row) => "statementId" in row && row.statementId),
    ).toEqual(["b"]);
    expect(openConflicts(full)).toBe(1);
  });
});

describe("waitingCount", () => {
  it("counts the unconfirmed facts the panel offers to confirm", () => {
    // Open conflicts wait for a decision; decided unconfirmed ones can be confirmed.
    expect(waitingCount(full)).toBe(4);
  });
});
