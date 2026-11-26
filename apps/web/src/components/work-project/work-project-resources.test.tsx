import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { removeWorkProjectLink } from "@/fetchers/work-project/links";
import type { WorkProjectLink } from "@/fetchers/work-project/types";
import { toast } from "@/lib/toast";
import { WorkProjectResources } from "./work-project-resources";

vi.mock("@/fetchers/work-project/links", () => ({
  addWorkProjectLink: vi.fn(),
  removeWorkProjectLink: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
const getDocuments = vi.fn();
vi.mock("@/fetchers/document/documents", () => ({
  getDocuments: (...args: unknown[]) => getDocuments(...args),
}));
const create = vi.fn();
vi.mock("@/components/documents/use-new-document", () => ({
  useNewDocument: () => ({ create, isPending: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/doc">{children}</a>
  ),
}));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(removeWorkProjectLink).mockResolvedValue({ id: "x" } as never);
});
afterEach(cleanup);

const link = (over: Partial<WorkProjectLink>): WorkProjectLink => ({
  id: "l-1",
  url: "https://www.example.com/page",
  label: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

async function openMenu(item: string) {
  fireEvent.click(
    screen.getByRole("button", { name: "settings:externalLinks.addResource" }),
  );
  fireEvent.click(await screen.findByRole("menuitem", { name: item }));
}

function renderResources(editable: boolean, links: WorkProjectLink[] = []) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkProjectResources
        workspaceId="ws-1"
        workProjectId="wp-1"
        editable={editable}
        links={links}
      />
    </QueryClientProvider>,
  );
}

describe("work project resources", () => {
  it("shows the project's documents and adds one to the project", async () => {
    getDocuments.mockResolvedValue([
      { id: "doc-1", title: "Brief", scope: "project" },
    ]);
    renderResources(true);
    const chip = await screen.findByRole("link", { name: /Brief/ });
    // Each chip says which place decides who can open the document.
    expect(chip.textContent).toContain(
      "navigation:documents.accessLabel.project",
    );
    expect(getDocuments).toHaveBeenCalledWith("ws-1", {
      workProjectId: "wp-1",
    });
    await openMenu("settings:externalLinks.addDocument");
    expect(create).toHaveBeenCalledWith({ workProjectId: "wp-1" });
  });

  it("hides the empty row from people who cannot add documents", async () => {
    getDocuments.mockResolvedValue([]);
    renderResources(false);
    await Promise.resolve();
    expect(
      screen.queryByText("workspace:workProject.detail.resources"),
    ).toBeNull();
  });

  it("opens a web link in a new tab, with the host when it has no label", async () => {
    getDocuments.mockResolvedValue([]);
    renderResources(false, [link({})]);
    const chip = await screen.findByRole("link", { name: /example\.com/ });
    expect(chip.textContent).toBe("example.com");
    expect(chip).toHaveAttribute("href", "https://www.example.com/page");
    expect(chip).toHaveAttribute("target", "_blank");
    expect(chip).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("opens a path link in the same tab and shows the path as its text", async () => {
    getDocuments.mockResolvedValue([]);
    renderResources(false, [link({ url: "/dashboard/x", label: "" })]);
    const chip = await screen.findByRole("link", { name: "/dashboard/x" });
    expect(chip).toHaveAttribute("href", "/dashboard/x");
    expect(chip).not.toHaveAttribute("target");
  });

  it("never renders an unsafe address as a link", async () => {
    getDocuments.mockResolvedValue([]);
    renderResources(false, [
      link({ url: "javascript:alert(1)", label: "Bad" }),
    ]);
    await screen.findByText("Bad");
    expect(screen.queryByRole("link", { name: /Bad/ })).toBeNull();
  });

  it("shows chips to a viewer who cannot edit, without remove or plus", async () => {
    getDocuments.mockResolvedValue([]);
    renderResources(false, [link({ label: "Spec" })]);
    expect(await screen.findByText("Spec")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("removes a link by its id and reports a failure", async () => {
    getDocuments.mockResolvedValue([]);
    renderResources(true, [link({ label: "Spec" })]);
    const remove = await screen.findByRole("button", {
      name: "settings:externalLinks.remove",
    });
    fireEvent.click(remove);
    await waitFor(() =>
      expect(removeWorkProjectLink).toHaveBeenCalledWith("wp-1", "l-1"),
    );
    vi.mocked(removeWorkProjectLink).mockRejectedValue(new Error("no"));
    fireEvent.click(remove);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "settings:externalLinks.removeError",
      ),
    );
  });

  it("opens the add-link dialog from the menu", async () => {
    getDocuments.mockResolvedValue([]);
    renderResources(true);
    await openMenu("settings:externalLinks.addLink");
    expect(
      await screen.findByLabelText("settings:externalLinks.url"),
    ).toBeTruthy();
  });
});
