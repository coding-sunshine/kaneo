import { Editor } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { collabRegistry } from "@/lib/document-collab/collab-registry";
import { CollabSession } from "@/lib/document-collab/collab-session";
import { createFakeCollabServer } from "@/lib/document-collab/fake-collab-server";
import { documentSchemaExtensions } from "./document-schema-extensions";
import { seedFromMarkdown } from "./seed-from-markdown";

const closers: Array<() => void> = [];

async function openEditor(
  server: ReturnType<typeof createFakeCollabServer>,
  name: string,
) {
  const session = new CollabSession(server.transport, seedFromMarkdown);
  const remove = collabRegistry.add("doc-1", session);
  await session.start();
  const editor = new Editor({
    extensions: [
      ...documentSchemaExtensions(),
      Collaboration.configure({ document: session.doc }),
      CollaborationCaret.configure({
        provider: { awareness: session.awareness },
        user: { name, color: "#3366ff" },
      }),
    ],
  });
  closers.push(() => {
    editor.destroy();
    remove();
    session.destroy();
  });
  return editor;
}

afterEach(() => {
  for (const close of closers.splice(0)) close();
  vi.useRealTimers();
});

describe("two people in the same document", () => {
  it("edit one paragraph at once and lose no text, each seeing the other's cursor", async () => {
    vi.useFakeTimers();
    const server = createFakeCollabServer(
      "doc-1",
      "# Plan\n\nWe ship on Friday.",
    );
    const ada = await openEditor(server, "Ada");
    const grace = await openEditor(server, "Grace");
    expect(server.seeds()).toBe(1);
    expect(grace.getText()).toBe(ada.getText());
    expect(ada.getText()).toContain("We ship on Friday.");

    // Both put the cursor after "ship" and type before hearing of the other.
    const after = (editor: Editor, word: string) => {
      let at = -1;
      editor.state.doc.descendants((node, pos) => {
        const index = node.isText ? (node.text ?? "").indexOf(word) : -1;
        if (index >= 0 && at < 0) at = pos + index + word.length;
      });
      return at;
    };
    ada.commands.insertContentAt(after(ada, "ship"), " it");
    grace.commands.insertContentAt(after(grace, "ship"), " soon");
    await vi.advanceTimersByTimeAsync(200);

    expect(ada.getText()).toBe(grace.getText());
    const paragraph = ada
      .getText()
      .split("\n")
      .find((line) => line.startsWith("We"));
    expect(paragraph).toMatch(/^We ship( it soon| soon it) on Friday\.$/);
    expect(ada.getMarkdown()).toBe(grace.getMarkdown());

    const names = (editor: Editor) =>
      (
        editor.storage as unknown as {
          collaborationCaret: { users: Array<{ name: string }> };
        }
      ).collaborationCaret.users
        .map((user) => user.name)
        .sort();
    expect(names(ada)).toEqual(["Ada", "Grace"]);
    expect(names(grace)).toEqual(["Ada", "Grace"]);
  });
});
