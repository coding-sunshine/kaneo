/**
 * Cuts a text into parts of at most `size` characters. Each part starts
 * `overlap` characters before the previous one ended, so a passage of up to
 * `overlap` characters is whole inside one part. Needs `size` > `overlap`.
 */
export function textParts(text: string, size: number, overlap: number) {
  const parts: string[] = [];
  for (let start = 0; ; start += size - overlap) {
    parts.push(text.slice(start, start + size));
    if (start + size >= text.length) return parts;
  }
}
