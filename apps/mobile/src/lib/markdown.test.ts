import { describe, expect, it, vi } from "vite-plus/test";

import { toDisplayMarkdown } from "./markdown";

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("./api/client", () => ({
  resolveUrl: (_server: string, path?: string | null) => path ?? null,
}));

describe("toDisplayMarkdown", () => {
  it("rewrites issue links in both tag forms without leftovers", () => {
    const url = "https://kaneo.example/task/1";
    const attrs = `url="${url}" issue-key="KAN-3" task-id="1"`;
    expect(
      toDisplayMarkdown(
        `- <kaneo-issue-link ${attrs}></kaneo-issue-link> next\n\n<kaneo-issue-link ${attrs} />`,
        "",
      ),
    ).toBe(`- [KAN-3](${url}) next\n\n[KAN-3](${url})`);
  });
});
