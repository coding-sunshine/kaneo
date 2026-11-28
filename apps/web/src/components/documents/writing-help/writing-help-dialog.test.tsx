import { createBaseExtensions } from "@kaneo/editor";
import { Editor } from "@tiptap/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { WritingHelpDialog } from "./writing-help-dialog";

const m = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/hooks/mutations/agent/use-writing-help", () => ({
  useWritingHelp: () => ({
    mutate: m.mutate,
    isPending: false,
    isError: false,
    data: { text: "The launch moves." },
  }),
}));

let editor: Editor | null = null;
afterEach(() => {
  cleanup();
  editor?.destroy();
  m.mutate.mockReset();
});

const ORIGINAL = "We met and agreed to move the launch.";

function open() {
  editor = new Editor({
    extensions: createBaseExtensions({ placeholder: "" }),
    content: `<p>${ORIGINAL}</p>`,
  });
  const range = { from: 1, to: 1 + ORIGINAL.length };
  const onClose = vi.fn();
  render(
    <WritingHelpDialog
      workspaceId="w1"
      editor={editor}
      action="shorten"
      range={range}
      onClose={onClose}
    />,
  );
  return { onClose, current: editor };
}

describe("WritingHelpDialog", () => {
  it("asks for the rewrite of the selection and shows it as a diff", () => {
    open();
    expect(m.mutate).toHaveBeenCalledWith({
      action: "shorten",
      text: ORIGINAL,
    });
    expect(
      screen.getByLabelText("navigation:documents.writing.diff").textContent,
    ).toContain("moves.");
  });

  it("replaces the selection on Accept", () => {
    const { onClose, current } = open();
    fireEvent.click(
      screen.getByRole("button", {
        name: "navigation:documents.writing.accept",
      }),
    );
    expect(current.getText()).toBe("The launch moves.");
    expect(onClose).toHaveBeenCalled();
  });

  it("changes nothing on Decline", () => {
    const { onClose, current } = open();
    fireEvent.click(
      screen.getByRole("button", {
        name: "navigation:documents.writing.decline",
      }),
    );
    expect(current.getText()).toBe(ORIGINAL);
    expect(onClose).toHaveBeenCalled();
  });
});
