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

  it("keeps a document's pipe table and turns its page and issue links into links", () => {
    const table = [
      "| Name  | Status |",
      "| ----- | ------ |",
      "| Board | Done   |",
    ].join("\n");
    const page = "https://kaneo.example/workspace/w/documents/d1";
    const issue = "https://kaneo.example/task/1";
    expect(
      toDisplayMarkdown(
        `${table}\n\n<kaneo-document-link url="${page}" />\n\n<kaneo-issue-link url="${issue}" issue-key="KAN-3" task-id="1" />`,
        "",
      ),
    ).toBe(`${table}\n\n[${page}](${page})\n\n[KAN-3](${issue})`);
  });
});
