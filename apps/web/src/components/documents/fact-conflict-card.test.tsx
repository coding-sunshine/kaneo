import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

import type { ReactNode } from "react";
import type { FactConflict } from "@/fetchers/document/facts";
import { FactConflictCard } from "./fact-conflict-card";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
  }: {
    children: ReactNode;
    params: { documentId: string };
  }) => <a href={`/document/${params.documentId}`}>{children}</a>,
}));

const C = "navigation:documents.facts.conflict";
const base: FactConflict = {
  id: "c-1",
  statementId: "s1",
  slotName: "Launch date",
  type: "date",
  value: "5 March",
  quote: "ships on 5 March",
  confirmed: false,
  status: "open",
  reason: null,
  tolerateUntil: null,
  current: {
    statementId: "s2",
    documentId: "doc-0",
    documentTitle: "Plan",
    value: "9 March",
    quote: "ships on 9 March",
  },
} as FactConflict;
const show = (
  conflict: Partial<FactConflict> = {},
  {
    canDecide = true,
    deciderName = "Ana" as string | null,
    canConfirm = false,
    confirmPending = false,
    onConfirm,
  }: {
    canDecide?: boolean;
    deciderName?: string | null;
    canConfirm?: boolean;
    confirmPending?: boolean;
    onConfirm?: () => void;
  } = {},
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FactConflictCard
        workspaceId="ws"
        documentId="doc-1"
        conflict={{ ...base, ...conflict }}
        canDecide={canDecide}
        deciderName={deciderName}
        canConfirm={canConfirm}
        confirmPending={confirmPending}
        onConfirm={onConfirm}
      />
    </QueryClientProvider>,
  ).container;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FactConflictCard", () => {
  it("shows both values and both quotes, and links the current document", () => {
    const text = show().textContent;
    for (const part of [
      "Launch date",
      "5 March",
      "ships on 5 March",
      "9 March",
      "ships on 9 March",
      `${C}.thisDocument`,
    ])
      expect(text).toContain(part);
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/document/doc-0",
    );
    expect(screen.getByRole("link").textContent).toContain('"title":"Plan"');
  });

  it("lets the decider decide an open conflict, and opens the dialog", () => {
    show();
    fireEvent.click(
      screen.getByRole("button", {
        name: `${C}.decideName {"name":"Launch date"}`,
      }),
    );
    expect(screen.getByText(`${C}.title {"name":"Launch date"}`)).toBeTruthy();
  });

  it("tells a reader who decides", () => {
    show({}, { canDecide: false });
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.getByText(`${C}.askDecider {"name":"Ana"}`)).toBeTruthy();
    cleanup();
    show({}, { canDecide: false, deciderName: null });
    expect(screen.getByText(`${C}.askNoDecider`)).toBeTruthy();
  });

  it("shows a tolerated conflict with its date and reason, and lets the decider change it", () => {
    const text = show({
      status: "tolerated",
      tolerateUntil: "2099-01-31T23:59:59.000Z",
      reason: "Waiting on legal",
    }).textContent;
    expect(text).toContain(`${C}.tolerated`);
    expect(text).toContain("Waiting on legal");
    const change = screen.getByRole("button", { name: `${C}.change` });
    expect(change).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: new RegExp(`${C}.decide`) }),
    ).toBeNull();
  });

  it("says a settled conflict is settled, and a reader gets no prompt", () => {
    const text = show(
      { status: "resolved", reason: "Dates agree" },
      { canDecide: false },
    ).textContent;
    expect(text).toContain(`${C}.settled`);
    expect(text).toContain("Dates agree");
    expect(text).not.toContain(`${C}.askDecider`);
  });

  it("lets an editor confirm a tolerated value without changing the decision", () => {
    const onConfirm = vi.fn();
    show(
      {
        status: "tolerated",
        tolerateUntil: "2099-01-31T23:59:59.000Z",
        reason: "Waiting on legal",
        confirmed: false,
      },
      { canDecide: true, canConfirm: true, onConfirm },
    );
    const confirm = screen.getByRole("button", {
      name: 'navigation:documents.facts.confirmName {"name":"Launch date"}',
    });
    expect(screen.getByRole("button", { name: `${C}.change` })).toBeTruthy();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(`${C}.title {"name":"Launch date"}`)).toBeNull();
  });

  it("lets an editor confirm an unconfirmed not-a-conflict value", () => {
    const onConfirm = vi.fn();
    show(
      { status: "resolved", reason: "Different scope", confirmed: false },
      { canDecide: false, canConfirm: true, onConfirm },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: 'navigation:documents.facts.confirmName {"name":"Launch date"}',
      }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: `${C}.change` })).toBeNull();
  });

  it("hides confirm once confirmed, on open conflicts, and for readers", () => {
    const onConfirm = vi.fn();
    show(
      {
        status: "tolerated",
        tolerateUntil: "2099-01-31T23:59:59.000Z",
        confirmed: true,
      },
      { canConfirm: true, onConfirm },
    );
    expect(screen.queryByRole("button", { name: /confirmName/ })).toBeNull();
    expect(
      screen.getByText("navigation:documents.facts.status.confirmed"),
    ).toBeTruthy();

    cleanup();
    show({ status: "open", confirmed: false }, { canConfirm: true, onConfirm });
    expect(screen.queryByRole("button", { name: /confirmName/ })).toBeNull();

    cleanup();
    show(
      {
        status: "tolerated",
        tolerateUntil: "2099-01-31T23:59:59.000Z",
        confirmed: false,
      },
      { canDecide: false, canConfirm: false, onConfirm },
    );
    expect(screen.queryAllByRole("button")).toEqual([]);
  });
});
