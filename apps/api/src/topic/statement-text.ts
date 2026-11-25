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

/** Where the quote starts in a document's text, or -1 when it is not there. */
export function quoteStart(text: string, quote: string) {
  const passage = collapse(quote);
  return passage ? text.indexOf(passage) : -1;
}
