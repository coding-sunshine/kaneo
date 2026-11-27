import { strFromU8 } from "fflate";
import { zipEntries } from "./zip-entries";

const DOCUMENT = "word/document.xml";
// The body of a Word file is unpacked up to this size, and read whole. Its
// text is a few times smaller than its XML.
const MAX_DOCX_XML_BYTES = 200_000_000;

// A run of text, a paragraph end, a tab or a line break. `<w:t` followed by a
// space or `>` only: `<w:tbl>`, `<w:tab/>` and `<w:tr>` are not text.
const PART =
  /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<\/w:p>|<w:(tab|br|cr)\b[^>]*\/>/g;
const ENTITY = /&(#x[0-9a-f]+|#\d+|lt|gt|quot|apos|amp);/gi;
const NAMED: Record<string, string> = {
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  amp: "&",
};

const decode = (text: string) =>
  text.replace(ENTITY, (_, name: string) => {
    if (name[0] !== "#") return NAMED[name.toLowerCase()] ?? "";
    const code =
      name[1] === "x" || name[1] === "X"
        ? Number.parseInt(name.slice(2), 16)
        : Number.parseInt(name.slice(1), 10);
    return code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });

/**
 * The words of a Word file, one paragraph per line. Reads the bytes only, and
 * unpacks nothing but the body. Throws on bytes that are not a Word file, or a
 * body that is larger than the cap.
 */
export function docxText(bytes: Uint8Array) {
  const body = [...zipEntries(bytes)].find(({ path }) => path === DOCUMENT);
  if (!body) throw new Error("Not a Word file");
  // Checked against the declared size, before anything is inflated; the body
  // stops unpacking when it passes that size.
  if (body.size > MAX_DOCX_XML_BYTES) {
    throw new Error("The Word file is too large to read");
  }
  const xml = body.open();
  let text = "";
  for (const [, words, mark] of strFromU8(xml).matchAll(PART)) {
    if (words !== undefined) text += decode(words);
    else if (mark === "tab") text += "\t";
    else text += "\n";
  }
  return text.trim();
}
