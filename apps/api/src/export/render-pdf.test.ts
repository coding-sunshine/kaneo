import { getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vite-plus/test";
import { renderPdf } from "./render-pdf";

type Run = { text: string; x: number; y: number; size: number; page: number };

async function readRuns(bytes: Uint8Array): Promise<Run[]> {
  const pdf = await getDocumentProxy(bytes.slice());
  const runs: Run[] = [];
  for (let page = 1; page <= pdf.numPages; page++) {
    const { items } = await (await pdf.getPage(page)).getTextContent();
    for (const item of items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const [a = 0, , , , x = 0, y = 0] = item.transform as number[];
      runs.push({ text: item.str, x, y, size: Math.abs(a), page });
    }
  }
  return runs;
}

describe("renderPdf", () => {
  it("writes a PDF whose heading is larger than its body text", async () => {
    const bytes = renderPdf("Plan", "## Goals\n\nShip the export.");
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const runs = await readRuns(bytes);
    const title = runs.find((run) => run.text === "Plan");
    const heading = runs.find((run) => run.text === "Goals");
    const body = runs.find((run) => run.text === "Ship the export.");
    expect(title && heading && body).toBeTruthy();
    expect(title!.size).toBeGreaterThan(heading!.size);
    expect(heading!.size).toBeGreaterThan(body!.size);
    expect(heading!.y).toBeGreaterThan(body!.y);
  });

  it("lays a table out in rows and columns", async () => {
    const runs = await readRuns(
      renderPdf(
        "T",
        "| Name | Owner |\n| --- | --- |\n| API | Ana |\n| Web | Bo |",
      ),
    );
    const at = (text: string) => runs.find((run) => run.text === text)!;
    expect(at("Name").y).toBe(at("Owner").y);
    expect(at("API").y).toBe(at("Ana").y);
    expect(at("Name").x).toBe(at("API").x);
    expect(at("Owner").x).toBe(at("Ana").x);
    expect(at("Owner").x).toBeGreaterThan(at("Name").x);
    expect(at("Name").y).toBeGreaterThan(at("API").y);
    expect(at("API").y).toBeGreaterThan(at("Web").y);
  });

  it("wraps long text and moves to a new page when one fills up", async () => {
    const paragraph = "word ".repeat(400).trim();
    const runs = await readRuns(
      renderPdf("Long", Array(8).fill(paragraph).join("\n\n")),
    );
    expect(Math.max(...runs.map((run) => run.page))).toBeGreaterThan(1);
    expect(Math.max(...runs.map((run) => run.x))).toBeLessThan(600);
  });

  it("keeps Latin accents and replaces characters the font lacks", async () => {
    const runs = await readRuns(renderPdf("Café", "Naïve 漢字"));
    const text = runs.map((run) => run.text).join(" ");
    expect(text).toContain("Café");
    expect(text).toContain("Naïve ??");
  });
});
