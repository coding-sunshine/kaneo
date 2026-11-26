import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DocumentReliesOn } from "./document-relies-on";

const mocks = vi.hoisted(() => ({
  getDocumentReliedTopics: vi.fn(),
  getTopics: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/t">{children}</a>,
}));
vi.mock("@/fetchers/document/facts", () => ({
  getDocumentReliedTopics: mocks.getDocumentReliedTopics,
}));
vi.mock("@/fetchers/topic/topics", () => ({ getTopics: mocks.getTopics }));
// The values themselves are ReliedFacts' business; here only which topics show.
vi.mock("./relied-facts", () => ({
  ReliedFacts: ({
    topicId,
    work,
  }: {
    topicId: string;
    work: { documentId: string };
  }) => <p>{`facts of ${topicId} for ${work.documentId}`}</p>,
}));

const topics = [
  { id: "t1", name: "Pricing", parentName: null },
  { id: "t2", name: "Launch plan", parentName: "Growth" },
];
const KEY = "navigation:documents.facts.reliesOn";

const show = (relied: string[], canEdit = true) => {
  mocks.getDocumentReliedTopics.mockResolvedValue({ topicIds: relied });
  mocks.getTopics.mockResolvedValue(topics);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentReliesOn
        workspaceId="ws"
        documentId="memo-1"
        canEdit={canEdit}
      />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DocumentReliesOn", () => {
  it("shows the topics the document relies on, and adds another to rely on", async () => {
    show(["t1"]);
    expect(await screen.findByText("facts of t1 for memo-1")).toBeTruthy();
    expect(mocks.getDocumentReliedTopics).toHaveBeenCalledWith("ws", "memo-1");
    expect(screen.queryByText("facts of t2 for memo-1")).toBeNull();

    const pick = screen.getByRole("combobox", { name: `${KEY}.pick` });
    // A topic already shown is not offered again.
    expect(screen.queryByRole("option", { name: "Pricing" })).toBeNull();
    fireEvent.change(pick, { target: { value: "t2" } });
    expect(await screen.findByText("facts of t2 for memo-1")).toBeTruthy();
  });

  it("offers no topic to a reader who cannot edit", async () => {
    show(["t1"], false);
    await screen.findByText("facts of t1 for memo-1");
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
