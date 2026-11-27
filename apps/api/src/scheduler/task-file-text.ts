import { getDocumentProxy } from "unpdf";
import { documentText } from "../topic/statement-text";
import { ARCHIVE, archiveText } from "./archive-text";
import { ReadLater } from "./read-later";
import { docxText } from "./docx-text";
import { zipEntries } from "./zip-entries";

// ponytail: plain text, HTML, PDF, Word, pictures and zip, gzip or tar
// archives. Any other file gets a record that says it was not read. Add a
// parser here when its facts matter.
const TEXT = /\.(md|markdown|txt|json|tsv|csv|ya?ml|patch|diff|log)$/i;
const HTML = /\.html?$/i;
const PDF = /\.pdf$/i;
const DOCX = /\.docx$/i;
// The pictures the model reads, by their type.
const PICTURES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};
const PICTURE = /\.(png|jpe?g|webp|gif)$/i;
const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ARCHIVE_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-gzip",
  "application/x-tar",
  "application/x-gtar",
]);
// The pictures of a Word file.
const MEDIA = /^word\/media\/[^/]+\.(png|jpe?g|webp|gif)$/i;

/** How a file on an issue is read, or null when it is not text. */
export function fileKind(filename: string, mimeType: string) {
  // By name first: a Word file is a zip, and is often sent as one.
  if (DOCX.test(filename)) return "docx" as const;
  if (ARCHIVE.test(filename)) return "archive" as const;
  if (HTML.test(filename) || mimeType === "text/html") return "html" as const;
  if (PDF.test(filename) || mimeType === "application/pdf")
    return "pdf" as const;
  if (mimeType === DOCX_TYPE) return "docx" as const;
  if (TEXT.test(filename) || mimeType.startsWith("text/")) {
    return "text" as const;
  }
  if (ARCHIVE_TYPES.has(mimeType)) return "archive" as const;
  if (PICTURE.test(filename) || Object.values(PICTURES).includes(mimeType)) {
    return "image" as const;
  }
  return null;
}

export type FileKind = NonNullable<ReturnType<typeof fileKind>>;

/** The words of a file. For HTML: no scripts, no styles, no tags. */
export const fileText = (kind: "html" | "text", content: string) =>
  kind === "html"
    ? documentText(
        content.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " "),
      )
    : content;

/**
 * The words of each page of a PDF, all of them. Reads the bytes only: no
 * fonts, maps or scripts are loaded. Throws on bytes that are not a PDF.
 */
async function pdfPages(bytes: Uint8Array) {
  // A copy: the reader takes the bytes it is given, and `see` may need them.
  const pdf = await getDocumentProxy(bytes.slice(), {
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  try {
    const pages: string[] = [];
    for (let at = 1; at <= pdf.numPages; at++) {
      const page = await pdf.getPage(at);
      const { items } = await page.getTextContent();
      pages.push(
        items.map((item) => ("str" in item ? item.str : "")).join(" "),
      );
      page.cleanup();
    }
    return pages;
  } finally {
    await pdf.loadingTask.destroy();
  }
}

/** The words of a PDF, one page per paragraph. */
export const pdfText = async (bytes: Uint8Array) =>
  (await pdfPages(bytes)).join("\n\n");

/**
 * The model, writing out the words it sees in a PDF or a picture. Throws
 * `ReadLater` when it cannot answer now.
 */
export type See = (file: {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
}) => Promise<string>;

/**
 * What the model wrote out, or `instead` when it cannot write this file out.
 * A cap or a failed request leaves the file to be read later.
 */
async function seeOr(see: See, file: Parameters<See>[0], instead: string) {
  try {
    return await see(file);
  } catch (error) {
    if (error instanceof ReadLater) throw error;
    console.error(`The model could not write out ${file.filename}`, error);
    return instead;
  }
}

const pictureType = (path: string) =>
  PICTURES[path.slice(path.lastIndexOf(".") + 1).toLowerCase()] ?? "";

/**
 * The words of a file of a kind that has a reader. A member of an archive is
 * read by its name. With `see`, the model reads what has no text: a picture,
 * the pictures of a Word file, and a PDF with a page that has no text, as a
 * scan has. Throws on bytes that cannot be read as that kind.
 */
export async function readFileText(
  kind: FileKind,
  bytes: Uint8Array,
  filename: string,
  see?: See,
): Promise<string> {
  if (kind === "pdf") {
    const pages = await pdfPages(bytes);
    const text = pages.join("\n\n");
    // The text it has is kept when the model cannot write it out.
    return see && pages.some((page) => !/\S/.test(page))
      ? seeOr(see, { bytes, mimeType: "application/pdf", filename }, text)
      : text;
  }
  if (kind === "image") {
    return see ? see({ bytes, mimeType: pictureType(filename), filename }) : "";
  }
  if (kind === "docx") {
    const texts = [docxText(bytes)];
    for (const entry of see ? zipEntries(bytes) : []) {
      if (!MEDIA.test(entry.path) || !see) continue;
      const seen = await seeOr(
        see,
        {
          bytes: entry.open(),
          mimeType: pictureType(entry.path),
          filename: entry.path,
        },
        "",
      );
      if (/\S/.test(seen)) texts.push(`Picture ${entry.path}:\n${seen}`);
    }
    return texts.filter(Boolean).join("\n\n");
  }
  if (kind === "archive") {
    return archiveText(filename, bytes, {
      readable: (path) => fileKind(path, "") !== null,
      read: async (path, member) => {
        const inner = fileKind(path, "");
        return inner && inner !== "archive"
          ? readFileText(inner, member, path, see)
          : "";
      },
    });
  }
  return fileText(kind, new TextDecoder().decode(bytes));
}
