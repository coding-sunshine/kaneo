import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
import { NeedsReviewList } from "./needs-review-list";

const mocks = vi.hoisted(() => ({
  getTopicFacts: vi.fn(),
  getNeedsReview: vi.fn(),
  clearNeedsReview: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
  }: {
    children: ReactNode;
    params: Record<string, string>;
  }) => (
    <a
      href={
        params.taskId
          ? `/task/${params.taskId}`
          : `/document/${params.documentId}`
      }
    >
      {children}
    </a>
  ),
}));
vi.mock("@/fetchers/topic/facts", () => ({
  getTopicFacts: mocks.getTopicFacts,
  getNeedsReview: mocks.getNeedsReview,
  clearNeedsReview: mocks.clearNeedsReview,
}));
vi.mock("@/fetchers/document/facts", () => ({}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const FACTS = "navigation:documents.facts";
const old = {
  statementId: "s1",
  slot: "sl",
  slotName: "Launch date",
  value: "May 1",
  quote: "",
  documentId: "d1",
  documentTitle: "Plan",
  topicId: "t1",
};
const item = (over = {}) => ({
  id: "dep-1",
  flaggedAt: "2026-03-04T10:00:00.000Z",
  task: {
    id: "task-1",
    title: "Ship it",
    number: 7,
    projectId: "p1",
    projectSlug: "web",
  },
  document: null,
  dependsOn: old,
  // The replaced value itself: what holds now is read from its topic.
  cause: old,
  ...over,
});

const show = (items: unknown[]) => {
  mocks.getNeedsReview.mockResolvedValue(items);
  mocks.getTopicFacts.mockResolvedValue({
    id: "t1",
    answers: [
      {
        slot: "sl",
        value: "June 9",
        documentId: "d2",
        documentTitle: "Plan v2",
      },
    ],
  });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NeedsReviewList workspaceId="ws" />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NeedsReviewList", () => {
  it("says so when nothing needs review", async () => {
    show([]);
    expect(await screen.findByText(`${FACTS}.needsReview.empty`)).toBeTruthy();
  });

  it("shows the issue, the old value, the new value and the date", async () => {
    const { container } = show([item()]);
    expect(
      (await screen.findByRole("link", { name: /web-7/i })).getAttribute(
        "href",
      ),
    ).toBe("/task/task-1");
    const text = container.textContent;
    expect(text).toContain("Ship it");
    expect(text).toContain('"value":"May 1"');
    expect(text).toContain(formatDateMedium("2026-03-04T10:00:00.000Z"));
    expect(
      (await screen.findByRole("link", { name: "Plan v2" })).getAttribute(
        "href",
      ),
    ).toBe("/document/d2");
    expect(container.textContent).toContain(
      '{"name":"Launch date","value":"June 9"}',
    );
  });

  it("shows a document that relies on the value", async () => {
    show([item({ task: null, document: { id: "d9", title: "Brief" } })]);
    expect(
      (await screen.findByRole("link", { name: "Brief" })).getAttribute("href"),
    ).toBe("/document/d9");
  });

  it("says the change is hidden when its document cannot be opened", async () => {
    const { container } = show([item({ cause: null })]);
    await screen.findByText(`${FACTS}.needsReview.causeHidden`);
    expect(container.textContent).not.toContain("June 9");
    expect(mocks.getTopicFacts).not.toHaveBeenCalled();
  });

  it("clears the flag", async () => {
    mocks.clearNeedsReview.mockResolvedValue({});
    show([item()]);
    fireEvent.click(
      await screen.findByRole("button", { name: `${FACTS}.relies.clear` }),
    );
    await vi.waitFor(() =>
      expect(mocks.clearNeedsReview.mock.calls[0]?.[0]).toEqual({
        workspaceId: "ws",
        dependencyId: "dep-1",
      }),
    );
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(`${FACTS}.relies.clearDone`),
    );
  });
});
