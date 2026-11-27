import { isImageContentType } from "../../storage/s3";

const attribute = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** The line the editor writes for a picture, or for a file card. */
export function documentFileLine(file: {
  url: string;
  filename: string;
  contentType: string;
  size: number;
}) {
  return isImageContentType(file.contentType)
    ? `![${file.filename.replace(/[[\]\\\r\n]/g, "")}](${file.url})`
    : `<kaneo-attachment url="${file.url}" filename="${attribute(file.filename)}" mime-type="${file.contentType}" size="${file.size}" />`;
}
