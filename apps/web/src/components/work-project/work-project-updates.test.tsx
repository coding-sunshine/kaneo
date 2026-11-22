import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { WorkProjectUpdates } from "./work-project-updates";

const getUpdates = vi.fn();
const createUpdate = vi.fn();
vi.mock("@/fetchers/work-project/updates", () => ({
  getWorkProjectUpdates: (...a: unknown[]) => getUpdates(...a),
  createWorkProjectUpdate: (...a: unknown[]) => createUpdate(...a),
}));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

function renderUpdates(editable: boolean) {
  getUpdates.mockResolvedValue([
    {
      id: "u1",
      health: "atRisk",
      body: "Slipping",
      userName: "Ann",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkProjectUpdates workProjectId="p1" editable={editable} />
    </QueryClientProvider>,
  );
}

describe("WorkProjectUpdates", () => {
  it("lists updates and posts with the chosen health", async () => {
    createUpdate.mockResolvedValue({});
    renderUpdates(true);
    expect(await screen.findByText("Slipping")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("radio")[2] as HTMLElement);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Late" },
    });
    fireEvent.click(screen.getByText("workspace:workProject.updates.post"));
    await vi.waitFor(() =>
      expect(createUpdate).toHaveBeenCalledWith("p1", {
        health: "offTrack",
        body: "Late",
      }),
    );
  });

  it("hides the composer for viewers", async () => {
    renderUpdates(false);
    expect(await screen.findByText("Slipping")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
