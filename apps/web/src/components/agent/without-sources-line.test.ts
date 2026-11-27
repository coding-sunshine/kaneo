import { describe, expect, it } from "vite-plus/test";
import { withoutSourcesLine } from "./without-sources-line";

describe("withoutSourcesLine", () => {
  it("drops the last line naming the sources", () => {
    expect(withoutSourcesLine("It waits on BETA-2.\n\nSources: task:a1")).toBe(
      "It waits on BETA-2.",
    );
    expect(withoutSourcesLine("Done.\n**Sources:** none")).toBe("Done.");
  });

  it("keeps a text without that line", () => {
    expect(withoutSourcesLine("Sources: are listed.\nThe end.")).toBe(
      "Sources: are listed.\nThe end.",
    );
    expect(withoutSourcesLine("Done.\nSources say it is late.")).toBe(
      "Done.\nSources say it is late.",
    );
  });
});
