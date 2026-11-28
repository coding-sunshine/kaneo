import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { SemanticAnswer } from "./semantic-answer";

const search = vi.fn();
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));
vi.mock("@/fetchers/semantic-search/semantic-search", () => ({
  semanticSearch: (...args: unknown[]) => search(...args),
}));

const renderAnswer = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SemanticAnswer
        workspaceId="ws1"
        query="why did we pick the new vendor"
      />
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SemanticAnswer", () => {
  it("shows the cited answer", async () => {
    const source = {
      kind: "message",
      restricted: false,
      id: "m1",
      channelId: "c1",
      channelName: "general",
    };
    search.mockResolvedValue({
      answer: "Northwind was chosen for support.",
      sources: [source],
      results: [
        {
          kind: "message",
          id: "m1",
          snippet: "We chose Northwind",
          citation: source,
        },
      ],
    });
    renderAnswer();
    fireEvent.click(screen.getByText("workspace:search.semantic.ask"));
    expect(
      await screen.findByText("Northwind was chosen for support."),
    ).toBeTruthy();
    expect(search).toHaveBeenCalledWith(
      "ws1",
      "why did we pick the new vendor",
    );
    expect(screen.getAllByText("general")).toHaveLength(2);
  });

  it("says semantic search is off when the server has no key", async () => {
    search.mockRejectedValue(new HttpError(404, "Not found"));
    renderAnswer();
    fireEvent.click(screen.getByText("workspace:search.semantic.ask"));
    expect(
      await screen.findByText("workspace:search.semantic.off"),
    ).toBeTruthy();
  });
});
