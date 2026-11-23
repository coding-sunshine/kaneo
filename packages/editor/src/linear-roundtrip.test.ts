import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createBaseExtensions } from "./base-extensions";
import fixtures from "./fixtures/linear-descriptions.json";

let editor: Editor | null = null;
afterEach(() => editor?.destroy());

function roundTrip(markdown: string) {
  editor = new Editor({
    extensions: createBaseExtensions({ placeholder: "" }),
    content: markdown,
    contentType: "markdown",
  });
  return editor.getMarkdown();
}

const images = (md: string) =>
  md.match(/!\[[^\]]*\]\([^)]*\)|<img\b[^>]*>/g) ?? [];
const links = (md: string) =>
  (md.match(/(?<!!)\[[^\]]*\]\([^)]*\)/g) ?? []).length;
const words = (md: string) =>
  md
    .replace(/!\[[^\]]*\]\([^)]*\)|<img\b[^>]*>/g, " ")
    .replace(/\]\([^)]*\)/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean).length;

describe("Linear descriptions survive a markdown round-trip", () => {
  for (const [key, source] of Object.entries(fixtures)) {
    it(`${key} keeps images, links and words`, () => {
      const out = roundTrip(source);
      expect(images(out).length).toBe(images(source).length);
      expect(links(out)).toBe(links(source));
      expect(words(out)).toBeGreaterThanOrEqual(words(source));
    });
  }
});
