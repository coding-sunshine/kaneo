export type CustomEmoji = { id: string; name: string; url: string };

const SHORTCODE = /^:([a-z0-9_-]+):$/;

/** `:name:` is how a custom emoji is stored in a reaction; null for native. */
export function customEmojiName(emoji: string) {
  return SHORTCODE.exec(emoji)?.[1] ?? null;
}

export function searchCustomEmoji(custom: CustomEmoji[], query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return custom.filter(({ name }) =>
    words.every((word) => name.includes(word)),
  );
}

export const MAX_EMOJI_PIXELS = 128;
export const MAX_EMOJI_BYTES = 500_000;
export const EMOJI_NAME_PATTERN = /^[a-z0-9_-]+$/;
const TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/**
 * Fits an image into 128px. Small allowed files go up untouched so animated
 * GIFs survive; anything else is redrawn as PNG, which drops animation.
 */
export async function prepareEmojiImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const fits =
    bitmap.width <= MAX_EMOJI_PIXELS && bitmap.height <= MAX_EMOJI_PIXELS;
  if (fits && TYPES.includes(file.type) && file.size <= MAX_EMOJI_BYTES) {
    bitmap.close();
    return file;
  }
  const scale = Math.min(
    1,
    MAX_EMOJI_PIXELS / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("resize failed");
  return blob;
}
