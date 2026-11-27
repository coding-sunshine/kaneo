import { expect, it } from "vite-plus/test";
import { fileKind, fileText, pdfText } from "./task-file-text";

it("reads text, HTML and PDF files, and nothing else", () => {
  expect(fileKind("notes.md", "application/octet-stream")).toBe("text");
  expect(fileKind("export", "text/plain")).toBe("text");
  expect(fileKind("page.HTML", "application/octet-stream")).toBe("html");
  expect(fileKind("page", "text/html")).toBe("html");
  expect(fileKind("scan.pdf", "application/octet-stream")).toBe("pdf");
  expect(fileKind("scan", "application/pdf")).toBe("pdf");
  expect(fileKind("brief.docx", "application/octet-stream")).toBeNull();
  expect(fileKind("bundle.zip", "application/zip")).toBeNull();
});

it("leaves scripts, styles and tags out of an HTML file", () => {
  const text = fileText(
    "html",
    "<style>p { color: red }</style><p>Rent is <b>4200</b></p><script>let hidden = 1</script >",
  );
  expect(text).toContain("Rent is");
  expect(text).toContain("4200");
  for (const gone of ["color", "hidden", "<p>", "<b>"]) {
    expect(text).not.toContain(gone);
  }
  expect(fileText("text", "<p>kept as written</p>")).toBe(
    "<p>kept as written</p>",
  );
});

/** A PDF with one line of text on each page, built by hand. */
function pdf(pages: string[]) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...pages.flatMap((line, i) => {
      const stream = `BT /F1 12 Tf 72 720 Td (${line}) Tj ET`;
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      ];
    }),
  ];
  let out = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const at of offsets) out += `${String(at).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

it("reads the text of a PDF", async () => {
  const text = await pdfText(
    pdf(["Rent is 4200 a month", "Lease ends in May"]),
  );
  expect(text).toContain("Rent is 4200 a month");
  expect(text).toContain("Lease ends in May");
});

it("reads a capped number of PDF pages", async () => {
  const pages = Array.from({ length: 60 }, (_, i) => `Page ${i + 1} here`);
  const text = await pdfText(pdf(pages));
  expect(text).toContain("Page 50 here");
  expect(text).not.toContain("Page 51 here");
});

it("refuses bytes that are not a PDF", async () => {
  await expect(
    pdfText(new TextEncoder().encode("not a pdf")),
  ).rejects.toThrow();
});
