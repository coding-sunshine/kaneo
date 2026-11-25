import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { LinkedDocumentAccessRow } from "./linked-document-access-row";

const mocks = vi.hoisted(() => ({
  audience: vi.fn(),
  share: vi.fn(),
  success: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: mocks.success, error: vi.fn() },
}));
vi.mock("@/hooks/queries/document/use-documents", () => ({
  useDocumentTaskAudience: () => ({ data: mocks.audience() }),
  useDocument: () => ({ data: { role: "owner" } }),
}));
vi.mock("@/hooks/mutations/document/use-document-mutations", () => ({
  useShareDocumentWithTask: () => ({ mutate: mocks.share, isPending: false }),
}));

const ana = { userId: "a", name: "Ana Lima", image: null };
const ben = { userId: "b", name: "Ben Ode", image: null };
const show = () =>
  render(
    <LinkedDocumentAccessRow
      workspaceId="w1"
      taskId="t1"
      documentId="d1"
      title="Launch plan"
    />,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LinkedDocumentAccessRow", () => {
  it("names the people who would gain access", () => {
    mocks.audience.mockReturnValue({ total: 3, missing: 2, gains: [ana, ben] });
    show();
    expect(
      screen.getByText(/taskGains \{"names":"Ana Lima, Ben Ode"\}/),
    ).toBeTruthy();
  });

  it("shows a toast after a successful share", () => {
    mocks.audience.mockReturnValue({ total: 3, missing: 1, gains: [ana] });
    mocks.share.mockImplementation((_vars, options) => options.onSuccess());
    show();
    fireEvent.click(
      screen.getByText("navigation:documents.share.shareWithTask"),
    );
    expect(mocks.success).toHaveBeenCalledWith(
      "navigation:documents.share.taskShared",
    );
  });

  it("renders nothing when nobody is missing", () => {
    mocks.audience.mockReturnValue({ total: 3, missing: 0, gains: [] });
    const { container } = show();
    expect(container.firstChild).toBeNull();
  });
});
