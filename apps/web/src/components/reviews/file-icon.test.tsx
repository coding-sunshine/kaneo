import { render } from "@testing-library/react";
import { expect, it } from "vite-plus/test";
import { FileIcon } from "./file-icon";

it("picks an icon by file type", () => {
  const kind = (name: string) =>
    render(<FileIcon filename={name} />)
      .container.querySelector("svg")
      ?.getAttribute("class");
  expect(kind("docs/a.PDF")).toContain("lucide-file-text");
  expect(kind("logo.svg")).toContain("lucide-file-image");
  expect(kind("src/a.ts")).toMatch(/lucide-file\b(?!-)/);
});
