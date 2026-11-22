import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import enUS from "@i18n/en-US.json";
import { WebhookDialog } from "./webhook-dialog";

const mutation = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue({ secret: "whsec_once" }),
  reset: vi.fn(),
  isPending: false,
}));
vi.mock(
  "@/hooks/mutations/workspace-webhook/use-workspace-webhook-mutation",
  () => ({
    default: () => mutation,
  }),
);
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string) => {
      const [namespace, path] = key.split(":");
      let value: unknown = enUS[namespace as keyof typeof enUS];
      for (const part of path!.split("."))
        value = (value as Record<string, unknown>)?.[part];
      return value ?? key;
    },
  }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const teams = [{ id: "p1", name: "Platform" }];

describe("workspace WebhookDialog", () => {
  it("creates with the chosen team and hands the one-time secret up", async () => {
    const onClose = vi.fn();
    const onSecret = vi.fn();
    render(
      <WebhookDialog
        workspaceId="w1"
        webhook={null}
        teams={teams}
        onClose={onClose}
        onSecret={onSecret}
      />,
    );
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "CI" },
    });
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "https://example.com/hook" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Platform" }));
    fireEvent.click(screen.getByRole("button", { name: "Add webhook" }));
    await waitFor(() => expect(onSecret).toHaveBeenCalledWith("whsec_once"));
    expect(mutation.mutateAsync).toHaveBeenCalledWith({
      workspaceId: "w1",
      label: "CI",
      url: "https://example.com/hook",
      enabled: true,
      resourceTypes: ["task"],
      projectIds: ["p1"],
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("blocks submit with no event type", () => {
    render(
      <WebhookDialog
        workspaceId="w1"
        webhook={{
          id: "x",
          workspaceId: "w1",
          label: "CI",
          url: "https://example.com",
          enabled: true,
          resourceTypes: ["task"],
          projectIds: [],
          createdBy: null,
          createdAt: "2026-01-01T00:00:00Z",
        }}
        teams={teams}
        onClose={vi.fn()}
        onSecret={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Issues" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
