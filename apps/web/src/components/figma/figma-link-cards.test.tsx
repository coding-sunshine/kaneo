import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { FigmaLinkCards } from "./figma-link-cards";

const KEY = "AbCdEf0123456789xyzQrs";
const FRAME_URL = `https://www.figma.com/design/${KEY}/Checkout?node-id=12-34`;

const api = vi.hoisted(() => ({
  config: { hasFigmaPreviews: true } as { hasFigmaPreviews: boolean },
  getFigmaPreview: vi.fn(),
  refreshFigmaPreview: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key}:${Object.values(options).join("|")}` : key,
    i18n: { language: "en-US" },
  }),
}));

vi.mock("@/lib/format", () => ({
  formatRelativeTime: (value: string) => `rel(${value})`,
  formatDateTime: (value: string) => `abs(${value})`,
}));

vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));

vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: api.config }),
}));

vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "ws-1" } }),
}));

vi.mock("@/fetchers/figma/get-figma-preview", () => ({
  default: api.getFigmaPreview,
}));

vi.mock("@/fetchers/figma/refresh-figma-preview", () => ({
  default: api.refreshFigmaPreview,
}));

const card = (over: Record<string, unknown> = {}) => ({
  url: FRAME_URL,
  fileKey: KEY,
  nodeId: "12:34",
  fileName: "Checkout flow",
  frameName: "Payment step",
  thumbnailUrl: "https://figma-cdn.test/frame.png",
  fetchedAt: "2026-01-01T10:00:00.000Z",
  ...over,
});

function renderCards(content: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FigmaLinkCards content={content} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.config = { hasFigmaPreviews: true };
  api.getFigmaPreview.mockReset();
  api.refreshFigmaPreview.mockReset();
  api.getFigmaPreview.mockResolvedValue(card());
});

afterEach(cleanup);

describe("FigmaLinkCards", () => {
  it("shows a card with thumbnail, file name and fetched-at time", async () => {
    const { container } = renderCards(`Here is the flow: ${FRAME_URL}`);

    expect(await screen.findByText("Checkout flow")).toBeTruthy();
    expect(screen.getByText("Payment step")).toBeTruthy();
    // Decorative: the link's label names the file.
    const image = container.querySelector("img") as HTMLImageElement;
    expect(image.src).toBe("https://figma-cdn.test/frame.png");
    expect(
      screen.getByText("tasks:figma.fetchedAt:rel(2026-01-01T10:00:00.000Z)"),
    ).toBeTruthy();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(FRAME_URL);
    expect(api.getFigmaPreview).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      url: FRAME_URL,
    });
  });

  it("refresh updates the card and its fetched-at time", async () => {
    renderCards(FRAME_URL);
    await screen.findByText("Checkout flow");
    api.refreshFigmaPreview.mockResolvedValue(
      card({
        fileName: "Checkout flow v2",
        fetchedAt: "2026-01-01T11:00:00.000Z",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "tasks:figma.refresh" }),
    );

    expect(await screen.findByText("Checkout flow v2")).toBeTruthy();
    expect(
      screen.getByText("tasks:figma.fetchedAt:rel(2026-01-01T11:00:00.000Z)"),
    ).toBeTruthy();
    expect(api.refreshFigmaPreview.mock.calls[0]?.[0]).toEqual({
      workspaceId: "ws-1",
      url: FRAME_URL,
    });
  });

  it("renders nothing and asks for nothing without a Figma token", async () => {
    api.config = { hasFigmaPreviews: false };
    const { container } = renderCards(FRAME_URL);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.innerHTML).toBe("");
    expect(api.getFigmaPreview).not.toHaveBeenCalled();
  });

  it("renders nothing when the card cannot be fetched", async () => {
    api.getFigmaPreview.mockRejectedValue(new Error("Figma did not answer"));
    const { container } = renderCards(FRAME_URL);
    await waitFor(() => expect(api.getFigmaPreview).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector("a")).toBeNull();
  });

  it("drops a thumbnail that fails to load", async () => {
    const { container } = renderCards(FRAME_URL);
    await screen.findByText("Checkout flow");
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Checkout flow")).toBeTruthy();
  });

  it("ignores content without Figma links", () => {
    const { container } = renderCards("See https://example.test/design");
    expect(container.innerHTML).toBe("");
    expect(api.getFigmaPreview).not.toHaveBeenCalled();
  });
});
