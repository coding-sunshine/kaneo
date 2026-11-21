import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { WorkProjectResources } from "./work-project-resources";

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

afterEach(cleanup);

function renderResources(editable: boolean) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkProjectResources
        workspaceId="ws-1"
        workProjectId="wp-1"
        editable={editable}
      />
    </QueryClientProvider>,
  );
}

describe("work project resources", () => {
  it("shows the project's documents and adds one to the project", async () => {
    getDocuments.mockResolvedValue([{ id: "doc-1", title: "Brief" }]);
    renderResources(true);
    expect(await screen.findByRole("link", { name: "Brief" })).toBeTruthy();
    expect(getDocuments).toHaveBeenCalledWith("ws-1", {
      workProjectId: "wp-1",
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "workspace:workProject.detail.addDocument",
      }),
    );
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
});
