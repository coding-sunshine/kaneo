import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { WorkProjectUpdates } from "./work-project-updates";

const getUpdates = vi.fn();
const createUpdate = vi.fn();
const editUpdate = vi.fn();
const deleteUpdate = vi.fn();
vi.mock("@/fetchers/work-project/updates", () => ({
  getWorkProjectUpdates: (...a: unknown[]) => getUpdates(...a),
  createWorkProjectUpdate: (...a: unknown[]) => createUpdate(...a),
  editWorkProjectUpdate: (...a: unknown[]) => editUpdate(...a),
  deleteWorkProjectUpdate: (...a: unknown[]) => deleteUpdate(...a),
}));
const auth = { user: { id: "me" } };
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  useAuth: () => auth,
}));
const perm = { isAdmin: false };
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => perm,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/p">{children}</a>
  ),
}));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  perm.isAdmin = false;
  vi.clearAllMocks();
});

function renderUpdates(editable: boolean, authorId = "me") {
  getUpdates.mockResolvedValue([
    {
      id: "u1",
      workProjectId: "p1",
      userId: authorId,
      health: "atRisk",
      body: "Slipping",
      userName: "Ann",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkProjectUpdates
        workspaceId="w1"
        workProjectId="p1"
        editable={editable}
      />
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

  it("lets the author edit", async () => {
    editUpdate.mockResolvedValue({});
    renderUpdates(true);
    fireEvent.click(
      await screen.findByLabelText("workspace:workProject.updates.edit"),
    );
    fireEvent.change(screen.getAllByRole("textbox")[1] as HTMLElement, {
      target: { value: "New" },
    });
    fireEvent.click(screen.getByText("workspace:workProject.updates.save"));
    await vi.waitFor(() =>
      expect(editUpdate).toHaveBeenCalledWith("u1", { body: "New" }),
    );
  });

  it("gives non-authors no edit, and delete only to admins", async () => {
    renderUpdates(true, "someone-else");
    await screen.findByText("Slipping");
    expect(
      screen.queryByLabelText("workspace:workProject.updates.edit"),
    ).toBeNull();
    expect(
      screen.queryByLabelText("workspace:workProject.updates.delete"),
    ).toBeNull();
    cleanup();
    perm.isAdmin = true;
    renderUpdates(true, "someone-else");
    await screen.findByText("Slipping");
    expect(
      screen.queryByLabelText("workspace:workProject.updates.edit"),
    ).toBeNull();
    expect(
      screen.getByLabelText("workspace:workProject.updates.delete"),
    ).toBeTruthy();
  });
});
