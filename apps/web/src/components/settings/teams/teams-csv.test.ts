import { describe, expect, it } from "vite-plus/test";
import { buildTeamsCsv } from "./teams-csv";

describe("buildTeamsCsv", () => {
  it("quotes commas, quotes and newlines", () => {
    const csv = buildTeamsCsv(
      ["Name", "Key"],
      [
        {
          name: 'Ops, "core"',
          key: "OPS",
          description: null,
          visibility: "Workspace",
          issues: 3,
          created: "2026-01-02",
        },
      ],
    );
    expect(csv).toBe('Name,Key\n"Ops, ""core""",OPS,,Workspace,3,2026-01-02');
  });
});
