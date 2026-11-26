import type {
  ComparedFact,
  DocumentReceipt,
  FactConflict,
  MissingFact,
  StatedFact,
} from "@/fetchers/document/facts";

export type FactGroup =
  | { key: "conflicts" | "decided"; rows: FactConflict[] }
  | { key: "unjudged" | "repeats" | "stated"; rows: ComparedFact[] }
  | { key: "new" | "waiting"; rows: StatedFact[] }
  | { key: "notChecked"; rows: MissingFact[] };

export function openConflicts(receipt: DocumentReceipt) {
  return receipt.conflicts.filter((c) => c.status === "open").length;
}

/**
 * Stated facts the panel offers to confirm. A fact in a conflict is left out:
 * the decider settles it with a decision, not with a confirmation.
 */
export function waitingCount(receipt: DocumentReceipt) {
  const { unjudged, new: added, repeats } = receipt;
  return [...unjudged, ...added, ...repeats].filter((fact) => !fact.confirmed)
    .length;
}

/**
 * The non-empty groups in display order. A conflict the decider settled moves
 * to its own group. On the current document a value that is not confirmed sits
 * in `new` and a confirmed one "repeats" itself, so those two read as waiting
 * and stated.
 */
export function factGroups(
  receipt: DocumentReceipt,
  isCurrent: boolean,
): FactGroup[] {
  const groups: FactGroup[] = [
    {
      key: "conflicts",
      rows: receipt.conflicts.filter((c) => c.status === "open"),
    },
    {
      key: "decided",
      rows: receipt.conflicts.filter((c) => c.status !== "open"),
    },
    { key: "unjudged", rows: receipt.unjudged },
    { key: isCurrent ? "waiting" : "new", rows: receipt.new },
    { key: isCurrent ? "stated" : "repeats", rows: receipt.repeats },
    { key: "notChecked", rows: receipt.notChecked },
  ];
  return groups.filter((group) => group.rows.length > 0);
}
