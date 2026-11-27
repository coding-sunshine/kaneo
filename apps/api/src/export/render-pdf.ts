import { type Block, markdownBlocks } from "./markdown-blocks";
import { type PdfFont, textWidth } from "./pdf-fonts";
import { PAGE_HEIGHT, PAGE_WIDTH, PdfPage, writePdf } from "./pdf-writer";

const MARGIN = 56;
const WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY = 11;
const LEADING = 1.4;
const CELL_PAD = 5;
const HEADING_SIZES = [18, 15, 13, 12, 12, 12];

type Style = { font: PdfFont; size: number };

// Splits text into lines no wider than `width`, breaking long words.
function wrap(text: string, { font, size }: Style, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/ +/)) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, font, size) <= width) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const char of word) {
        if (line && textWidth(line + char, font, size) > width) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

class Layout {
  readonly pages: PdfPage[] = [];
  private page = new PdfPage();
  // Baseline room left: the top of the next line, measured from the bottom.
  private y = PAGE_HEIGHT - MARGIN;

  constructor() {
    this.pages.push(this.page);
  }

  private ensure(height: number) {
    if (this.y - height >= MARGIN || this.y === PAGE_HEIGHT - MARGIN) return;
    this.page = new PdfPage();
    this.pages.push(this.page);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  gap(points: number) {
    if (this.y < PAGE_HEIGHT - MARGIN) this.y -= points;
  }

  lines(text: string, style: Style, indent = 0, after = 6) {
    const height = style.size * LEADING;
    for (const line of wrap(text, style, WIDTH - indent)) {
      this.ensure(height);
      this.y -= height;
      if (line)
        this.page.text(
          line,
          MARGIN + indent,
          this.y + 3,
          style.font,
          style.size,
        );
    }
    this.y -= after;
  }

  item(block: Extract<Block, { type: "item" }>) {
    const indent = block.depth * 16;
    const style = { font: "regular" as const, size: BODY };
    const height = BODY * LEADING;
    this.ensure(height);
    this.page.text(
      block.marker,
      MARGIN + indent,
      this.y - height + 3,
      "regular",
      BODY,
    );
    this.lines(block.text, style, indent + 18, 2);
  }

  quote(text: string) {
    const top = this.y;
    const startPage = this.page;
    this.lines(text, { font: "regular", size: BODY }, 14, 0);
    if (this.page === startPage)
      this.page.line(MARGIN + 3, top, MARGIN + 3, this.y, 0.6);
    this.y -= 6;
  }

  code(text: string) {
    const style = { font: "mono" as const, size: 9.5 };
    const height = style.size * LEADING;
    for (const line of wrap(text, style, WIDTH - 12)) {
      this.ensure(height);
      this.page.fill(MARGIN, this.y - height, WIDTH, height, 0.95);
      this.y -= height;
      this.page.text(line, MARGIN + 6, this.y + 3, style.font, style.size);
    }
    this.y -= 8;
  }

  rule() {
    this.ensure(12);
    this.y -= 6;
    this.page.line(MARGIN, this.y, MARGIN + WIDTH, this.y);
    this.y -= 6;
  }

  table(header: string[], rows: string[][]) {
    const columns = Math.max(header.length, ...rows.map((row) => row.length));
    const columnWidth = WIDTH / columns;
    const size = 10;
    const lineHeight = size * LEADING;
    const drawRow = (cells: string[], font: PdfFont) => {
      const wrapped = Array.from({ length: columns }, (_, index) =>
        wrap(cells[index] ?? "", { font, size }, columnWidth - CELL_PAD * 2),
      );
      const height =
        Math.max(...wrapped.map((lines) => lines.length)) * lineHeight +
        CELL_PAD * 2;
      this.ensure(height);
      const top = this.y;
      if (font === "bold")
        this.page.fill(MARGIN, top - height, WIDTH, height, 0.94);
      wrapped.forEach((lines, column) => {
        const x = MARGIN + column * columnWidth;
        this.page.rect(x, top - height, columnWidth, height);
        lines.forEach((line, index) => {
          if (!line) return;
          const baseline = top - CELL_PAD - (index + 1) * lineHeight + 3;
          this.page.text(line, x + CELL_PAD, baseline, font, size);
        });
      });
      this.y -= height;
    };
    drawRow(header, "bold");
    for (const row of rows) drawRow(row, "regular");
    this.y -= 10;
  }
}

/** A document as a PDF: its title, then its Markdown laid out block by block. */
export function renderPdf(title: string, markdown: string) {
  const layout = new Layout();
  layout.lines(title || "Untitled", { font: "bold", size: 22 }, 0, 10);
  for (const block of markdownBlocks(markdown)) {
    switch (block.type) {
      case "heading":
        layout.gap(6);
        layout.lines(
          block.text,
          { font: "bold", size: HEADING_SIZES[block.level - 1] ?? BODY },
          0,
          4,
        );
        break;
      case "paragraph":
        layout.lines(block.text, { font: "regular", size: BODY });
        break;
      case "item":
        layout.item(block);
        break;
      case "quote":
        layout.quote(block.text);
        break;
      case "code":
        layout.code(block.text);
        break;
      case "rule":
        layout.rule();
        break;
      case "table":
        layout.table(block.header, block.rows);
        break;
    }
  }
  return writePdf(layout.pages, title);
}
