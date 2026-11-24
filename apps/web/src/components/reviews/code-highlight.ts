import type { Segment } from "@/components/reviews/intra-line-diff";

export const CODE_THEMES = [
  "github",
  "solarized",
  "catppuccin",
  "one",
] as const;
export type CodeTheme = (typeof CODE_THEMES)[number];

/** The shiki theme for each code theme, light page then dark page. */
export const THEME_NAMES: Record<CodeTheme, { light: string; dark: string }> = {
  github: { light: "github-light", dark: "github-dark" },
  solarized: { light: "solarized-light", dark: "solarized-dark" },
  catppuccin: { light: "catppuccin-latte", dark: "catppuccin-mocha" },
  one: { light: "one-light", dark: "one-dark-pro" },
};

export type Token = { content: string; color?: string };
/** A run of text with one colour and one changed/unchanged state. */
export type Piece = { text: string; color?: string; changed: boolean };

/** Splits the colour tokens of a line further at the edges of its changed words. */
export function layerPieces(tokens: Token[], marks?: Segment[]): Piece[] {
  const edges: number[] = [];
  let at = 0;
  for (const part of marks ?? []) {
    edges.push(at);
    at += part.text.length;
  }
  const changedAt = (offset: number) => {
    let start = 0;
    for (const part of marks ?? []) {
      const end = start + part.text.length;
      if (offset < end) return part.changed;
      start = end;
    }
    return false;
  };
  const pieces: Piece[] = [];
  at = 0;
  for (const token of tokens) {
    let cut = 0;
    for (const edge of edges) {
      const inside = edge - at;
      if (inside > cut && inside < token.content.length) {
        pieces.push({
          text: token.content.slice(cut, inside),
          color: token.color,
          changed: changedAt(at + cut),
        });
        cut = inside;
      }
    }
    pieces.push({
      text: token.content.slice(cut),
      color: token.color,
      changed: changedAt(at + cut),
    });
    at += token.content.length;
  }
  return pieces;
}

// Extensions whose shiki language id differs from the extension.
const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  mjs: "javascript",
  cjs: "javascript",
  mts: "typescript",
  cts: "typescript",
  yml: "yaml",
  md: "markdown",
  sh: "bash",
  zsh: "bash",
  py: "python",
  rb: "ruby",
  rs: "rust",
  kt: "kotlin",
  cs: "csharp",
  htm: "html",
  vue: "vue",
  svelte: "svelte",
};

/** The shiki language for a file name, or null when it has no known extension. */
export function languageFor(filename: string): string | null {
  const name = filename.slice(filename.lastIndexOf("/") + 1).toLowerCase();
  if (name === "dockerfile") return "docker";
  if (name === "makefile") return "makefile";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return null;
  const extension = name.slice(dot + 1);
  return LANGUAGE_BY_EXTENSION[extension] ?? extension;
}
