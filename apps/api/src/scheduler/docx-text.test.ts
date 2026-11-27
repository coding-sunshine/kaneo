import { strToU8, zipSync } from "fflate";
import { expect, it } from "vite-plus/test";
import { docxText } from "./docx-text";

const W =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

/** A Word file whose body is the given WordprocessingML, built in the test. */
function docx(body: string) {
  return zipSync({
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    ),
    "word/document.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}</w:body></w:document>`,
    ),
  });
}

const paragraph = (text: string) =>
  `<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

it("reads each paragraph of a Word file as a line", () => {
  const text = docxText(
    docx(
      paragraph("Rent is 4200 a month") +
        `<w:p><w:r><w:t>Lease</w:t></w:r><w:r><w:tab/><w:t>ends in May</w:t></w:r></w:p>` +
        `<w:tbl><w:tr><w:tc>${paragraph("Cell one")}</w:tc><w:tc>${paragraph("Cell two")}</w:tc></w:tr></w:tbl>` +
        `<w:p><w:r><w:delText>deleted words</w:delText></w:r></w:p>`,
    ),
  );
  expect(text.split("\n")).toEqual([
    "Rent is 4200 a month",
    "Lease\tends in May",
    "Cell one",
    "Cell two",
  ]);
  expect(text).not.toContain("Normal");
  expect(text).not.toContain("deleted");
});

it("decodes the XML entities of a Word file once", () => {
  expect(
    docxText(
      docx(paragraph("Q&amp;A &lt;b&gt; &quot;x&apos; &#65;&#x42; &amp;lt;")),
    ),
  ).toBe(`Q&A <b> "x' AB &lt;`);
});

it("refuses a Word file whose text unpacks past the cap", () => {
  const huge = paragraph("a".repeat(21_000_000));
  expect(() => docxText(docx(huge))).toThrow();
});

it("refuses a Word file whose text unpacks past its stated size", () => {
  const file = docx(paragraph("a".repeat(1_000_000)));
  const view = new DataView(file.buffer);
  for (let at = 0; at < file.length - 4; at++) {
    if (view.getUint32(at, true) === 0x02014b50) {
      view.setUint32(at + 24, 100, true);
    }
  }
  expect(() => docxText(file)).toThrow();
});

it("refuses bytes that are not a Word file", () => {
  expect(() => docxText(strToU8("not a zip"))).toThrow();
  expect(() => docxText(zipSync({ "notes.txt": strToU8("hi") }))).toThrow();
});
