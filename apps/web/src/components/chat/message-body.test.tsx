import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { MessageBody } from "./message-body";

const { codeToTokens } = vi.hoisted(() => ({
  codeToTokens: vi.fn((code: string) => ({
    tokens: code
      .split("\n")
      .map((line) => [{ content: line, color: "#ff0000" }]),
  })),
}));
vi.mock("@/lib/shiki-highlighter", () => ({
  getSharedShikiHighlighter: async () => ({
    getLoadedLanguages: () => ["typescript"],
    loadLanguage: vi.fn(),
    codeToTokens,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const body = [
  "Plan for **today**:",
  "- ship it",
  "- test it",
  "```ts",
  "const a: number = 1;",
  "const b = a + 1;",
  "export { b };",
  "```",
].join("\n");

describe("MessageBody", () => {
  it("renders bold text and a bulleted list", () => {
    const { container } = render(<MessageBody body={body} workspaceId="ws" />);
    expect(container.querySelector("strong")).toHaveTextContent("today");
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "ship it",
      "test it",
    ]);
  });

  it("renders a fenced block as coloured monospaced code with a copy button", async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    const { container } = render(<MessageBody body={body} workspaceId="ws" />);
    const code = container.querySelector("pre > code");
    expect(code).toHaveClass("language-ts");
    expect(code?.textContent).toBe(
      "const a: number = 1;\nconst b = a + 1;\nexport { b };",
    );
    expect(await screen.findByText("const b = a + 1;")).toHaveStyle({
      color: "#ff0000",
    });
    expect(codeToTokens).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ lang: "typescript" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:chat.copyCode" }),
    );
    expect(writeText).toHaveBeenCalledWith(code?.textContent);
  });

  it("renders a quote", () => {
    const { container } = render(
      <MessageBody body={"> quoted\nreply"} workspaceId="ws" />,
    );
    expect(container.querySelector("blockquote")).toHaveTextContent("quoted");
  });

  it("shows a pasted script tag as text and never runs it", () => {
    const script = "<script>window.__chatPwned = true</script>";
    const { container } = render(
      <MessageBody
        body={`${script}\n\`\`\`html\n${script}\n\`\`\``}
        workspaceId="ws"
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getAllByText(script, { exact: false })).toHaveLength(2);
    expect((window as { __chatPwned?: boolean }).__chatPwned).toBeUndefined();
  });

  it("keeps a plain message's line breaks", () => {
    const { container } = render(
      <MessageBody body={"one\ntwo"} workspaceId="ws" />,
    );
    expect(container.textContent).toBe("one\ntwo");
  });
});
