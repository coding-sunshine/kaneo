const CODE = /```[\s\S]*?(?:```|$)|`[^`\n]*`/g;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/i;
const TRAILING = /[.,;:!?)\]}]+$/;

// The first web link a reader would click. Code is quoted text, not a link.
export function findPreviewUrl(body: string): string | null {
  const match = body.replace(CODE, " ").match(URL_PATTERN);
  if (!match) return null;
  const candidate = match[0].replace(TRAILING, "");
  try {
    return new URL(candidate).protocol.startsWith("http") ? candidate : null;
  } catch {
    return null;
  }
}
