import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { MakeCurrentDialog } from "./make-current-dialog";

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  getDocumentVersions: vi.fn(),
  makeDocumentCurrent: vi.fn(),
}));

// Prints what a key was given, so a test can see the count in the reason.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/document/documents", () => ({
  getDocument: mocks.getDocument,
  getDocumentVersions: mocks.getDocumentVersions,
}));
vi.mock("@/fetchers/topic/topics", () => ({
  makeDocumentCurrent: mocks.makeDocumentCurrent,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const BEFORE = "We ship on Monday. Price is $40. Sales knows.";
const AFTER = "We ship on Friday. Price is $40. Sales knows. Ads start later.";
const REASON = "navigation:documents.makeCurrent";

const show = (
  document: { status: "in_review" | "current"; content: string },
  currentDocumentId: string | null,
  initialReason?: string,
) => {
  const onClose = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MakeCurrentDialog
        document={{
          workspaceId: "ws-1",
          id: "doc-1",
          approvedVersionId: "version-approved",
          ...document,
        }}
        topic={{ id: "topic-1", name: "Launch plan", currentDocumentId }}
        initialReason={initialReason}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return onClose;
};
const reason = () => screen.getByRole("textbox") as HTMLTextAreaElement;
const sentences = (name: string) =>
  Array.from(
    screen.getByRole("region", { name }).querySelectorAll("li"),
    (item) => item.textContent,
  );

describe("MakeCurrentDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("starts a topic with the reason filled in and nothing to compare", async () => {
    mocks.makeDocumentCurrent.mockResolvedValue({});
    const onClose = show({ status: "in_review", content: AFTER }, null);

    expect(reason().value).toBe(`${REASON}.reasonStart`);
    expect(screen.queryByRole("region")).toBeNull();
    expect(mocks.getDocument).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: `${REASON}.submit` }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.makeDocumentCurrent).toHaveBeenCalledWith(
      { workspaceId: "ws-1", id: "topic-1", documentId: "doc-1" },
      `${REASON}.reasonStart`,
    );
  });

  it("shows a proposal's changed sentences against the document it replaces", async () => {
    mocks.getDocument.mockResolvedValue({ id: "doc-0", content: BEFORE });
    mocks.makeDocumentCurrent.mockResolvedValue({});
    show({ status: "in_review", content: AFTER }, "doc-0");

    // Two added, one removed: two sentences to read, and no document title.
    await waitFor(() =>
      expect(reason().value).toBe(`${REASON}.reasonReplaces {"count":2}`),
    );
    expect(mocks.getDocument).toHaveBeenCalledWith("ws-1", "doc-0");
    expect(sentences(`${REASON}.added`)).toEqual([
      "We ship on Friday.",
      "Ads start later.",
    ]);
    expect(sentences(`${REASON}.removed`)).toEqual(["We ship on Monday."]);

    // The decider may say it in their own words.
    fireEvent.change(reason(), { target: { value: "  Launch moved.  " } });
    fireEvent.click(screen.getByRole("button", { name: `${REASON}.submit` }));
    await waitFor(() =>
      expect(mocks.makeDocumentCurrent).toHaveBeenCalledWith(
        { workspaceId: "ws-1", id: "topic-1", documentId: "doc-1" },
        "Launch moved.",
      ),
    );
  });

  it("compares an edited current document with the text that was approved", async () => {
    mocks.getDocumentVersions.mockResolvedValue([
      { id: "version-later", content: "Something else entirely." },
      { id: "version-approved", content: BEFORE },
    ]);
    show({ status: "current", content: AFTER }, "doc-1");

    await waitFor(() =>
      expect(reason().value).toBe(`${REASON}.reasonEdit {"count":2}`),
    );
    expect(sentences(`${REASON}.removed`)).toEqual(["We ship on Monday."]);
    // Its own earlier text is the base, not the topic's current document.
    expect(mocks.getDocument).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: `${REASON}.approve` }),
    ).toBeTruthy();
  });

  it("starts the reason from the one it is given", () => {
    show({ status: "in_review", content: AFTER }, null, "Agreed on Monday");
    expect(reason().value).toBe("Agreed on Monday");
  });

  it("never says that nothing changed", async () => {
    mocks.getDocumentVersions.mockResolvedValue([
      { id: "version-approved", content: "First this. Then that." },
    ]);
    show(
      { status: "current", content: "Then that.\n\n**First this.**" },
      "doc-1",
    );

    await waitFor(() =>
      expect(reason().value).toBe(`${REASON}.reasonEditFormat`),
    );
    expect(screen.getByText(`${REASON}.formatOnly`)).toBeTruthy();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("asks for a reason when the earlier text cannot be read", async () => {
    mocks.getDocumentVersions.mockResolvedValue([]);
    show({ status: "current", content: AFTER }, "doc-1");

    expect(await screen.findByText(`${REASON}.noBase`)).toBeTruthy();
    expect(reason().value).toBe("");
    expect(
      (
        screen.getByRole("button", {
          name: `${REASON}.approve`,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
