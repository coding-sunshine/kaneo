const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
};

/** Runs of whitespace become one space, and the ends are trimmed. */
export const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * The text of a document as statements see it: no tags, entities decoded,
 * whitespace collapsed. The model reads this text, a quote is looked up in
 * it and a quote's position counts in it, so the three can never disagree.
 */
export function documentText(content: string) {
  return collapse(
    content
      .replace(/<[^>]*>/g, " ")
      .replace(
        /&(amp|lt|gt|quot|#39|nbsp);/g,
        (_, name: string) => ENTITIES[name] ?? "",
      ),
  );
}

/** A shorter quote is found almost anywhere, so it shows nothing. */
export const MIN_QUOTE_LENGTH = 4;

/**
 * Where the quote starts in a document's text, or -1 when it is not there or
 * is too short to count.
 */
export function quoteStart(text: string, quote: string) {
  const passage = collapse(quote);
  return passage.length >= MIN_QUOTE_LENGTH ? text.indexOf(passage) : -1;
}

/** The text of each paragraph, heading, list item, cell and line. */
export function textBlocks(content: string) {
  return content
    .split(/<\/(?:p|h[1-6]|li|td|th|blockquote|pre|div)>|<br\s*\/?>/i)
    .map(documentText)
    .filter(Boolean);
}
