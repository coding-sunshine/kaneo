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

import { DecideConflictDialog } from "./decide-conflict-dialog";

const C = "navigation:documents.facts.conflict";
const onClose = vi.fn();
const conflict = {
  id: "c-1",
  slotName: "Launch date",
  value: "5 Mar",
  current: {
    statementId: "s2",
    documentId: "doc-0",
    documentTitle: "Plan",
    value: "9 Mar",
    quote: "on 9 March",
  },
};
const show = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DecideConflictDialog
        workspaceId="ws"
        documentId="doc-1"
        conflict={conflict}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
const submit = () =>
  screen.getByRole("button", { name: `${C}.submit` }) as HTMLButtonElement;
const choose = (key: string) =>
  fireEvent.click(
    screen.getByRole("radio", { name: new RegExp(`options.${key}`) }),
  );
const writeReason = () =>
  fireEvent.change(
    screen.getByLabelText("navigation:documents.facts.reasonLabel"),
    {
      target: { value: " Because " },
    },
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DecideConflictDialog", () => {
  it("offers the four choices, none chosen, and needs a choice and a reason", () => {
    show();
    expect(screen.getByText(`${C}.title {"name":"Launch date"}`)).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
    expect(submit().disabled).toBe(true);
    writeReason();
    expect(submit().disabled).toBe(true);
    choose("keep");
    expect(submit().disabled).toBe(false);
  });

  it("asks for a date only when both stand, and requires it", () => {
    show();
    writeReason();
    expect(screen.queryByLabelText(`${C}.until`)).toBeNull();
    choose("tolerate");
    const date = screen.getByLabelText(`${C}.until`) as HTMLInputElement;
    expect(date.type).toBe("date");
    expect(submit().disabled).toBe(true);
    fireEvent.change(date, { target: { value: "2099-01-31" } });
    expect(submit().disabled).toBe(false);
  });

  it("sends a replace decision without a date, then closes", async () => {
    mocks.decideDocumentConflict.mockResolvedValue({});
    show();
    choose("replace");
    writeReason();
    fireEvent.click(submit());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.decideDocumentConflict).toHaveBeenCalledWith(
      {
        workspaceId: "ws",
        id: "doc-1",
        conflictId: "c-1",
        decision: "replace",
        reason: "Because",
        tolerateUntil: undefined,
      },
      expect.anything(),
    );
    expect(mocks.toast.success).toHaveBeenCalledWith(`${C}.done`);
  });

  it("sends the end of the chosen day for a tolerated conflict", async () => {
    mocks.decideDocumentConflict.mockResolvedValue({});
    show();
    choose("tolerate");
    writeReason();
    fireEvent.change(screen.getByLabelText(`${C}.until`), {
      target: { value: "2099-01-31" },
    });
    fireEvent.click(submit());
    await waitFor(() =>
      expect(mocks.decideDocumentConflict).toHaveBeenCalled(),
    );
    expect(mocks.decideDocumentConflict).toHaveBeenCalledWith(
      {
        workspaceId: "ws",
        id: "doc-1",
        conflictId: "c-1",
        decision: "tolerate",
        reason: "Because",
        tolerateUntil: new Date("2099-01-31T23:59:59").toISOString(),
      },
      expect.anything(),
    );
  });

  it("stays open and shows the error", async () => {
    mocks.decideDocumentConflict.mockRejectedValue(
      new Error("Not the decider"),
    );
    show();
    choose("keep");
    writeReason();
    fireEvent.click(submit());
    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith("Not the decider"),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
