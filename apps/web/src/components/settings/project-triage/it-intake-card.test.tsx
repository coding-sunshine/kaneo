import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ItIntakeCard } from "./it-intake-card";

const setUpItIntake = vi.hoisted(() => vi.fn());
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/fetchers/team-automation/set-up-it-intake", () => ({
  default: setUpItIntake,
}));

describe("ItIntakeCard", () => {
  afterEach(cleanup);

  it("refreshes what the setup adds: the Triage status, category, template and queue", async () => {
    setUpItIntake.mockResolvedValue({});
    const queryClient = new QueryClient();
    const keys = [
      ["columns", "team-1"],
      ["custom-fields", "team-1"],
      ["issue-templates", "team-1"],
      ["views", "ws-1"],
    ];
    for (const queryKey of keys) queryClient.setQueryData(queryKey, []);
    render(
      <QueryClientProvider client={queryClient}>
        <ItIntakeCard projectId="team-1" />
      </QueryClientProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:projectTriage.itIntake.action",
      }),
    );

    await waitFor(() => expect(setUpItIntake).toHaveBeenCalledWith("team-1"));
    for (const queryKey of keys) {
      await waitFor(() =>
        expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true),
      );
    }
  });
});
