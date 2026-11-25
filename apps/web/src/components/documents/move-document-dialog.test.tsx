import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { MoveDocumentDialog } from "./move-document-dialog";

const mocks = vi.hoisted(() => ({
  getDocumentAudience: vi.fn(),
  moveDocument: vi.fn(),
  success: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/document/documents", () => ({
  getDocumentAudience: mocks.getDocumentAudience,
  moveDocument: mocks.moveDocument,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: mocks.success, error: vi.fn() },
}));

const person = (name: string) => ({ userId: name, name, image: null });
const AUDIENCE = "navigation:documents.audience";
const MOVE = "navigation:documents.move";
const location = { scope: "team" as const, projectId: "team-1" };

const show = () => {
  const onClose = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MoveDocumentDialog
        workspaceId="ws-1"
        document={{ id: "doc-1", title: "Launch plan" }}
        target={{ location, name: "Alpha" }}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return onClose;
};
const confirm = () => screen.getByText(`${MOVE}.confirm`) as HTMLButtonElement;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MoveDocumentDialog", () => {
  it("asks the audience for the place and names who gains and loses", async () => {
    mocks.getDocumentAudience.mockResolvedValue({
      current: [person("Ana Lima"), person("Ben Ode")],
      proposed: [person("Ana Lima"), person("Cy Park")],
    });
    show();
    await screen.findByText(`${AUDIENCE}.gains {"names":"Cy Park"}`);
    expect(
      screen.getByText(`${AUDIENCE}.loses {"names":"Ben Ode"}`),
    ).toBeTruthy();
    expect(mocks.getDocumentAudience).toHaveBeenCalledWith("ws-1", "doc-1", {
      scope: "team",
      projectId: "team-1",
    });
  });

  it("keeps Move disabled until the audience arrived", async () => {
    mocks.getDocumentAudience.mockResolvedValue({
      current: [person("Ana Lima")],
      proposed: [person("Ana Lima")],
    });
    show();
    expect(confirm().closest("button")?.disabled).toBe(true);
    await waitFor(() =>
      expect(confirm().closest("button")?.disabled).toBe(false),
    );
  });

  it("keeps Move disabled when the audience failed", async () => {
    mocks.getDocumentAudience.mockRejectedValue(new Error("no"));
    show();
    await screen.findByText(`${AUDIENCE}.failed`);
    expect(confirm().closest("button")?.disabled).toBe(true);
  });

  it("moves to the location, shows the toast and closes", async () => {
    mocks.getDocumentAudience.mockResolvedValue({
      current: [person("Ana Lima")],
      proposed: [person("Ana Lima")],
    });
    mocks.moveDocument.mockResolvedValue({ id: "doc-1" });
    const onClose = show();
    await waitFor(() =>
      expect(confirm().closest("button")?.disabled).toBe(false),
    );
    fireEvent.click(confirm());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.moveDocument).toHaveBeenCalledWith("ws-1", "doc-1", location);
    expect(mocks.success).toHaveBeenCalledWith("navigation:documents.moved");
  });

  it("closes on Cancel and moves nothing", () => {
    mocks.getDocumentAudience.mockResolvedValue({ current: [], proposed: [] });
    const onClose = show();
    fireEvent.click(screen.getByText("common:actions.cancel"));
    expect(onClose).toHaveBeenCalled();
    expect(mocks.moveDocument).not.toHaveBeenCalled();
  });
});
