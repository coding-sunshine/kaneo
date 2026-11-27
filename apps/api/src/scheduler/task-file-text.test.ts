import { gzipSync, strToU8, zipSync } from "fflate";
import { expect, it } from "vite-plus/test";
import { fileKind, fileText, pdfText, readFileText } from "./task-file-text";

it("reads text, HTML, PDF, Word and archive files, and nothing else", () => {
  expect(fileKind("notes.md", "application/octet-stream")).toBe("text");
  expect(fileKind("export", "text/plain")).toBe("text");
  expect(fileKind("page.HTML", "application/octet-stream")).toBe("html");
  expect(fileKind("page", "text/html")).toBe("html");
  expect(fileKind("scan.pdf", "application/octet-stream")).toBe("pdf");
  expect(fileKind("scan", "application/pdf")).toBe("pdf");
  expect(fileKind("brief.docx", "application/octet-stream")).toBe("docx");
  expect(fileKind("brief.docx", "application/zip")).toBe("docx");
  expect(
    fileKind(
      "brief",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
  ).toBe("docx");
  for (const name of ["bundle.zip", "notes.txt.gz", "src.tgz", "src.tar.gz"]) {
    expect(fileKind(name, "application/octet-stream")).toBe("archive");
  }
  expect(fileKind("bundle", "application/zip")).toBe("archive");
  expect(fileKind("bundle", "application/gzip")).toBe("archive");
  expect(fileKind("bundle.7z", "application/x-7z-compressed")).toBeNull();
  expect(fileKind("photo.heic", "image/heic")).toBeNull();
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

/** A Word file with the given body, built in the test. */
const docx = (body: string) =>
  zip({
    "word/document.xml": `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  });

/** A tar file (ustar headers, no checksums), built by hand. */
function tar(files: Record<string, string | Uint8Array>) {
  const blocks: Uint8Array[] = [];
  for (const [name, content] of Object.entries(files)) {
    const body = typeof content === "string" ? strToU8(content) : content;
    const header = new Uint8Array(512);
    header.set(strToU8(name), 0);
    header.set(strToU8(`${body.length.toString(8).padStart(11, "0")}\0`), 124);
    header[156] = 0x30;
    header.set(strToU8("ustar\u000000"), 257);
    blocks.push(
      header,
      body,
      new Uint8Array((512 - (body.length % 512)) % 512),
    );
  }
  blocks.push(new Uint8Array(1024));
  const out = new Uint8Array(blocks.reduce((sum, b) => sum + b.length, 0));
  let at = 0;
  for (const block of blocks) {
    out.set(block, at);
    at += block.length;
  }
  return out;
}

const zip = (files: Record<string, string | Uint8Array>) =>
  zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, content]) => [
        name,
        typeof content === "string" ? strToU8(content) : content,
      ]),
    ),
  );

it("reads the text members of an archive, each under its path", async () => {
  const archive = gzipSync(
    tar({
      "notes.txt": "Rent is 4200 a month",
      "photo.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      "docs/brief.docx": docx(
        "<w:p><w:r><w:t>Lease ends in May</w:t></w:r></w:p>",
      ),
      "inner.zip": zip({ "page.html": "<p>Launch is <b>June</b></p>" }),
    }),
  );
  const text = await readFileText("archive", archive, "bundle.tar.gz");
  expect(text).toContain("File notes.txt:\nRent is 4200 a month");
  expect(text).toContain("File docs/brief.docx:\nLease ends in May");
  expect(text).toContain("File inner.zip/page.html:");
  expect(text).toContain("Launch is");
  expect(text).not.toContain("<b>");
  expect(text).not.toContain("photo.png");
});

it("reads a gzipped file under its own name", async () => {
  const text = await readFileText(
    "archive",
    gzipSync(strToU8("Rent is 4200 a month")),
    "notes.txt.gz",
  );
  expect(text).toBe("File notes.txt:\nRent is 4200 a month");
});

it("finds no text in an archive with nothing readable", async () => {
  expect(
    await readFileText("archive", zip({ "photo.png": "x" }), "bundle.zip"),
  ).toBe("");
});

it("refuses an archive with too many entries", async () => {
  const files = Object.fromEntries(
    Array.from({ length: 201 }, (_, i) => [`f${i}.txt`, "x"]),
  );
  await expect(
    readFileText("archive", zip(files), "bundle.zip"),
  ).rejects.toThrow();
});

it("refuses an archive that unpacks past the cap", async () => {
  const big = new Uint8Array(51_000_000);
  await expect(
    readFileText("archive", zip({ "big.txt": big }), "bundle.zip"),
  ).rejects.toThrow();
  await expect(
    readFileText("archive", gzipSync(big), "big.txt.gz"),
  ).rejects.toThrow();
  // The cap is for the whole archive, nested ones included.
  // Members with no reader count too.
  const half = zip({ "half.bin": new Uint8Array(30_000_000) });
  await expect(
    readFileText(
      "archive",
      zip({ "a.zip": half, "b.zip": half }),
      "bundle.zip",
    ),
  ).rejects.toThrow();
}, 20_000);

it("refuses an archive nested too deep", async () => {
  const inner = zip({ "notes.txt": "Rent is 4200 a month" });
  expect(
    await readFileText("archive", zip({ "inner.zip": inner }), "bundle.zip"),
  ).toContain("Rent is 4200 a month");
  await expect(
    readFileText(
      "archive",
      zip({ "middle.zip": zip({ "inner.zip": inner }) }),
      "bundle.zip",
    ),
  ).rejects.toThrow();
});

/** The zip with every central directory entry's unpacked size set to `size`. */
function understated(archive: Uint8Array, size: number) {
  const view = new DataView(archive.buffer);
  for (let at = 0; at < archive.length - 4; at++) {
    if (view.getUint32(at, true) === 0x02014b50) {
      view.setUint32(at + 24, size, true);
    }
  }
  return archive;
}

it("refuses an archive member that unpacks past its stated size", async () => {
  const archive = understated(
    zip({ "notes.txt": new Uint8Array(100_000_000) }),
    10,
  );
  await expect(
    readFileText("archive", archive, "bundle.zip"),
  ).rejects.toThrow();
  const gzipped = gzipSync(new Uint8Array(100_000_000));
  gzipped.set([10, 0, 0, 0], gzipped.length - 4);
  await expect(
    readFileText("archive", gzipped, "notes.txt.gz"),
  ).rejects.toThrow();
}, 20_000);

it("counts the stored size of an entry that says it is empty", async () => {
  const files = Object.fromEntries(
    Array.from({ length: 11 }, (_, i) => [
      `f${i}.bin`,
      new Uint8Array(5_000_000),
    ]),
  );
  const archive = understated(zipSync(files, { level: 0 }), 0);
  await expect(
    readFileText("archive", archive, "bundle.zip"),
  ).rejects.toThrow();
});

it("skips the files macOS adds to an archive", async () => {
  const text = await readFileText(
    "archive",
    zip({
      "notes.txt": "Rent is 4200 a month",
      "__MACOSX/._notes.txt": "junk",
      "docs/._brief.md": "junk",
    }),
    "bundle.zip",
  );
  expect(text).toBe("File notes.txt:\nRent is 4200 a month");
});
