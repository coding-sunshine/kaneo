import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Route } from "./onboarding";

const getWorkspaces = vi.fn();
const createWelcomeWorkspace = vi.fn();
const readCheckoutIntent = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  redirect: (options: unknown) => ({ redirect: options }),
}));

vi.mock("@/fetchers/workspace/get-workspaces", () => ({
  default: () => getWorkspaces(),
}));

vi.mock("@/fetchers/onboarding/create-welcome-workspace", () => ({
  default: () => createWelcomeWorkspace(),
}));

vi.mock("@/lib/checkout-intent", () => ({
  readCheckoutIntent: () => readCheckoutIntent(),
}));

vi.mock("@/lib/http-error", () => ({
  isUnauthorizedError: () => false,
  handleUnauthorized: vi.fn(),
}));

vi.mock("@/components/onboarding/onboarding-flow", () => ({
  OnboardingFlow: () => null,
}));

const beforeLoad = (Route as unknown as { beforeLoad: () => Promise<void> })
  .beforeLoad;

afterEach(() => {
  vi.clearAllMocks();
});

describe("onboarding route", () => {
  it("sends someone who already has a workspace to the dashboard", async () => {
    getWorkspaces.mockResolvedValue([{ id: "workspace-1" }]);
    await expect(beforeLoad()).rejects.toEqual({
      redirect: { to: "/dashboard" },
    });
    expect(createWelcomeWorkspace).not.toHaveBeenCalled();
  });

  it("shows the flow when there is no workspace yet", async () => {
    getWorkspaces.mockResolvedValue([]);
    createWelcomeWorkspace.mockResolvedValue({ workspaceId: null });
    await expect(beforeLoad()).resolves.toBeUndefined();
  });

  it("sends a new hire to the welcome workspace made for them", async () => {
    getWorkspaces.mockResolvedValue([]);
    createWelcomeWorkspace.mockResolvedValue({ workspaceId: "welcome" });
    await expect(beforeLoad()).rejects.toEqual({
      redirect: { to: "/dashboard" },
    });
  });

  it("keeps the flow for someone who came to buy a plan", async () => {
    getWorkspaces.mockResolvedValue([]);
    readCheckoutIntent.mockReturnValue({ plan: "team", interval: "monthly" });
    await expect(beforeLoad()).resolves.toBeUndefined();
    expect(createWelcomeWorkspace).not.toHaveBeenCalled();
  });

  it("falls back to the flow when the welcome workspace cannot be made", async () => {
    getWorkspaces.mockResolvedValue([]);
    createWelcomeWorkspace.mockRejectedValue(new Error("offline"));
    await expect(beforeLoad()).resolves.toBeUndefined();
  });

  it("surfaces a failed lookup instead of offering another workspace", async () => {
    const error = new Error("offline");
    getWorkspaces.mockRejectedValue(error);
    await expect(beforeLoad()).rejects.toBe(error);
  });
});
