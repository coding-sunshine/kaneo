import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { OnboardingChecklist } from "./onboarding-checklist";

const { getChecklist, completeItem, dismiss } = vi.hoisted(() => ({
  getChecklist: vi.fn(),
  completeItem: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("@/fetchers/onboarding/get-onboarding-checklist", () => ({
  default: getChecklist,
}));
vi.mock("@/fetchers/onboarding/complete-checklist-item", () => ({
  default: completeItem,
}));
vi.mock("@/fetchers/onboarding/dismiss-checklist", () => ({
  default: dismiss,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    onClick,
  }: PropsWithChildren<{ to: string; onClick?: () => void }>) => (
    <a
      href={to}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));

const checklist = (done: string[] = []) => ({
  workspaceId: "ws",
  handbookDocumentId: "doc",
  welcomeChannelId: "chan",
  sampleTask: { id: "task", projectId: "proj" },
  items: [
    "set-status",
    "read-handbook",
    "say-hello",
    "open-sample-ticket",
    "invite-teammate",
  ].map((id) => ({ id, done: done.includes(id) })),
});

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
});

function mount() {
  return render(
    <QueryClientProvider client={client}>
      <OnboardingChecklist />
    </QueryClientProvider>,
  );
}

it("lists five linked items with the done count", async () => {
  getChecklist.mockResolvedValue(checklist(["set-status"]));
  mount();

  expect(await screen.findAllByRole("link")).toHaveLength(5);
  expect(
    screen.getByRole("link", {
      name: "workspace:home.checklist.items.setStatus",
    }),
  ).toBeTruthy();
  expect(screen.getByText("workspace:home.checklist.done")).toBeTruthy();
});

it("ticks a linked item when it is followed, but never the status", async () => {
  getChecklist.mockResolvedValue(checklist());
  completeItem.mockResolvedValue(checklist(["read-handbook"]));
  mount();

  fireEvent.click(
    await screen.findByRole("link", {
      name: "workspace:home.checklist.items.setStatus",
    }),
  );
  expect(completeItem).not.toHaveBeenCalled();

  fireEvent.click(
    screen.getByRole("link", {
      name: "workspace:home.checklist.items.readHandbook",
    }),
  );
  await waitFor(() =>
    expect(completeItem).toHaveBeenCalledWith(
      "read-handbook",
      expect.anything(),
    ),
  );
  expect(await screen.findByText("workspace:home.checklist.done")).toBeTruthy();
});

it("goes away when dismissed", async () => {
  getChecklist.mockResolvedValue(checklist());
  dismiss.mockResolvedValue({ dismissed: true });
  mount();

  fireEvent.click(
    await screen.findByRole("button", {
      name: "workspace:home.checklist.dismiss",
    }),
  );
  await waitFor(() => expect(screen.queryByRole("link")).toBeNull());
});

it("renders nothing for people without a checklist", async () => {
  getChecklist.mockResolvedValue(null);
  const { container } = mount();
  await waitFor(() => expect(getChecklist).toHaveBeenCalled());
  expect(container.innerHTML).toBe("");
});
