import { PDF_FONTS, type PdfFont, winAnsiBytes } from "./pdf-fonts";

// A4 in points.
export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;

const num = (value: number) => Number(value.toFixed(2)).toString();

// A PDF string literal, kept to ASCII: bytes past it go as octal escapes.
function pdfString(text: string) {
  return `(${winAnsiBytes(text)
    .map((byte) => {
      if (byte === 40 || byte === 41 || byte === 92) {
        return `\\${String.fromCharCode(byte)}`;
      }
      if (byte > 126) return `\\${byte.toString(8).padStart(3, "0")}`;
      return String.fromCharCode(byte);
    })
    .join("")})`;
}

/** Drawing operations for one page, in PDF user space (origin bottom left). */
export class PdfPage {
  readonly ops: string[] = [];

  text(text: string, x: number, y: number, font: PdfFont, size: number) {
    this.ops.push(
      `BT /${PDF_FONTS[font].id} ${num(size)} Tf ${num(x)} ${num(y)} Td ${pdfString(text)} Tj ET`,
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, gray = 0.75) {
    this.ops.push(
      `${num(gray)} G 0.75 w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`,
    );
  }

  rect(x: number, y: number, width: number, height: number, gray = 0.75) {
    this.ops.push(
      `${num(gray)} G 0.75 w ${num(x)} ${num(y)} ${num(width)} ${num(height)} re S`,
    );
  }

  fill(x: number, y: number, width: number, height: number, gray: number) {
    this.ops.push(
      `${num(gray)} g ${num(x)} ${num(y)} ${num(width)} ${num(height)} re f 0 g`,
    );
  }
}

/** Serializes pages into a PDF file. Every byte written is ASCII. */
export function writePdf(pages: PdfPage[], title: string) {
  const fonts = Object.values(PDF_FONTS);
  const fontRef = (index: number) => 4 + index;
  const firstPage = 4 + fonts.length;
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages
      .map((_, index) => `${firstPage + index * 2} 0 R`)
      .join(" ")}] /Count ${pages.length} >>`,
    `<< /Title ${pdfString(title)} /Producer (Kaneo) >>`,
    ...fonts.map(
      (font) =>
        `<< /Type /Font /Subtype /Type1 /BaseFont /${font.base} /Encoding /WinAnsiEncoding >>`,
    ),
  ];
  const resources = `<< /Font << ${fonts
    .map((font, index) => `/${font.id} ${fontRef(index)} 0 R`)
    .join(" ")} >> >>`;
  pages.forEach((page, index) => {
    const content = page.ops.join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources ${resources} /Contents ${firstPage + index * 2 + 1} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  });

  let out = "%PDF-1.4\n";
  const offsets = objects.map((body, index) => {
    const offset = out.length;
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets
    .map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`)
    .join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
