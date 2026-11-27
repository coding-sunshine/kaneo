import { describe, expect, it } from "vite-plus/test";
import { pagedRows } from "./paged-rows";

describe("pagedRows", () => {
  it("reads page after page from the last cursor until a short page", async () => {
    const rows = Array.from({ length: 7 }, (_, id) => ({ id }));
    const calls: Array<number | null> = [];
    const page = async (after: number | null, size: number) => {
      calls.push(after);
      return rows.filter((row) => row.id > (after ?? -1)).slice(0, size);
    };
    const read: number[] = [];
    for await (const row of pagedRows(page, (row) => row.id, 3))
      read.push(row.id);
    expect(read).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(calls).toEqual([null, 2, 5]);
  });
});
