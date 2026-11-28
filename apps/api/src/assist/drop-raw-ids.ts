// Ids the server makes are long and opaque; ticket keys and words are not.
const OPAQUE = /^[A-Za-z0-9_-]{16,}$/;
const KIND = String.raw`\b(?:task|document|comment|message)\s*:\s*`;
const escape = (id: string) => id.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");

/**
 * The model's text without the raw ids it copied from the prompt, such as
 * `(comment:k3j9…)`: a reader sees the sources as links under the answer,
 * never as ids. A `kind:id` token goes even when its id was not given.
 * Ticket keys stay, and so does the text's layout.
 */
export function dropRawIds(text: string, ids: Iterable<string>) {
  const given = [...new Set(ids)].filter((id) => OPAQUE.test(id));
  const forms = [`${KIND}\`?[A-Za-z0-9_-]{16,}\`?`];
  if (given.length)
    forms.push(`(?:${KIND})?\`?(?:${given.map(escape).join("|")})\`?`);
  const chunk = `(?:${forms.join("|")})`;
  const list = String.raw`[ \t]*[([]\s*${chunk}(?:\s*[,;]\s*${chunk})*\s*[)\]]`;
  return text
    .replace(new RegExp(list, "g"), "")
    .replace(new RegExp(String.raw`[ \t]*${chunk}`, "g"), "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/[ \t]+$/gm, "")
    .trim();
}
