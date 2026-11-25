import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DocumentSummary } from "@/fetchers/document/documents";
import { InboxList } from "./inbox-list";

const mocks = vi.hoisted(() => ({ snoozeDocument: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/fetchers/document/documents", () => ({
  snoozeDocument: mocks.snoozeDocument,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const DAY = 86_400_000;
const INBOX = "navigation:documents.inbox";
const doc = (id: string, daysOld: number, snoozedUntil: string | null = null) =>
  ({
    id,
    title: id,
    status: "draft",
    parentName: "Growth",
    creatorName: "Ada",
    creatorImage: null,
    createdAt: new Date(Date.now() - daysOld * DAY).toISOString(),
    updatedAt: new Date(Date.now() - daysOld * DAY).toISOString(),
    snoozedUntil,
  }) as unknown as DocumentSummary;
const LATER = new Date(Date.now() + 30 * DAY).toISOString();

const show = (documents: DocumentSummary[]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <InboxList workspaceId="ws" documents={documents} />
    </QueryClientProvider>,
  );
const rowOf = (title: string) => {
  const row = screen.getByText(title).closest("li");
  if (!row) throw new Error(`no row for ${title}`);
  return within(row);
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InboxList", () => {
  it("counts the age from the oldest document that still waits", () => {
    show([doc("Fresh", 1), doc("Waiting", 3), doc("Aside", 40, LATER)]);

    const age = screen.getByText(new RegExp(`^${INBOX}\\.oldest `));
    expect(age.textContent).toContain("3 days ago");
    // A snoozed document sits in its own group and offers the way back.
    const snoozed = screen.getByRole("region", { name: `${INBOX}.snoozed` });
    expect(within(snoozed).getByText("Aside")).toBeTruthy();
    expect(within(snoozed).queryByText("Waiting")).toBeNull();
    expect(
      rowOf("Aside").getByRole("button", { name: `${INBOX}.unsnooze` }),
    ).toBeTruthy();
    expect(
      rowOf("Waiting").queryByRole("button", { name: `${INBOX}.unsnooze` }),
    ).toBeNull();
  });

  it("says so when every document is snoozed", () => {
    show([doc("Aside", 40, LATER)]);

    expect(screen.getByText(`${INBOX}.nothingWaiting`)).toBeTruthy();
    expect(screen.queryByText(new RegExp(`^${INBOX}\\.oldest `))).toBeNull();
  });

  it("snoozes a document to the start of the day picked", async () => {
    mocks.snoozeDocument.mockResolvedValue({});
    show([doc("Waiting", 3)]);

    fireEvent.click(
      rowOf("Waiting").getByRole("button", { name: `${INBOX}.snooze` }),
    );
    fireEvent.change(await screen.findByLabelText(`${INBOX}.snoozeUntil`), {
      target: { value: "2099-03-04" },
    });
    fireEvent.click(screen.getByRole("button", { name: `${INBOX}.confirm` }));

    await waitFor(() =>
      expect(mocks.snoozeDocument).toHaveBeenCalledWith(
        "ws",
        "Waiting",
        new Date(2099, 2, 4).toISOString(),
      ),
    );
  });

  it("brings a snoozed document back", async () => {
    mocks.snoozeDocument.mockResolvedValue({});
    show([doc("Aside", 40, LATER)]);

    fireEvent.click(
      rowOf("Aside").getByRole("button", { name: `${INBOX}.unsnooze` }),
    );

    await waitFor(() =>
      expect(mocks.snoozeDocument).toHaveBeenCalledWith("ws", "Aside", null),
    );
  });
});
