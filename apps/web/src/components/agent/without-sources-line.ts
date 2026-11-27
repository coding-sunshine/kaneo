// The line the model ends an answer with. The API takes it off a saved
// answer; a reply that is still arriving shows without it.
const LINE = /(?:^|\n)[ \t*_#>-]*sources[*_]*\s*:[^\n]*\s*$/i;

export const withoutSourcesLine = (text: string) =>
  text.replace(LINE, "").trimEnd();
