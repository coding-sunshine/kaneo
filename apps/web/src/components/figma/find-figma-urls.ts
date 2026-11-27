// The server decides what is a valid Figma file link; this only picks
// candidates out of markdown so a body with no Figma link costs nothing.
const FIGMA_URL = /https:\/\/(?:www\.)?figma\.com\/[^\s<>()[\]"'`]+/g;
const MAX_CARDS = 3;

// The editor saves a pasted link as [escaped text](url): the text has `\_`
// and `&amp;`. Undo both so the text and the target count as one link.
function unescapeMarkdown(url: string) {
  return url
    .replace(/\\([\\`*_{}[\]()#+\-.!|~<>])/g, "$1")
    .replaceAll("&amp;", "&");
}

export function findFigmaUrls(content: string) {
  const found = new Set<string>();
  for (const match of content.matchAll(FIGMA_URL)) {
    const index = match.index ?? 0;
    // Skip a match inside another host's path, like example.test/https://figma.com.
    if (index > 0 && /[\w./]/.test(content[index - 1] ?? "")) continue;
    found.add(unescapeMarkdown(match[0]).replace(/[.,;:!?]+$/, ""));
    if (found.size === MAX_CARDS) break;
  }
  return [...found];
}
