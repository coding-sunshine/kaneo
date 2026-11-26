import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  decideDocumentConflict: vi.fn(),
  rejectDocumentFact: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/document/facts", () => ({
  decideDocumentConflict: mocks.decideDocumentConflict,
  rejectDocumentFact: mocks.rejectDocumentFact,
  confirmDocumentFact: vi.fn(),
  addFactDependent: vi.fn(),
  removeFactDependent: vi.fn(),
}));
vi.mock("@/fetchers/topic/facts", () => ({
  clearNeedsReview: vi.fn(),
  trackFact: vi.fn(),
  untrackFact: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { RejectFactDialog } from "./reject-fact-dialog";

const FACTS = "navigation:documents.facts";
const onClose = vi.fn();
const show = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RejectFactDialog
        workspaceId="ws"
        documentId="doc-1"
        fact={{ statementId: "st-1", slotName: "Launch date", value: "5 Mar" }}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
const submit = () =>
  screen.getByRole("button", { name: `${FACTS}.rejectSubmit` });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RejectFactDialog", () => {
  it("cannot be sent without a reason", () => {
    show();
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(`${FACTS}.reasonLabel`), {
      target: { value: "   " },
    });
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends the reason and closes on success", async () => {
    mocks.rejectDocumentFact.mockResolvedValue({});
    show();
    fireEvent.change(screen.getByLabelText(`${FACTS}.reasonLabel`), {
      target: { value: " Wrong year " },
    });
    fireEvent.click(submit());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.rejectDocumentFact).toHaveBeenCalledWith(
      {
        workspaceId: "ws",
        id: "doc-1",
        statementId: "st-1",
        reason: "Wrong year",
      },
      expect.anything(),
    );
    expect(mocks.toast.success).toHaveBeenCalledWith(`${FACTS}.rejectDone`);
  });

  it("stays open and shows the error", async () => {
    mocks.rejectDocumentFact.mockRejectedValue(new Error("Not allowed"));
    show();
    fireEvent.change(screen.getByLabelText(`${FACTS}.reasonLabel`), {
      target: { value: "x" },
    });
    fireEvent.click(submit());
    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith("Not allowed"),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
