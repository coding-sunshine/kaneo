import { describe, expect, it } from "vite-plus/test";
import { addDecisionLine } from "./decision-line";

const LINE = "- 2026-03-03: We launch in March.";

describe("addDecisionLine", () => {
  it("starts the list above the text of a document that has none", () => {
    expect(addDecisionLine("", LINE)).toBe(`## Decisions\n\n${LINE}`);
    expect(addDecisionLine("# Plan\n\nDraft.", LINE)).toBe(
      `## Decisions\n\n${LINE}\n\n# Plan\n\nDraft.`,
    );
  });

  it("puts the newest decision first in a list that is there", () => {
    const before = "# Plan\n\n## Decisions\n\n- 2026-01-05: Older.\n\nDraft.";
    expect(addDecisionLine(before, LINE)).toBe(
      `# Plan\n\n## Decisions\n\n${LINE}\n- 2026-01-05: Older.\n\nDraft.`,
    );
  });

  it("keeps a gap before text that is not a list", () => {
    expect(addDecisionLine("## Decisions\nNone yet.\n\nDraft.", LINE)).toBe(
      `## Decisions\n\n${LINE}\n\nNone yet.\n\nDraft.`,
    );
    expect(addDecisionLine("Draft.\n\n# decisions\n\n", LINE)).toBe(
      `Draft.\n\n# decisions\n\n${LINE}`,
    );
  });
});
