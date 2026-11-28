import { describe, expect, it } from "vite-plus/test";

import { groupMessages } from "./message-groups";

const msg = (id: string, userId: string | null, createdAt: string) => ({
  id,
  userId,
  createdAt,
});

describe("groupMessages", () => {
  it("shows the author once for a run of quick messages", () => {
    const rows = groupMessages([
      msg("1", "writer", "2026-11-28T10:00:00.000Z"),
      msg("2", "writer", "2026-11-28T10:02:00.000Z"),
      msg("3", "reader", "2026-11-28T10:03:00.000Z"),
      msg("4", "reader", "2026-11-28T10:20:00.000Z"),
    ]);
    expect(rows.map((r) => [r.message.id, r.showAuthor])).toEqual([
      ["1", true],
      ["2", false],
      ["3", true],
      ["4", true],
    ]);
  });
});
