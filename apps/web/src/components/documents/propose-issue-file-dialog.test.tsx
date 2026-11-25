import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ProposeIssueFileDialog } from "./propose-issue-file-dialog";

const mocks = vi.hoisted(() => ({
  getIssueFileAudience: vi.fn(),
  proposeIssueFile: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/document/issue-files", () => ({
  getIssueFileAudience: mocks.getIssueFileAudience,
  proposeIssueFile: mocks.proposeIssueFile,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const person = (name: string) => ({ userId: name, name, image: null });
const AUDIENCE = "navigation:documents.audience";
const submit = () =>
  screen.getByRole("button", {
    name: "navigation:documents.issueFiles.dialog.submit",
  }) as HTMLButtonElement;

const show = () => {
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ProposeIssueFileDialog
        workspaceId="ws-1"
        file={{ id: "asset-1", filename: "plan.pdf" }}
        topic={{ id: "topic-1", name: "Pricing" }}
        open
        onOpenChange={onOpenChange}
      />
    </QueryClientProvider>,
  );
  return onOpenChange;
};

describe("ProposeIssueFileDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("waits for the audience, shows both, then proposes", async () => {
    mocks.getIssueFileAudience.mockResolvedValue({
      current: [person("Author"), person("Guest")],
      proposed: [person("Author"), person("Ana")],
    });
    mocks.proposeIssueFile.mockResolvedValue({});
    const onOpenChange = show();

    expect(submit().disabled).toBe(true);
    expect(
      await screen.findByText(`${AUDIENCE}.count {"count":2}`),
    ).toBeTruthy();
    expect(mocks.getIssueFileAudience).toHaveBeenCalledWith(
      "ws-1",
      "asset-1",
      "topic-1",
    );
    expect(screen.getByText(`${AUDIENCE}.gains {"names":"Ana"}`)).toBeTruthy();
    expect(
      screen.getByText(`${AUDIENCE}.loses {"names":"Guest"}`),
    ).toBeTruthy();
    expect(mocks.proposeIssueFile).not.toHaveBeenCalled();

    fireEvent.click(submit());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mocks.proposeIssueFile).toHaveBeenCalledWith(
      "ws-1",
      "asset-1",
      "topic-1",
    );
  });
});
