// marked ends an ordered list at the first item that is indented less than
// the first one and silently drops the rest. Linear exports " 1. a" through
// " 9. i" with one leading space and "10. j" with none, so items 10+ vanished.
// Strip that single space (outside code fences); a 4-space continuation line
// stays inside the item either way.
export function dedentOrderedMarkers(markdown: string) {
  let fence: string | null = null;
  return markdown
    .split("\n")
    .map((line) => {
      const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
      if (marker) {
        if (!fence) fence = marker[0];
        else if (marker[0] === fence) fence = null;
        return line;
      }
      return fence ? line : line.replace(/^ (\d{1,9}[.)] )/, "$1");
    })
    .join("\n");
}
