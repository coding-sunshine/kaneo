import { getFileExtension } from "../storage/s3";

// A Map, not an object: "x.constructor" must not find a type. Archives, HTML
// and SVG are left out: the first hides what it carries, the others run script.
const types = new Map([
  ["pdf", "application/pdf"],
  ["doc", "application/msword"],
  [
    "docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ["xls", "application/vnd.ms-excel"],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["ppt", "application/vnd.ms-powerpoint"],
  [
    "pptx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  ["odt", "application/vnd.oasis.opendocument.text"],
  ["ods", "application/vnd.oasis.opendocument.spreadsheet"],
  ["odp", "application/vnd.oasis.opendocument.presentation"],
  ["txt", "text/plain"],
  ["md", "text/markdown"],
  ["csv", "text/csv"],
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
  ["avif", "image/avif"],
  ["heic", "image/heic"],
  ["heif", "image/heif"],
]);

export const fileTypeRefused =
  "This kind of file cannot be added to a document.";

/**
 * The type a document's file is stored and served as. It comes from the name
 * alone, never from the sender, so a page cannot be stored as a picture.
 */
export function documentFileContentType(filename: string) {
  return types.get(getFileExtension(filename)) ?? null;
}
