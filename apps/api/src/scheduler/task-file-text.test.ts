import { gzipSync, strToU8, zipSync } from "fflate";
import { expect, it } from "vite-plus/test";
import { ARCHIVE_CAPS, archiveText } from "./archive-text";
import { inflateCapped } from "./capped-inflate";
import { ReadLater } from "./read-later";
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
  // A picture is read by the model when one is set.
  expect(fileKind("scan.PNG", "application/octet-stream")).toBe("image");
  expect(fileKind("scan", "image/jpeg")).toBe("image");
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

it("reads every page of a long PDF, to its last word", async () => {
  const pages = Array.from({ length: 300 }, (_, i) => `Page ${i + 1} here`);
  const text = await pdfText(pdf(pages));
  expect(text).toContain("Page 51 here");
  expect(text.endsWith("Page 300 here")).toBe(true);
});

/** The model, as the job hands it to a reader: it writes out what it sees. */
const sees = (said: string) => {
  const seen: { mimeType: string; filename: string }[] = [];
  const see = async (file: {
    bytes: Uint8Array;
    mimeType: string;
    filename: string;
  }) => {
    seen.push({ mimeType: file.mimeType, filename: file.filename });
    return said;
  };
  return { see, seen };
};

it("hands a PDF with a page without text, and a picture, to the model", async () => {
  const { see, seen } = sees("Rent is 4200 a month");
  const scanned = pdf(["Cover page", ""]);
  expect(await readFileText("pdf", scanned, "lease.pdf", see)).toBe(
    "Rent is 4200 a month",
  );
  expect(await readFileText("pdf", pdf(["Cover page"]), "a.pdf", see)).toBe(
    "Cover page",
  );
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  expect(await readFileText("image", png, "photo.png", see)).toBe(
    "Rent is 4200 a month",
  );
  expect(seen).toEqual([
    { mimeType: "application/pdf", filename: "lease.pdf" },
    { mimeType: "image/png", filename: "photo.png" },
  ]);
  // Without a model, a picture has no text and a scan only its text layer.
  expect(await readFileText("image", png, "photo.png")).toBe("");
  expect(await readFileText("pdf", scanned, "lease.pdf")).toContain("Cover");
});

it("keeps the text a file has when the model cannot write it out, and reads it later when the model cannot answer now", async () => {
  const refused = async () => {
    throw new Error("HTTP 413");
  };
  const scanned = pdf(["Cover page", ""]);
  expect(await readFileText("pdf", scanned, "lease.pdf", refused)).toContain(
    "Cover page",
  );
  const word = zip({
    "word/document.xml": `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Lease</w:t></w:r></w:p></w:body></w:document>`,
    "word/media/image1.png": new Uint8Array([0x89, 0x50]),
  });
  expect(await readFileText("docx", word, "lease.docx", refused)).toBe("Lease");
  const later = async () => {
    throw new ReadLater(false);
  };
  await expect(
    readFileText("pdf", scanned, "lease.pdf", later),
  ).rejects.toBeInstanceOf(ReadLater);
  await expect(
    readFileText("archive", zip({ "scan.png": "x" }), "b.zip", later),
  ).rejects.toBeInstanceOf(ReadLater);
});

