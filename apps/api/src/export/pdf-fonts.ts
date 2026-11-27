// The three standard PDF fonts the export uses, with the widths of their
// printable ASCII glyphs (Adobe's metrics, in 1/1000 em) so text can be
// wrapped before it is drawn. Every PDF reader carries these fonts.
export type PdfFont = "regular" | "bold" | "mono";

export const PDF_FONTS: Record<PdfFont, { id: string; base: string }> = {
  regular: { id: "F1", base: "Helvetica" },
  bold: { id: "F2", base: "Helvetica-Bold" },
  mono: { id: "F3", base: "Courier" },
};

// Characters 32 to 126 in order.
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584,
  584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333,
  278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278,
  556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556,
  500, 389, 280, 389, 584,
];
// Glyphs outside ASCII are taken as wide, so a line never runs over.
const WIDE = 722;

// Unicode characters that WinAnsiEncoding places outside Latin-1.
const WIN_ANSI: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "‰": 0x89,
  "‹": 0x8b,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "™": 0x99,
  "›": 0x9b,
};

/** The byte for each character in WinAnsiEncoding, `?` where it has none. */
export function winAnsiBytes(text: string): number[] {
  return Array.from(text, (char) => {
    const code = char.codePointAt(0) ?? 63;
    if (code === 9) return 32;
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
      return code;
    }
    return WIN_ANSI[char] ?? 63;
  });
}

/** Width of `text` in points at `size`. */
export function textWidth(text: string, font: PdfFont, size: number) {
  let units = 0;
  for (const byte of winAnsiBytes(text)) {
    if (font === "mono") units += 600;
    else if (byte > 126) units += WIDE;
    else
      units +=
        (font === "bold" ? HELVETICA_BOLD : HELVETICA)[byte - 32] ?? WIDE;
  }
  return (units * size) / 1000;
}
