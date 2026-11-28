// The image types the API serves inline; every other file arrives as a
// download, which an <img> cannot show.
const INLINE_IMAGE_TYPES = new Set([
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

export const isInlineImage = (mimeType: string) =>
  INLINE_IMAGE_TYPES.has(mimeType.toLowerCase());
