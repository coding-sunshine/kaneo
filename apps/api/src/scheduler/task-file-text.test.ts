import { expect, it } from "vite-plus/test";
import { fileKind, fileText } from "./task-file-text";

it("reads text and HTML files, and nothing else", () => {
  expect(fileKind("notes.md", "application/octet-stream")).toBe("text");
  expect(fileKind("export", "text/plain")).toBe("text");
  expect(fileKind("page.HTML", "application/octet-stream")).toBe("html");
  expect(fileKind("page", "text/html")).toBe("html");
  expect(fileKind("scan.pdf", "application/pdf")).toBeNull();
  expect(fileKind("bundle.zip", "application/zip")).toBeNull();
});

it("leaves scripts, styles and tags out of an HTML file", () => {
  const text = fileText(
    "html",
    "<style>p { color: red }</style><p>Rent is <b>4200</b></p><script>let hidden = 1</script >",
  );
  expect(text).toContain("Rent is");
  expect(text).toContain("4200");
  for (const gone of ["color", "hidden", "<p>", "<b>"]) {
    expect(text).not.toContain(gone);
  }
  expect(fileText("text", "<p>kept as written</p>")).toBe(
    "<p>kept as written</p>",
  );
});
