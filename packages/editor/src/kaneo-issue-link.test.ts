import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createBaseExtensions } from "./base-extensions";

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

const ISSUE_LINK = {
  type: "kaneoIssueLink",
  attrs: {
    url: "https://kaneo.example/dashboard/workspace/w1/project/p1/task/t1",
    issueKey: "KAN-1",
    taskId: "t1",
  },
};

function roundTrip(content: JSONContent[]) {
  editor = new Editor({
    extensions: createBaseExtensions({ placeholder: "" }),
  });
  editor.commands.setContent({ type: "doc", content });
  const markdown = editor.getMarkdown();
  editor.commands.setContent(markdown, { contentType: "markdown" });
  return { markdown, json: editor.getJSON(), again: editor.getMarkdown() };
}

function item(type: string, text: string, extra = {}) {
  return {
    type,
    ...extra,
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }, ISSUE_LINK],
      },
    ],
  };
}

function chipOnly(nested: JSONContent[] = []): JSONContent {
  return {
    type: "listItem",
    content: [{ type: "paragraph", content: [ISSUE_LINK] }, ...nested],
  };
}

describe("KaneoIssueLink in lists", () => {
  it("stays inside its checklist item after save", () => {
    const { json, markdown, again } = roundTrip([
      {
        type: "taskList",
        content: [
          item("taskItem", "Fix ", { attrs: { checked: false } }),
          item("taskItem", "Ship ", { attrs: { checked: true } }),
        ],
      },
    ]);

    expect(json.content).toHaveLength(1);
    const items = json.content?.[0]?.content ?? [];
    expect(items.map((node) => node.type)).toEqual(["taskItem", "taskItem"]);
    expect(items.map((node) => node.attrs?.checked)).toEqual([false, true]);
    for (const [index, text] of ["Fix", "Ship"].entries()) {
      const inline = items[index]?.content?.[0]?.content ?? [];
      expect(inline[0]?.text?.trim()).toBe(text);
      expect(inline.at(-1)).toMatchObject(ISSUE_LINK);
    }
    expect(again).toBe(markdown);
  });

  it("stays inside its bullet item after save", () => {
    const { json } = roundTrip([
      {
        type: "bulletList",
        content: [item("listItem", "One "), item("listItem", "Two ")],
      },
    ]);

    expect(json.content).toHaveLength(1);
    const items = json.content?.[0]?.content ?? [];
    expect(items).toHaveLength(2);
    for (const listItem of items) {
      expect(listItem.content?.[0]?.content?.at(-1)).toMatchObject(ISSUE_LINK);
    }
  });

  it("keeps text after the chip and nested lists under a chip-only item", () => {
    const after = {
      type: "listItem",
      content: [
        {
          type: "paragraph",
          content: [ISSUE_LINK, { type: "text", text: " blocks release" }],
        },
      ],
    };
    const { json, markdown, again } = roundTrip([
      {
        type: "bulletList",
        content: [
          chipOnly([{ type: "bulletList", content: [chipOnly(), after] }]),
        ],
      },
    ]);

    expect(json.content).toHaveLength(1);
    const outer = json.content?.[0]?.content ?? [];
    expect(outer).toHaveLength(1);
    expect(outer[0]?.content?.[0]?.content).toEqual([ISSUE_LINK]);
    const nested = outer[0]?.content?.[1];
    expect(nested?.type).toBe("bulletList");
    expect(nested?.content?.[0]?.content?.[0]?.content).toEqual([ISSUE_LINK]);
    expect(nested?.content?.[1]?.content?.[0]?.content).toEqual([
      ISSUE_LINK,
      { type: "text", text: " blocks release" },
    ]);
    expect(again).toBe(markdown);
  });
});
