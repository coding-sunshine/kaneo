import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useLoopRuns } from "./use-loops";

const { getRuns } = vi.hoisted(() => ({ getRuns: vi.fn() }));

vi.mock("@/fetchers/loop/loops", () => ({
  getLoops: vi.fn(),
  getRun: vi.fn(),
  getRuns,
}));

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

describe("useLoopRuns", () => {
  beforeEach(() => getRuns.mockReset());

  it("rereads the history when it opens again after a run", async () => {
    const wrapper = createWrapper();
    getRuns.mockResolvedValueOnce([]);
    const first = renderHook(() => useLoopRuns("ws-1", "loop-1"), { wrapper });
    await waitFor(() => expect(first.result.current.data).toEqual([]));
    first.unmount();

    const run = { id: "run-1", trigger: "manual", status: "succeeded" };
    getRuns.mockResolvedValueOnce([run]);
    const again = renderHook(() => useLoopRuns("ws-1", "loop-1"), { wrapper });
    await waitFor(() => expect(again.result.current.data).toEqual([run]));
  });
});
