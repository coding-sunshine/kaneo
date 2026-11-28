import type { getPrivateObject } from "./s3";

const SAFE_INLINE_ASSET_TYPES = new Set([
  "image/apng",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function buildContentDisposition(filename: string, inline: boolean) {
  const normalized = filename
    .normalize("NFC")
    .replace(/[\r\n"]/g, "")
    .trim();
  const safeFilename = normalized || "file";
  const asciiFallback =
    safeFilename
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\\/]/g, "-")
      .replace(/[^\x20-\x7E]+/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "file";
  const encodedFilename = encodeURIComponent(safeFilename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  const disposition = inline ? "inline" : "attachment";
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
}

/**
 * A stored file as a download. Only image types the browser renders safely
 * open inline; everything else is an attachment, never sniffed.
 */
export function privateObjectResponse(
  object: Awaited<ReturnType<typeof getPrivateObject>>,
  file: { filename: string; mimeType: string; cacheControl: string },
) {
  const storedContentType =
    (object.contentType || file.mimeType).toLowerCase().split(";")[0]?.trim() ??
    "";
  const inline = SAFE_INLINE_ASSET_TYPES.has(storedContentType);

  return new Response(object.body as BodyInit, {
    headers: {
      "Cache-Control": file.cacheControl,
      "Content-Disposition": buildContentDisposition(file.filename, inline),
      "Content-Length": object.contentLength?.toString() || "",
      "Content-Type": inline ? storedContentType : "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      ETag: object.etag || "",
      "Last-Modified": object.lastModified?.toUTCString() || "",
    },
  });
}
