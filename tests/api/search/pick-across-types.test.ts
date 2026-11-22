import { describe, expect, it } from "vite-plus/test";
import { pickAcrossTypes } from "../../../apps/api/src/search/pick-across-types";

const make = (type: string, count: number, score: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${type}-${index}`,
    type,
    score,
  }));

describe("pickAcrossTypes", () => {
  it("keeps comments and documents when issues outnumber the limit", () => {
    const sorted = [
      ...make("task", 25, 5),
      ...make("comment", 2, 1),
      ...make("document", 1, 1),
    ];
    const picked = pickAcrossTypes(sorted, 20);

    expect(picked).toHaveLength(20);
    expect(picked.filter((r) => r.type === "comment")).toHaveLength(2);
    expect(picked.filter((r) => r.type === "document")).toHaveLength(1);
    expect(picked.filter((r) => r.type === "task")).toHaveLength(17);
    // Relevance order survives: every task still ranks above the comments.
    expect(picked.slice(0, 17).every((r) => r.type === "task")).toBe(true);
  });

  it("fills every slot from one type when it is the only match", () => {
    expect(pickAcrossTypes(make("task", 30, 1), 20)).toHaveLength(20);
  });

  it("never returns more than the limit", () => {
    const sorted = [
      ...make("task", 3, 3),
      ...make("comment", 3, 2),
      ...make("document", 3, 1),
    ];
    expect(pickAcrossTypes(sorted, 5).map((r) => r.id)).toEqual([
      "task-0",
      "task-1",
      "task-2",
      "comment-0",
      "comment-1",
    ]);
  });
});
