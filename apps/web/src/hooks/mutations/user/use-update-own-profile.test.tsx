import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { expect, it, vi } from "vite-plus/test";
import { ONBOARDING_CHECKLIST_QUERY_KEY } from "@/hooks/queries/onboarding/use-onboarding-checklist";
import useUpdateOwnProfile from "./use-update-own-profile";

vi.mock("@/fetchers/user/update-own-profile", () => ({
  default: vi.fn().mockResolvedValue({ status: { text: "Settling in" } }),
}));

it("refreshes the onboarding checklist, which a status ticks", async () => {
  const client = new QueryClient();
  client.setQueryData(ONBOARDING_CHECKLIST_QUERY_KEY, { items: [] });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useUpdateOwnProfile(), { wrapper });

  await act(() =>
    result.current.mutateAsync({ status: { text: "Settling in" } }),
  );

  expect(
    client.getQueryState(ONBOARDING_CHECKLIST_QUERY_KEY)?.isInvalidated,
  ).toBe(true);
});