it("hands the pictures in a Word file and in an archive to the model", async () => {
  const { see, seen } = sees("Signed on 1 May");
  const word = zip({
    "word/document.xml": `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Lease</w:t></w:r></w:p></w:body></w:document>`,
    "word/media/image1.jpeg": new Uint8Array([0xff, 0xd8, 0xff]),
  });
  const text = await readFileText("docx", word, "lease.docx", see);
  expect(text).toContain("Lease");
  expect(text).toContain("Picture word/media/image1.jpeg:\nSigned on 1 May");
  const archive = zip({ "scan.png": new Uint8Array([0x89, 0x50]) });
  expect(await readFileText("archive", archive, "b.zip", see)).toBe(
    "File scan.png:\nSigned on 1 May",
  );
  expect(seen.map(({ mimeType }) => mimeType)).toEqual([
    "image/jpeg",
    "image/png",
  ]);
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

it("unpacks archives up to 5000 entries, 500 MB and 3 levels deep", () => {
  expect(ARCHIVE_CAPS).toEqual({
    entries: 5000,
    bytes: 500_000_000,
    depth: 3,
  });
});

it("reads every member of a large archive, and refuses one with too many entries", async () => {
  const files = (count: number) =>
    Object.fromEntries(
      Array.from({ length: count }, (_, i) => [`f${i}.txt`, `member ${i} `]),
    );
  const text = await readFileText("archive", zip(files(5000)), "bundle.zip");
  expect(text).toContain("File f0.txt:");
  expect(text).toContain("File f4999.txt:\nmember 4999");
  await expect(
    readFileText("archive", zip(files(5001)), "bundle.zip"),
  ).rejects.toThrow("too many entries");
});

it("reads the whole text of an archive, however long", async () => {
  const long = `${"word ".repeat(100_000)}the last words`;
  const text = await readFileText(
    "archive",
    zip({ "a.txt": long, "b.txt": long, "c.txt": long }),
    "bundle.zip",
  );
  expect(text.length).toBeGreaterThan(1_500_000);
  expect(text.endsWith("the last words")).toBe(true);
});

/** Bytes that do not compress: a zip or gzip of them is as large as they are. */
const noise = (length: number) => {
  const out = new Uint8Array(length);
  let seed = 7;
  for (let at = 0; at < length; at++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    out[at] = seed >> 16;
  }
  return out;
};

it("refuses an archive that says it unpacks past the cap, before unpacking", async () => {
  const big = understated(zip({ "big.txt": noise(600_000) }), 501_000_000);
  await expect(readFileText("archive", big, "bundle.zip")).rejects.toThrow(
    "size cap",
  );
  const gzipped = gzipSync(noise(600_000));
  new DataView(gzipped.buffer).setUint32(gzipped.length - 4, 501_000_000, true);
  await expect(readFileText("archive", gzipped, "big.txt.gz")).rejects.toThrow(
    "size cap",
  );
  // The cap is for the whole archive, nested ones included.
  // Members with no reader count too.
  const half = understated(zip({ "half.bin": noise(300_000) }), 260_000_000);
  await expect(
    readFileText(
      "archive",
      zip({ "a.zip": half, "b.zip": half }),
      "bundle.zip",
    ),
  ).rejects.toThrow("size cap");
});

it("refuses data that says it unpacks more than deflate can, before unpacking", () => {
  const packed = zip({ "notes.txt": "Rent is 4200 a month. ".repeat(500) });
  const bomb = understated(packed, 400_000_000);
  return expect(readFileText("archive", bomb, "bundle.zip")).rejects.toThrow(
    "more than",
  );
});

it("refuses deflate data whose header claims more than deflate can hold", () => {
  expect(() => inflateCapped(new Uint8Array(1000), 2_000_000)).toThrow(
    "more than",
  );
});

it("refuses an archive nested too deep", async () => {
  const inner = zip({ "notes.txt": "Rent is 4200 a month" });
  expect(
    await readFileText(
      "archive",
      zip({ "middle.zip": zip({ "inner.zip": inner }) }),
      "bundle.zip",
    ),
  ).toContain("Rent is 4200 a month");
  await expect(
    readFileText(
      "archive",
      zip({ "outer.zip": zip({ "middle.zip": zip({ "inner.zip": inner }) }) }),
      "bundle.zip",
    ),
  ).rejects.toThrow("nested too deep");
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
  const reader = { readable: () => true, read: async () => "" };
  await expect(
    archiveText("bundle.zip", archive, reader, {
      ...ARCHIVE_CAPS,
      bytes: 50_000_000,
    }),
  ).rejects.toThrow("size cap");
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
