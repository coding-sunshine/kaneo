import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useAgentDrafts } from "./use-agent-drafts";

const { getAgentDrafts } = vi.hoisted(() => ({ getAgentDrafts: vi.fn() }));

vi.mock("@/fetchers/agent/proposals", () => ({ getAgentDrafts }));
vi.mock("@/hooks/queries/agent/use-agent", () => ({ useHasAgent: () => true }));

// The app's client turns refetchOnMount off; the test keeps that default.
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnMount: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useAgentDrafts", () => {
  beforeEach(() => getAgentDrafts.mockReset());

  it("shows a draft a loop made since Pulse was last open", async () => {
    const wrapper = createWrapper();
    getAgentDrafts.mockResolvedValueOnce([]);
    const first = renderHook(() => useAgentDrafts("ws-1"), { wrapper });
    await waitFor(() => expect(first.result.current.data).toEqual([]));
    first.unmount();

    const draft = { id: "proposal-1", status: "pending" };
    getAgentDrafts.mockResolvedValueOnce([draft]);
    const again = renderHook(() => useAgentDrafts("ws-1"), { wrapper });
    await waitFor(() => expect(again.result.current.data).toEqual([draft]));
  });
});
