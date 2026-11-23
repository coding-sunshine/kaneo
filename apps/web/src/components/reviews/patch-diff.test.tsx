import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { PatchDiff } from "./patch-diff";

vi.mock("@/components/reviews/markdown", () => ({
  Markdown: ({ value }: { value: string }) => <p>{value}</p>,
}));

afterEach(cleanup);

const PATCH = "@@ -1,2 +1,2 @@\n keep\n-old\n+new";
const comment = (over: Record<string, unknown>) => ({
  id: "review-comment-1",
  kind: "review_comment" as const,
  author: { login: "bob", avatarUrl: "" },
  body: "nit",
  reviewState: null,
  path: "a.ts",
  line: 2,
  side: "RIGHT" as const,
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

describe("PatchDiff", () => {
  it("renders code as text, never as markup", () => {
    const { container } = render(
      <PatchDiff patch={"@@ -1 +1 @@\n+<img src=x onerror=alert(1)>"} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
  });

  it("shows removals and additions on separate rows when unified", () => {
    const { container } = render(<PatchDiff patch={PATCH} layout="unified" />);
    expect(container.querySelector("[data-layout=unified]")).not.toBeNull();
    expect(
      [...container.querySelectorAll("[data-kind]")].map((row) =>
        row.getAttribute("data-kind"),
      ),
    ).toEqual(["hunk", "ctx", "del", "add"]);
  });

  it("pairs a removal with its addition on one row when split", () => {
    const { container } = render(<PatchDiff patch={PATCH} layout="split" />);
    expect(container.querySelector("[data-layout=split]")).not.toBeNull();
    const kinds = [...container.querySelectorAll("[data-kind]")].map((cell) =>
      cell.getAttribute("data-kind"),
    );
    expect(kinds).toEqual(["hunk", "ctx", "ctx", "del", "add"]);
  });

  it("places an inline comment under its line and only there", () => {
    const { container } = render(
      <PatchDiff
        patch={PATCH}
        layout="unified"
        comments={[comment({ line: 2, side: "RIGHT" })]}
      />,
    );
    expect(screen.getAllByTestId("inline-comment")).toHaveLength(1);
    const rows = [...container.querySelector("[data-layout]")!.children];
    const at = rows.findIndex((row) => row.contains(screen.getByText("nit")));
    expect(rows[at - 1].getAttribute("data-kind")).toBe("add");
  });

  it("places a left-side comment under the removed line in split view", () => {
    const { container } = render(
      <PatchDiff
        patch={PATCH}
        layout="split"
        comments={[comment({ line: 2, side: "LEFT" })]}
      />,
    );
    expect(screen.getAllByTestId("inline-comment")).toHaveLength(1);
    const cells = [...container.querySelector("[data-layout]")!.children];
    const at = cells.findIndex((cell) =>
      cell.contains(screen.getByText("nit")),
    );
    expect(cells[at - 2].getAttribute("data-kind")).toBe("del");
  });
});
