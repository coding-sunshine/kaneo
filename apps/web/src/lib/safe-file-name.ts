/** A title as a file name: characters file systems refuse become dashes. */
export function safeFileName(title: string, extension: string) {
  const base = Array.from(title, (char) =>
    char.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(char) ? "-" : char,
  )
    .join("")
    .trim();
  return `${base || "untitled"}.${extension}`;
}
