import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { toast } from "@/lib/toast";
import { TrackFactDialog } from "./track-fact-dialog";

const mocks = vi.hoisted(() => ({ trackFact: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/document/facts", () => ({}));
vi.mock("@/fetchers/topic/facts", () => ({ trackFact: mocks.trackFact }));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const K = "navigation:documents.facts.topic";
const onClose = vi.fn();
const open = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TrackFactDialog workspaceId="ws" topicId="t1" onClose={onClose} />
    </QueryClientProvider>,
  );
const submit = () =>
  screen.getByRole("button", { name: `${K}.trackSubmit` }) as HTMLButtonElement;
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(new RegExp(label)), {
    target: { value },
  });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TrackFactDialog", () => {
  it("cannot submit without a name", () => {
    open();
    expect(submit().disabled).toBe(true);
    type(`${K}.nameLabel`, "  ");
    expect(submit().disabled).toBe(true);
    type(`${K}.nameLabel`, "Launch date");
    expect(submit().disabled).toBe(false);
  });

  it("sends a date fact without options", async () => {
    mocks.trackFact.mockResolvedValue({});
    open();
    type(`${K}.nameLabel`, " Launch date ");
    fireEvent.click(submit());
    await waitFor(() =>
      expect(mocks.trackFact.mock.calls[0]?.[0]).toEqual({
        workspaceId: "ws",
        id: "t1",
        name: "Launch date",
        type: "date",
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalled();
  });

  it("needs two choices for a list, and sends them trimmed and unique", async () => {
    mocks.trackFact.mockResolvedValue({});
    open();
    type(`${K}.nameLabel`, "Tier");
    type(`${K}.typeLabel`, "enum");
    expect(submit().disabled).toBe(true);
    type(`${K}.optionsLabel`, "Gold, ,Gold");
    expect(submit().disabled).toBe(true);
    type(`${K}.optionsLabel`, " Gold, Silver ,Gold,");
    expect(submit().disabled).toBe(false);
    fireEvent.click(submit());
    await waitFor(() =>
      expect(mocks.trackFact.mock.calls[0]?.[0]).toEqual({
        workspaceId: "ws",
        id: "t1",
        name: "Tier",
        type: "enum",
        options: ["Gold", "Silver"],
      }),
    );
  });

  it("stays open and says why when the call fails", async () => {
    mocks.trackFact.mockRejectedValue(new Error("Already tracked"));
    open();
    type(`${K}.nameLabel`, "Launch date");
    fireEvent.click(submit());
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Already tracked"),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
