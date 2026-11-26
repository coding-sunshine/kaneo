import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import OwnerlessDocuments from "./ownerless-documents";

const mocks = vi.hoisted(() => ({
  getOwnerlessDocuments: vi.fn(),
  handOverDocuments: vi.fn(),
  takeOverDocument: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/document/documents", () => ({
  getOwnerlessDocuments: mocks.getOwnerlessDocuments,
  handOverDocuments: mocks.handOverDocuments,
  takeOverDocument: mocks.takeOverDocument,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const KEY = "team:membersTable";
const doc = (
  id: string,
  creatorId: string | null,
  creatorName: string | null,
) => ({
  id,
  title: `Title ${id}`,
  updatedAt: "2026-11-20T10:00:00.000Z",
  creatorId,
  creatorName,
});
const members = [
  { userId: "member-1", name: "Owner Person" },
  { userId: "member-2", name: "Colleague" },
];

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <OwnerlessDocuments workspaceId="ws-1" members={members} />
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OwnerlessDocuments", () => {
  it("gives the drafts of a member who already left to a colleague", async () => {
    mocks.getOwnerlessDocuments.mockResolvedValue([
      doc("d1", "left-1", "Former Person"),
      doc("d2", "left-1", "Former Person"),
      doc("d3", null, null),
    ]);
    mocks.handOverDocuments.mockResolvedValue({ moved: 2 });
    show();

    expect(
      await screen.findByText(`${KEY}.ownerlessFrom {"name":"Former Person"}`),
    ).toBeTruthy();
    // One choice per person who left; a deleted account has nobody to name.
    const pick = screen.getByRole("combobox", {
      name: `${KEY}.handOverLabel`,
    });
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    const give = screen.getByRole("button", { name: `${KEY}.handOverGive` });
    expect((give as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(pick, { target: { value: "member-2" } });
    fireEvent.click(give);

    await waitFor(() =>
      expect(mocks.handOverDocuments).toHaveBeenCalledWith(
        "ws-1",
        "left-1",
        "member-2",
      ),
    );
    // Each draft can still be taken over one by one.
    expect(
      screen.getAllByRole("button", { name: `${KEY}.takeOver` }),
    ).toHaveLength(3);
  });
});
