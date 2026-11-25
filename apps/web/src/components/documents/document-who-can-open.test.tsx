import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DocumentWhoCanOpen } from "./document-who-can-open";

const getDocumentAudience = vi.fn();
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/document/documents", () => ({
  getDocumentAudience: (...args: unknown[]) => getDocumentAudience(...args),
}));

const WHO = "navigation:documents.whoCanOpen";
const person = (name: string) => ({ userId: name, name, image: null });
const show = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <DocumentWhoCanOpen workspaceId="ws-1" id="doc-1" />
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DocumentWhoCanOpen", () => {
  it("counts and names the people who can open the document now", async () => {
    getDocumentAudience.mockResolvedValue({
      current: [person("Ana Lima"), person("Ben Ode")],
      proposed: null,
    });
    show();
    expect(screen.getByText(`${WHO}.loading`)).toBeTruthy();
    expect(await screen.findByText(`${WHO}.count {"count":2}`)).toBeTruthy();
    expect(screen.getByText("Ana Lima, Ben Ode")).toBeTruthy();
    expect(screen.queryByText(`${WHO}.loading`)).toBeNull();
    // No place: the question is who can open it as it is.
    expect(getDocumentAudience).toHaveBeenCalledWith("ws-1", "doc-1", {});
  });

  it("says so when the people could not be loaded", async () => {
    getDocumentAudience.mockRejectedValue(new Error("nope"));
    show();
    expect(await screen.findByText(`${WHO}.failed`)).toBeTruthy();
    expect(screen.queryByText(/whoCanOpen\.count/)).toBeNull();
  });
});
