import type { LinkPreview } from "./link-preview-type";

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 300;
// Raw text taken from one element or tag before it is cleaned.
const RAW_MAX = 2000;
const META_MAX = 200;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function safeChar(code: number, fallback: string) {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff
    ? String.fromCodePoint(code)
    : fallback;
}

function decode(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
    const code = name.toLowerCase();
    if (code.startsWith("#x"))
      return safeChar(Number.parseInt(code.slice(2), 16), entity);
    if (code.startsWith("#"))
      return safeChar(Number.parseInt(code.slice(1), 10), entity);
    return ENTITIES[code] ?? entity;
  });
}

function clean(text: string | undefined, max: number) {
  if (!text) return null;
  const plain = decode(text.slice(0, RAW_MAX).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return null;
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

function attribute(tag: string, name: string) {
  const match = tag.match(
    new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return match ? (match[2] ?? match[3] ?? match[4]) : undefined;
}

// Every scan below walks forward with indexOf, so a hostile page costs time
// in proportion to its size; backtracking regexes over the page do not.
class Page {
  readonly lower: string;

  constructor(readonly html: string) {
    this.lower = html.toLowerCase();
  }

  /** The text of the first <name> element, if it is closed. */
  element(name: string) {
    let from = 0;
    while (true) {
      const start = this.lower.indexOf(`<${name}`, from);
      if (start < 0) return undefined;
      const next = this.lower[start + name.length + 1];
      from = start + 1;
      if (next !== ">" && next !== " " && next !== "\t" && next !== "\n")
        continue;
      const open = this.lower.indexOf(">", start);
      if (open < 0) return undefined;
      const close = this.lower.indexOf(`</${name}`, open);
      if (close < 0) return undefined;
      return this.html.slice(open + 1, Math.min(close, open + 1 + RAW_MAX));
    }
  }

  meta(key: string) {
    let from = 0;
    for (let seen = 0; seen < META_MAX; seen++) {
      const start = this.lower.indexOf("<meta", from);
      if (start < 0) return undefined;
      const end = this.lower.indexOf(">", start);
      if (end < 0) return undefined;
      from = end;
      const tag = this.html.slice(start, Math.min(end, start + RAW_MAX));
      const name = attribute(tag, "property") ?? attribute(tag, "name");
      if (name?.toLowerCase() === key) return attribute(tag, "content");
    }
    return undefined;
  }
}

/** Drops script and style bodies, which never hold page text. */
function withoutCode(html: string) {
  const lower = html.toLowerCase();
  let out = "";
  let from = 0;
  while (true) {
    const script = lower.indexOf("<script", from);
    const style = lower.indexOf("<style", from);
    const start =
      script < 0 ? style : style < 0 ? script : Math.min(script, style);
    if (start < 0) return out + html.slice(from);
    out += `${html.slice(from, start)} `;
    const close = lower.indexOf(
      start === script ? "</script" : "</style",
      start,
    );
    if (close < 0) return out;
    from = close + 2;
  }
}

// Reads the card from the page head, falling back to the first paragraph for
// pages, like example.com, that carry no description tags.
export function parseLinkPreview(
  html: string,
  url: string,
): LinkPreview | null {
  const page = new Page(withoutCode(html));
  const title = clean(
    page.meta("og:title") ?? page.element("title"),
    TITLE_MAX,
  );
  if (!title) return null;
  const description = clean(
    page.meta("og:description") ??
      page.meta("description") ??
      page.element("p"),
    DESCRIPTION_MAX,
  );
  const siteName =
    clean(page.meta("og:site_name"), TITLE_MAX) ??
    new URL(url).hostname.replace(/^www\./, "");
  return { url, title, description, siteName };
}
