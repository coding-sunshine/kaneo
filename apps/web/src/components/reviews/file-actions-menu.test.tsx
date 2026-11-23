import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import "@/lib/i18n";
import { FileActionsMenu } from "./file-actions-menu";

const copyText = vi.hoisted(() => vi.fn());
vi.mock("@/lib/copy-text", () => ({ copyText }));

afterEach(cleanup);

it("copies the path and links to the file on GitHub", async () => {
  render(
    <FileActionsMenu
      filename="src/a.ts"
      githubUrl="https://github.com/o/r/blob/abc/src/a.ts"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "File actions" }));
  expect(
    await screen.findByRole("menuitem", { name: /Open on GitHub/ }),
  ).toHaveAttribute("href", "https://github.com/o/r/blob/abc/src/a.ts");
  fireEvent.click(screen.getByRole("menuitem", { name: /Copy path/ }));
  expect(copyText.mock.calls[0][0]).toBe("src/a.ts");
});

it("omits the GitHub link for a removed file", async () => {
  render(<FileActionsMenu filename="gone.ts" githubUrl={null} />);
  fireEvent.click(screen.getByRole("button", { name: "File actions" }));
  await screen.findByRole("menuitem", { name: /Copy path/ });
  expect(screen.queryByRole("menuitem", { name: /Open on GitHub/ })).toBeNull();
});
