import { describe, expect, it } from "vite-plus/test";
import { documentMarkdown } from "./export-document";

describe("documentMarkdown", () => {
  it("writes a page stored as HTML as Markdown, headings and tables included", () => {
    const html =
      "<h2>Steps</h2><p>Read the <strong>handbook</strong>.</p>" +
      "<table><thead><tr><th>Day</th><th>Task</th></tr></thead>" +
      "<tbody><tr><td>1</td><td>Laptop</td></tr></tbody></table>";

    const markdown = documentMarkdown("Onboarding", html);

    expect(markdown).not.toMatch(/<\/?(h2|p|table|tr|td|th|strong)\b/);
    expect(markdown).toContain("# Onboarding\n\n## Steps");
    expect(markdown).toContain("Read the **handbook**.");
    expect(markdown).toMatch(
      /\| Day \| Task \|\n\| -+ \| -+ \|\n\| 1 \| Laptop \|/,
    );
  });

  it("leaves a page written as Markdown as it is", () => {
    const content =
      "## Steps\n\n| Day | Task |\n| --- | --- |\n| 1 | <b>x</b> |";
    expect(documentMarkdown("Onboarding", content)).toBe(
      `# Onboarding\n\n${content}\n`,
    );
  });
});
